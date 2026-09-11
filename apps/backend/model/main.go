package model

import (
	"context"
	"fmt"
	"gin-template/common"
	crmmodel "gin-template/model/crm"
	buyingmodel "gin-template/modules/buying/model"
	hrmodel "gin-template/modules/hr/model"
	printingmodel "gin-template/modules/printing/model"
	sellingmodel "gin-template/modules/selling/model"
	stockmodel "gin-template/modules/stock/model"
	projectsmodel "gin-template/modules/projects/model"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/driver/mysql"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func InitDB() error {
	var (
		db         *gorm.DB
		err        error
		dsn        = os.Getenv("SQL_DSN")
		sqlitePath = strings.TrimSpace(os.Getenv("SQLITE_PATH"))
	)

	config := &gorm.Config{
		PrepareStmt:                              true,
		DisableForeignKeyConstraintWhenMigrating: true,
	}

	if strings.EqualFold(os.Getenv("OFFLINE_MODE"), "true") || sqlitePath != "" {
		if sqlitePath == "" {
			sqlitePath = common.SQLitePath
		}
		if dir := filepath.Dir(sqlitePath); dir != "." {
			if err := os.MkdirAll(dir, 0o700); err != nil {
				return fmt.Errorf("failed to create SQLite directory: %w", err)
			}
		}
		db, err = gorm.Open(sqlite.Open(sqlitePath+"?_busy_timeout=5000&_journal_mode=WAL&_foreign_keys=on"), config)
	} else if dsn != "" {
		db, err = gorm.Open(mysql.Open(dsn), config)
	} else {
		common.SysLog("SQL_DSN and SQLITE_PATH are not set")
	}

	if err != nil {
		return fmt.Errorf("failed to connect database: %w", err)
	}
	if db == nil {
		return fmt.Errorf("failed to connect database: SQL_DSN or SQLITE_PATH is not configured")
	}
	if err := configureSQLPool(db); err != nil {
		return err
	}
	DB = db

	// Core models are deliberately independent from any product module (LMS,
	// inventory, HR, accounting, and so on). Product modules own their own
	// migrations and can be added without changing this list.
	models := []interface{}{
		&Tenant{}, &File{}, &User{}, &Profile{}, &EmailTemplate{},
		&SystemSetting{}, &AuditLog{}, &ImpersonationSession{}, &LoginAttempt{}, &SESCallbackLog{}, &PromoCode{}, &Event{},
		&BalanceLog{}, &WebAuthnCredential{}, &PaymentMethod{},
		&UserActivation{}, &AuthHandoff{}, &OAuthIdentity{}, &PasswordResetToken{},
		&SubscriptionPlan{}, &SubscriptionPlanBundle{}, &SubscriptionFeature{}, &Subscription{}, &LMSPayment{},
		&PricingCategory{}, &Withdrawal{}, &Order{},
		&Wallet{}, &WalletLedger{}, &Organization{}, &Company{}, &Branch{}, &Department{}, &LetterHead{}, &PlatformFeeConfig{},
		&Guide{}, &GuideCategory{}, &Notification{},
		&RoleDefinition{}, &RolePermission{}, &RoleProfile{}, &UserRoleAssignment{}, &UserRoleProfileAssignment{},
		&InstallationSeedState{},
		&DocumentRevision{},
		&Currency{},
	}

	err = db.AutoMigrate(models...)
	if err != nil {
		return fmt.Errorf("auto migration failed: %w", err)
	}
	if err := crmmodel.Migrate(db); err != nil {
		return err
	}
	if err := buyingmodel.Migrate(db); err != nil {
		return err
	}
	if err := printingmodel.Migrate(db); err != nil {
		return err
	}
	if err := sellingmodel.Migrate(db); err != nil {
		return err
	}
	if err := stockmodel.Migrate(db); err != nil {
		return err
	}
	if err := hrmodel.Migrate(db); err != nil {
		return err
	}
	if err := projectsmodel.Migrate(db); err != nil {
		return err
	}

	if err := ensureSystemSettingColumns(db); err != nil {
		return fmt.Errorf("system setting migration failed: %w", err)
	}
	if err := migrateUsersToProfiles(db); err != nil {
		return fmt.Errorf("user profile migration failed: %w", err)
	}
	if err := syncSubscriptionPlanReferences(db); err != nil {
		return fmt.Errorf("subscription plan reference migration failed: %w", err)
	}
	if err := EnsureDefaultTenant(db); err != nil {
		return fmt.Errorf("default tenant initialization failed: %w", err)
	}

	// The onboarding administrator must exist before dependent module defaults
	// are installed. The remaining seeders are coordinated by one resumable,
	// versioned first-run pipeline.
	if err := SeedUsers(db); err != nil {
		return fmt.Errorf("administrator initialization failed: %w", err)
	}
	if err := SeedInstallationData(db); err != nil {
		return err
	}

	return nil
}

// syncSubscriptionPlanReferences repairs rows created by older upgrade flows
// that changed provider_plan_id but left the PlanID foreign key pointing to the
// previous plan. Non-UUID external provider IDs are intentionally ignored.
func syncSubscriptionPlanReferences(db *gorm.DB) error {
	if db.Dialector.Name() == "mysql" {
		return db.Exec(`
			UPDATE subscriptions s
			JOIN subscription_plans p ON s.provider_plan_id = p.id
			SET s.plan_id = p.id
			WHERE s.provider_plan_id <> ''
			  AND (s.plan_id IS NULL OR s.plan_id <> p.id)
		`).Error
	}

	var subscriptions []Subscription
	if err := db.Where("provider_plan_id <> ''").Find(&subscriptions).Error; err != nil {
		return err
	}
	for _, subscription := range subscriptions {
		planID, err := uuid.Parse(strings.TrimSpace(subscription.ProviderPlanID))
		if err != nil || planID == uuid.Nil || (subscription.PlanID != nil && *subscription.PlanID == planID) {
			continue
		}
		var count int64
		if err := db.Model(&SubscriptionPlan{}).Where("id = ?", planID).Count(&count).Error; err != nil {
			return err
		}
		if count == 0 {
			continue
		}
		if err := db.Model(&Subscription{}).Where("id = ?", subscription.ID).Update("plan_id", planID).Error; err != nil {
			return err
		}
	}
	return nil
}

func envInt(name string, fallback int) int {
	value, err := strconv.Atoi(strings.TrimSpace(os.Getenv(name)))
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}

// configureSQLPool delegates automatic stale-connection replacement to database/sql,
// verifies connectivity with bounded retries, and prevents unbounded connection growth.
func configureSQLPool(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("get SQL connection pool: %w", err)
	}
	if db.Dialector.Name() == "sqlite" {
		// A single writer avoids SQLITE_BUSY errors while WAL still allows concurrent reads.
		sqlDB.SetMaxOpenConns(1)
		sqlDB.SetMaxIdleConns(1)
	} else {
		sqlDB.SetMaxOpenConns(envInt("SQL_MAX_OPEN_CONNS", 25))
		sqlDB.SetMaxIdleConns(envInt("SQL_MAX_IDLE_CONNS", 10))
	}
	sqlDB.SetConnMaxLifetime(time.Duration(envInt("SQL_CONN_MAX_LIFETIME_MINUTES", 30)) * time.Minute)
	sqlDB.SetConnMaxIdleTime(time.Duration(envInt("SQL_CONN_MAX_IDLE_MINUTES", 5)) * time.Minute)

	var pingErr error
	for attempt := 1; attempt <= 3; attempt++ {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		pingErr = sqlDB.PingContext(ctx)
		cancel()
		if pingErr == nil {
			return nil
		}
		time.Sleep(time.Duration(attempt) * 150 * time.Millisecond)
	}
	return fmt.Errorf("database ping failed after retries: %w", pingErr)
}

func ensureRAGFullTextIndex(db *gorm.DB) error {
	if db.Dialector.Name() != "mysql" {
		return nil
	}
	var count int64
	if err := db.Raw(`SELECT COUNT(*) FROM information_schema.statistics
		WHERE table_schema = DATABASE() AND table_name = 'rag_document_chunks'
		AND index_name = 'ft_rag_document_chunks_content'`).Scan(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	return db.Exec("ALTER TABLE rag_document_chunks ADD FULLTEXT INDEX ft_rag_document_chunks_content (content)").Error
}

func migrateUsersToProfiles(db *gorm.DB) error {
	var users []User
	if err := db.Find(&users).Error; err != nil {
		return err
	}

	for i := range users {
		user := users[i]
		profile := Profile{
			UserID:      user.ID,
			FullName:    userProfileName(user),
			DisplayName: user.DisplayName,
			PhoneNumber: user.PhoneNumber,
			TenantID:    user.TenantID,
		}
		if err := db.Where("user_id = ?", user.ID).FirstOrCreate(&profile).Error; err != nil {
			return fmt.Errorf("backfill profile for user %s: %w", user.ID, err)
		}
	}

	return nil
}

type legacyPricingSetting struct {
	ID        uuid.UUID      `gorm:"column:id"`
	Name      string         `gorm:"column:name"`
	Amount    float64        `gorm:"column:amount"`
	Currency  string         `gorm:"column:currency"`
	Interval  string         `gorm:"column:interval"`
	BundleID  *uuid.UUID     `gorm:"column:bundle_id"`
	IsActive  bool           `gorm:"column:is_active"`
	Features  datatypes.JSON `gorm:"column:features"`
	CreatedAt time.Time      `gorm:"column:created_at"`
	UpdatedAt time.Time      `gorm:"column:updated_at"`
	TenantID  *uuid.UUID     `gorm:"column:tenant_id"`
}

func migratePricingSettingsToSubscriptionPlans(db *gorm.DB) error {
	if !db.Migrator().HasTable("pricing_settings") {
		return nil
	}

	var legacyPlans []legacyPricingSetting
	if err := db.Table("pricing_settings").Find(&legacyPlans).Error; err != nil {
		return err
	}

	for _, legacy := range legacyPlans {
		if legacy.ID == uuid.Nil {
			continue
		}

		var existingCount int64
		if err := db.Model(&SubscriptionPlan{}).Where("id = ?", legacy.ID).Count(&existingCount).Error; err != nil {
			return err
		}
		if existingCount > 0 {
			continue
		}

		plan := SubscriptionPlan{
			ID:           legacy.ID,
			Name:         legacy.Name,
			Slug:         legacyPricingSlug(legacy.Name, legacy.ID),
			Amount:       legacy.Amount,
			Currency:     legacy.Currency,
			DurationDays: 30,
			Interval:     legacy.Interval,
			IsActive:     legacy.IsActive,
			BundleID:     legacy.BundleID,
			FeatureMeta:  legacy.Features,
			CreatedAt:    legacy.CreatedAt,
			UpdatedAt:    legacy.UpdatedAt,
			TenantID:     legacy.TenantID,
		}
		if plan.Name == "" {
			plan.Name = "Legacy Subscription"
		}

		if err := db.Session(&gorm.Session{SkipHooks: true}).Create(&plan).Error; err != nil {
			return err
		}
	}

	return nil
}

func legacyPricingSlug(name string, id uuid.UUID) string {
	slug := strings.ToLower(strings.TrimSpace(name))
	slug = regexp.MustCompile(`[^a-z0-9]+`).ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	if slug == "" {
		slug = "legacy-pricing"
	}
	return fmt.Sprintf("%s-%s", slug, strings.Split(id.String(), "-")[0])
}

func cleanupLegacyMentorsTable(db *gorm.DB) error {
	if db.Migrator().HasTable("mentors") {
		// Drop foreign key constraints that point to mentors table
		_ = db.Migrator().DropConstraint(&Class{}, "fk_classes_mentor")
		_ = db.Migrator().DropTable("course_mentors")
		_ = db.Migrator().DropTable("mentors")
	}
	return nil
}

func syncCourseBundleCounts(db *gorm.DB) error {
	var bundles []CourseBundle
	if err := db.Unscoped().Find(&bundles).Error; err != nil {
		return err
	}
	for _, bundle := range bundles {
		var count int64
		db.Model(&CourseBundleItem{}).Where("bundle_id = ? AND deleted_at IS NULL", bundle.ID).Count(&count)
		_ = db.Model(&CourseBundle{}).Where("id = ?", bundle.ID).Update("course_count", count).Error
	}
	return nil
}
