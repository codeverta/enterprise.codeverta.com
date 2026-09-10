package model

import (
	"context"
	"errors"
	"fmt"
	"gin-template/common"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Menggunakan level hierarki sesuai preferensi Anda
const (
	RoleMerchant = 10
	RolePartner  = 20
	// Deprecated aliases keep dormant LMS modules source-compatible.
	RoleParent       = RoleMerchant
	RoleStudent      = RolePartner
	RoleMentor       = 30
	RoleGuruExternal = 40
	RoleAdmin        = 99
	RoleSuperAdmin   = 100
)

func SeedUsers(db *gorm.DB) error {
	var count int64
	if err := db.Model(&User{}).Count(&count).Error; err != nil {
		return err
	}

	if count == 0 {
		fmt.Println("Seeding multi-role default users with hierarchical levels...")

		bootstrapPassword := strings.TrimSpace(os.Getenv("OFFLINE_BOOTSTRAP_PASSWORD"))
		if bootstrapPassword == "" {
			bootstrapPassword = "password123"
		}
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(bootstrapPassword), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("failed to hash seed password: %w", err)
		}

		// FIX: Parse string tenant_id menjadi objek biner uuid.UUID
		tenantUUID, err := uuid.Parse(DefaultTenantIDString)
		if err != nil {
			return fmt.Errorf("failed to parse tenant uuid: %w", err)
		}

		now := time.Now()

		adminDisplayName := strings.TrimSpace(os.Getenv("OFFLINE_ADMIN_NAME"))
		if adminDisplayName == "" {
			adminDisplayName = "Admin"
		}

		seedUsers := []User{
			{
				ID:          uuid.New(), // FIX: Langsung gunakan uuid.UUID, tanpa .String()
				Username:    "admin",
				Password:    string(hashedPassword),
				DisplayName: adminDisplayName,
				Role:        RoleAdmin,
				Status:      1,
				Email:       "admin@codeverta.com",
				TenantID:    &tenantUUID, // FIX: Menggunakan pointer ke uuid.UUID
				CreatedAt:   &now,
				UpdatedAt:   &now,
			},
			{
				ID:          uuid.New(),
				Username:    "mentor1",
				Password:    string(hashedPassword),
				DisplayName: "Coach John Doe",
				Role:        RoleMentor,
				Status:      1,
				Email:       "mentor@codeverta.com",
				TenantID:    &tenantUUID,
				CreatedAt:   &now,
				UpdatedAt:   &now,
			},
			{
				ID:          uuid.New(),
				Username:    "student1",
				Password:    string(hashedPassword),
				DisplayName: "Alex Student",
				Role:        RoleStudent,
				Status:      1,
				Email:       "student@codeverta.com",
				TenantID:    &tenantUUID,
				CreatedAt:   &now,
				UpdatedAt:   &now,
			},
			{
				ID:          uuid.New(),
				Username:    "parent1",
				Password:    string(hashedPassword),
				DisplayName: "Mr. Smith (Parent)",
				Role:        RoleParent,
				Status:      1,
				Email:       "parent@codeverta.com",
				TenantID:    &tenantUUID,
				CreatedAt:   &now,
				UpdatedAt:   &now,
			},
		}

		// PENTING: Karena di hook BeforeCreate() Anda ada validasi pengecekan context tenant:
		// tx.Statement.Context.Value(common.CtxTenantKey)
		// Kita perlu menyuntikkan tenant palsu/default ke context DB saat melakukan seed,
		// agar tidak terkena error "tenant_id is required for security isolation".
		tenantContext := context.WithValue(context.Background(), common.CtxTenantKey, Tenant{ID: tenantUUID})

		if err := db.WithContext(tenantContext).Create(&seedUsers).Error; err != nil {
			return fmt.Errorf("failed to seed users: %w", err)
		}
		fmt.Println("All default hierarchical roles successfully seeded!")
	}

	return nil
}

func SeedData() error {
	seedApps()
	return seedPromoCodes()
}

func seedApps() error {
	var count int64
	// Gunakan DB yang sesuai dengan context project Anda (biasanya database.DB atau global DB)
	DB.Model(&Event{}).Count(&count)
	if count > 0 {
		return nil
	}
	return nil
}

func ptrToTime(t time.Time) *time.Time {
	return &t
}

func seedPromoCodes() error {
	var count int64
	DB.Model(&PromoCode{}).Count(&count)
	if count > 0 {
		return nil
	}

	promo := PromoCode{
		EndAt:         ptrToTime(time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)),
		Code:          "LARI2026",
		DiscountValue: 50000,
		Quota:         100,
	}

	return DB.Create(&promo).Error
}

func SeedPricingCategories(db *gorm.DB) error {
	var count int64
	if err := db.Model(&PricingCategory{}).Count(&count).Error; err != nil {
		return err
	}

	if count == 0 {
		fmt.Println("Seeding default pricing categories...")
		tenantUUID, err := uuid.Parse("7c3f1a5e-9b2e-4f6a-8d1e-2a4c6b8f9e21")
		if err != nil {
			return err
		}

		categories := []PricingCategory{
			{
				ID:           uuid.New(),
				Name:         "Early Years",
				Slug:         "early-years",
				SortOrder:    0,
				CheckoutType: "student",
				IsActive:     true,
				TenantID:     &tenantUUID,
			},
			{
				ID:           uuid.New(),
				Name:         "SD",
				Slug:         "sd",
				SortOrder:    1,
				CheckoutType: "student",
				IsActive:     true,
				TenantID:     &tenantUUID,
			},
			{
				ID:           uuid.New(),
				Name:         "SMP",
				Slug:         "smp",
				SortOrder:    2,
				CheckoutType: "student",
				IsActive:     true,
				TenantID:     &tenantUUID,
			},
			{
				ID:           uuid.New(),
				Name:         "SMA",
				Slug:         "sma",
				SortOrder:    3,
				CheckoutType: "student",
				IsActive:     true,
				TenantID:     &tenantUUID,
			},
			{
				ID:        uuid.New(),
				Name:      "Guru2Digit",
				Slug:      "guru-2-digit",
				SortOrder: 4,
				IsActive:  true,
				TenantID:  &tenantUUID,
			},
			{
				ID:        uuid.New(),
				Name:      "Parent System",
				Slug:      "parent-system",
				SortOrder: 5,
				IsActive:  true,
				TenantID:  &tenantUUID,
			},
		}

		tenantContext := context.WithValue(context.Background(), common.CtxTenantKey, Tenant{ID: tenantUUID})
		for i := range categories {
			if err := db.WithContext(tenantContext).Create(&categories[i]).Error; err != nil {
				return err
			}
		}
	}

	// Always ensure guru-2-digit has CheckoutType = "teacher"
	db.Model(&PricingCategory{}).Where("slug = ?", "guru-2-digit").Update("checkout_type", "teacher")

	// Always ensure parent-system has CheckoutType = "parent"
	if err := db.Model(&PricingCategory{}).Where("slug = ?", "parent-system").Update("checkout_type", "parent").Error; err != nil {
		return err
	}

	// Repair legacy categories created before student checkout was introduced.
	if err := db.Model(&PricingCategory{}).
		Where("slug IN ?", []string{"early", "early-years", "paud", "tk", "sd", "elementary", "smp", "middle", "middle-school", "sma", "high", "high-school"}).
		Update("checkout_type", "student").Error; err != nil {
		return err
	}

	return nil
}

// repairLegacyEarlyYearsPlanCategories moves old Early Years plans away from
// parent-system without touching genuine parent plans. It is safe to run on
// every startup and supports multiple tenants.
func repairLegacyEarlyYearsPlanCategories(db *gorm.DB) error {
	var plans []SubscriptionPlan
	if err := db.Preload("PricingCategory").
		Where("slug IN ?", []string{"early-years", "early_years"}).
		Find(&plans).Error; err != nil {
		return err
	}

	for i := range plans {
		plan := &plans[i]
		if plan.PricingCategory != nil && plan.PricingCategory.CheckoutType == "student" {
			continue
		}
		if plan.TenantID == nil || *plan.TenantID == uuid.Nil {
			continue
		}

		var category PricingCategory
		err := db.Where("tenant_id = ? AND slug = ?", *plan.TenantID, "early-years").First(&category).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			category = PricingCategory{
				ID:           uuid.New(),
				Name:         "Early Years",
				Slug:         "early-years",
				SortOrder:    0,
				CheckoutType: "student",
				IsActive:     true,
				TenantID:     plan.TenantID,
			}
			tenantContext := context.WithValue(context.Background(), common.CtxTenantKey, Tenant{ID: *plan.TenantID})
			if err := db.WithContext(tenantContext).Create(&category).Error; err != nil {
				return err
			}
		} else if err != nil {
			return err
		} else if category.CheckoutType != "student" {
			if err := db.Model(&PricingCategory{}).Where("id = ?", category.ID).Update("checkout_type", "student").Error; err != nil {
				return err
			}
		}

		if err := db.Model(&SubscriptionPlan{}).
			Where("id = ?", plan.ID).
			Update("pricing_category_id", category.ID).Error; err != nil {
			return err
		}
	}

	return nil
}

func SeedSubscriptionPlans(db *gorm.DB) error {
	// Proactive Auto-repair: Fix any existing subscription plans with empty slug
	var emptySlugPlans []SubscriptionPlan
	if err := db.Where("slug = ? OR slug IS NULL", "").Find(&emptySlugPlans).Error; err == nil {
		for _, p := range emptySlugPlans {
			slugified := ""
			for _, r := range p.Name {
				if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
					slugified += string(r)
				} else if r >= 'A' && r <= 'Z' {
					slugified += string(r + 32)
				} else if r == ' ' || r == '-' || r == '_' {
					if len(slugified) > 0 && slugified[len(slugified)-1] != '-' {
						slugified += "-"
					}
				}
			}
			for len(slugified) > 0 && slugified[len(slugified)-1] == '-' {
				slugified = slugified[:len(slugified)-1]
			}
			if slugified == "" {
				slugified = "plan"
			}
			idStr := p.ID.String()
			uniqueSuffix := idStr[len(idStr)-6:]
			newSlug := fmt.Sprintf("%s-%s", slugified, uniqueSuffix)

			db.Model(&SubscriptionPlan{}).Where("id = ?", p.ID).Update("slug", newSlug)
			fmt.Printf("[AutoRepair] Updated plan '%s' empty slug to '%s'\n", p.Name, newSlug)
		}
	}

	var count int64
	if err := db.Model(&SubscriptionPlan{}).Count(&count).Error; err != nil {
		return err
	}

	if count == 0 {
		fmt.Println("Seeding default subscription plans and features...")
		tenantUUID, err := uuid.Parse("7c3f1a5e-9b2e-4f6a-8d1e-2a4c6b8f9e21")
		if err != nil {
			return err
		}

		var earlyCat, sdCat, smpCat, smaCat PricingCategory
		_ = db.Where("slug = ?", "early-years").First(&earlyCat).Error
		_ = db.Where("slug = ?", "sd").First(&sdCat).Error
		_ = db.Where("slug = ?", "smp").First(&smpCat).Error
		_ = db.Where("slug = ?", "sma").First(&smaCat).Error

		var earlyID, sdID, smpID, smaID *uuid.UUID
		if earlyCat.ID != uuid.Nil {
			earlyID = &earlyCat.ID
		}
		if sdCat.ID != uuid.Nil {
			sdID = &sdCat.ID
		}
		if smpCat.ID != uuid.Nil {
			smpID = &smpCat.ID
		}
		if smaCat.ID != uuid.Nil {
			smaID = &smaCat.ID
		}
		plans := []SubscriptionPlan{
			{
				ID:                uuid.New(),
				Name:              "Early Years",
				Slug:              "early-years",
				Description:       "Usia 3–6. Bermain, berkomunikasi, dan membangun karakter sebagai fondasi kemandirian.",
				DurationDays:      30,
				Interval:          "monthly",
				IsActive:          true,
				TenantID:          &tenantUUID,
				PricingCategoryID: earlyID,
			},
			{
				ID:                uuid.New(),
				Name:              "SD 1–3",
				Slug:              "sd-1-3",
				Description:       "Kelas 1–3 SD. Memahami dunia bekerja, mengelola uang, memanfaatkan teknologi, dan berkarya.",
				DurationDays:      30,
				Interval:          "monthly",
				IsActive:          true,
				TenantID:          &tenantUUID,
				PricingCategoryID: sdID,
			},
			{
				ID:                uuid.New(),
				Name:              "SD 4–6",
				Slug:              "sd-4-6",
				Description:       "Kelas 4–6 SD. Entrepreneurship Projects, Advanced Communication, Expanded Library.",
				DurationDays:      30,
				Interval:          "monthly",
				IsActive:          true,
				TenantID:          &tenantUUID,
				PricingCategoryID: sdID,
			},
			{
				ID:                uuid.New(),
				Name:              "SMP",
				Slug:              "smp",
				Description:       "Kelas 7–9 SMP. Mengasah resiliensi, AI, kewirausahaan, dan jejaring.",
				DurationDays:      30,
				Interval:          "monthly",
				IsActive:          true,
				TenantID:          &tenantUUID,
				PricingCategoryID: smpID,
			},
			{
				ID:                uuid.New(),
				Name:              "SMA",
				Slug:              "sma",
				Description:       "Kelas 10–12 SMA. Leadership, Financial Builder, AI Engineering, High-Value Networking.",
				DurationDays:      30,
				Interval:          "monthly",
				IsActive:          true,
				TenantID:          &tenantUUID,
				PricingCategoryID: smaID,
			},
		}

		tenantContext := context.WithValue(context.Background(), common.CtxTenantKey, Tenant{ID: tenantUUID})
		for i := range plans {
			if err := db.WithContext(tenantContext).Create(&plans[i]).Error; err != nil {
				return err
			}
		}

		// Seed features
		featuresMap := map[string][]string{
			"early-years": {
				"Kurikulum Early Years", "Digital Library", "Audio Learning", "Video Lessons", "Portfolio Awal Anak", "Dashboard Merchant",
			},
			"sd-1-3": {
				"Kurikulum SD 1–3", "Course", "Digital Library", "Komunitas Anak", "Portofolio Dunia Nyata (Awal)", "Dashboard Merchant",
			},
			"sd-4-6": {
				"Semua fitur SD 1–3", "Entrepreneurship Projects", "Advanced Communication", "Expanded Library", "Komunitas Anak",
			},
			"smp": {
				"Semua fitur SD", "Social-Emotional Resilience", "AI Literacy", "Komunitas Proyek", "Portofolio Dunia Nyata (Proyek)", "Kolaborasi Antar Partner",
			},
			"sma": {
				"Semua fitur SMP", "Leadership & Communication", "Financial Builder", "Business & Entrepreneurship", "AI Engineering", "High-Value Networking", "Mentor Bisnis", "Real-World Portfolio",
			},
		}

		for _, p := range plans {
			features := featuresMap[p.Slug]
			for _, f := range features {
				feat := SubscriptionFeature{
					ID:         uuid.New(),
					PlanID:     p.ID,
					FeatureKey: f,
					TenantID:   &tenantUUID,
				}
				if err := db.WithContext(tenantContext).Create(&feat).Error; err != nil {
					return err
				}
			}
		}
	}

	// Always ensure Guru2Digit plans are seeded
	var guruCat PricingCategory
	if err := db.Where("slug = ?", "guru-2-digit").First(&guruCat).Error; err == nil {
		tenantUUID, _ := uuid.Parse("7c3f1a5e-9b2e-4f6a-8d1e-2a4c6b8f9e21")
		tenantContext := context.WithValue(context.Background(), common.CtxTenantKey, Tenant{ID: tenantUUID})

		guruPlans := []SubscriptionPlan{
			{
				Name:              "Guru AI Income System",
				Slug:              "guru-ai-income-system",
				Description:       "Dirancang untuk guru pemula yang ingin belajar memanfaatkan AI untuk menciptakan produk digital dan membuka peluang penghasilan baru.",
				Amount:            99000,
				Currency:          "IDR",
				DurationDays:      30,
				Interval:          "monthly",
				IsActive:          true,
				TenantID:          &tenantUUID,
				PricingCategoryID: &guruCat.ID,
			},
			{
				Name:              "Guru AI 1 Miliar Challenge",
				Slug:              "guru-ai-1-miliar-challenge",
				Description:       "Program intensif untuk guru yang ingin membangun aset digital bernilai besar, memperluas jangkauan, dan mengembangkan bisnis edukasi berbasis AI.",
				Amount:            3950000,
				Currency:          "IDR",
				DurationDays:      30,
				Interval:          "monthly",
				IsActive:          true,
				TenantID:          &tenantUUID,
				PricingCategoryID: &guruCat.ID,
			},
		}

		for _, gp := range guruPlans {
			var existingPlan SubscriptionPlan
			if err := db.Where("slug = ?", gp.Slug).First(&existingPlan).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					gp.ID = uuid.New()
					if err := db.WithContext(tenantContext).Create(&gp).Error; err == nil {
						// Seed features for new Guru2Digit plan
						var features []string
						if gp.Slug == "guru-ai-income-system" {
							features = []string{
								"Dasar AI untuk Guru", "Menemukan Ide Produk Digital", "Membuat E-book dengan AI",
								"Membuat Modul dengan AI", "Membuat Worksheet dengan AI", "Membuat Video Pembelajaran dengan AI",
								"Dasar Personal Branding", "Komunitas Guru2Digit", "Update Materi Berkala",
							}
						} else {
							features = []string{
								"Semua Fitur Guru AI Income System", "AI Product Ecosystem", "Digital Asset Strategy",
								"High Ticket Education Products", "Membership Business Model", "AI Content Factory",
								"Funnel & Conversion System", "Community Growth Strategy", "Personal Brand Authority",
								"Business Scaling Framework", "Mentor Sessions", "Challenge & Accountability System",
							}
						}

						for _, f := range features {
							feat := SubscriptionFeature{
								ID:         uuid.New(),
								PlanID:     gp.ID,
								FeatureKey: f,
								TenantID:   &tenantUUID,
							}
							_ = db.WithContext(tenantContext).Create(&feat).Error
						}
					}
				}
			} else {
				// Update fields if exists to be sure it matches the page requirements
				db.Model(&SubscriptionPlan{}).Where("id = ?", existingPlan.ID).Updates(map[string]interface{}{
					"amount":              gp.Amount,
					"pricing_category_id": gp.PricingCategoryID,
				})
			}
		}
	}

	// Always ensure parent-system category has the 3 parent plans & bundles seeded
	var parentCat PricingCategory
	if err := db.Where("slug = ?", "parent-system").First(&parentCat).Error; err == nil {
		tenantUUID, _ := uuid.Parse("7c3f1a5e-9b2e-4f6a-8d1e-2a4c6b8f9e21")
		tenantContext := context.WithValue(context.Background(), common.CtxTenantKey, Tenant{ID: tenantUUID})

		// Seed parent bundles if not exist
		legacyBundle := CourseBundle{
			Name:        "Legacy Contributor Bundle",
			Slug:        "legacy-contributor-bundle",
			Description: "Materi sharing dari Legacy Contributor",
			IsActive:    true,
			TenantID:    &tenantUUID,
		}
		var existLegacyBundle CourseBundle
		if err := db.Where("slug = ?", legacyBundle.Slug).First(&existLegacyBundle).Error; err != nil {
			legacyBundle.ID = uuid.New()
			_ = db.WithContext(tenantContext).Create(&legacyBundle).Error
		} else {
			legacyBundle = existLegacyBundle
		}

		familyBundle := CourseBundle{
			Name:        "Family Financial Builder Bundle",
			Slug:        "family-financial-builder-bundle",
			Description: "Modul-modul Family Financial Builder",
			IsActive:    true,
			TenantID:    &tenantUUID,
		}
		var existFamilyBundle CourseBundle
		if err := db.Where("slug = ?", familyBundle.Slug).First(&existFamilyBundle).Error; err != nil {
			familyBundle.ID = uuid.New()
			_ = db.WithContext(tenantContext).Create(&familyBundle).Error
		} else {
			familyBundle = existFamilyBundle
		}

		businessBundle := CourseBundle{
			Name:        "Business Parent AI Club Bundle",
			Slug:        "business-parent-ai-club-bundle",
			Description: "Modul-modul Business Parent AI Club",
			IsActive:    true,
			TenantID:    &tenantUUID,
		}
		var existBusinessBundle CourseBundle
		if err := db.Where("slug = ?", businessBundle.Slug).First(&existBusinessBundle).Error; err != nil {
			businessBundle.ID = uuid.New()
			_ = db.WithContext(tenantContext).Create(&businessBundle).Error
		} else {
			businessBundle = existBusinessBundle
		}

		// Create course category for parent dummy courses if not exist
		var courseCat CourseCategory
		if err := db.Where("slug = ?", "parent-courses").First(&courseCat).Error; err != nil {
			courseCat = CourseCategory{
				ID:       uuid.New(),
				Name:     "Parent Courses",
				Slug:     "parent-courses",
				IsActive: true,
				TenantID: &tenantUUID,
			}
			_ = db.WithContext(tenantContext).Create(&courseCat).Error
		}

		// Check and link dummy courses to bundles if they are empty
		var itemExist int64
		db.Model(&CourseBundleItem{}).Where("bundle_id = ?", familyBundle.ID).Count(&itemExist)
		if itemExist == 0 {
			createDummyCourseInBundle(db, tenantContext, tenantUUID, familyBundle.ID, "Financial Family Builder Basics", "financial-family-builder-basics", courseCat.ID)
		}
		db.Model(&CourseBundleItem{}).Where("bundle_id = ?", businessBundle.ID).Count(&itemExist)
		if itemExist == 0 {
			createDummyCourseInBundle(db, tenantContext, tenantUUID, businessBundle.ID, "Business AI Core Mastery", "business-ai-core-mastery", courseCat.ID)
		}

		parentPlans := []SubscriptionPlan{
			{
				Name:              "Legacy Contributor",
				Slug:              "legacy-contributor",
				Description:       "Orang tua berpenghasilan Rp1 Miliar+/bulan yang bersedia berbagi perjalanan bisnis dari nol sampai sukses.",
				Amount:            0,
				Currency:          "IDR",
				DurationDays:      30,
				Interval:          "monthly",
				IsFree:            true,
				IsActive:          true,
				TenantID:          &tenantUUID,
				PricingCategoryID: &parentCat.ID,
				BundleID:          &legacyBundle.ID,
				FeatureMeta:       datatypes.JSON([]byte(`{"rules":{"can_create_course":true,"create_requirement":"none","can_sell_course":true,"min_courses_to_sell":1,"min_lessons_to_sell":5,"sell_requirement":"none"}}`)),
			},
			{
				Name:              "Family Financial Builder",
				Slug:              "family-financial-builder",
				Description:       "LMS berisi modul\" yang harus di kerjakan.",
				Amount:            495000,
				Currency:          "IDR",
				DurationDays:      30,
				Interval:          "monthly",
				IsActive:          true,
				TenantID:          &tenantUUID,
				PricingCategoryID: &parentCat.ID,
				BundleID:          &familyBundle.ID,
				FeatureMeta:       datatypes.JSON([]byte(`{"rules":{"can_create_course":false,"create_requirement":"none","can_sell_course":false,"sell_requirement":"none"}}`)),
			},
			{
				Name:              "Business Parent AI Club",
				Slug:              "business-parent-ai",
				Description:       "Isinya modul\" yang harus dikerjakan, dan setelah lengkap menyelesaikan semua materi, parent bisa unlock feature jualan materi...",
				Amount:            129000,
				Currency:          "IDR",
				DurationDays:      30,
				Interval:          "monthly",
				IsActive:          true,
				TenantID:          &tenantUUID,
				PricingCategoryID: &parentCat.ID,
				BundleID:          &businessBundle.ID,
				FeatureMeta:       datatypes.JSON([]byte(`{"rules":{"can_create_course":true,"create_requirement":"none","can_sell_course":true,"min_courses_to_sell":1,"min_lessons_to_sell":0,"sell_requirement":"all"}}`)),
			},
		}

		for _, pp := range parentPlans {
			var existingPlan SubscriptionPlan
			if err := db.Where("slug = ?", pp.Slug).First(&existingPlan).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					pp.ID = uuid.New()
					if err := db.WithContext(tenantContext).Create(&pp).Error; err == nil {
						var features []string
						if pp.Slug == "legacy-contributor" {
							features = []string{"Upload sharing perjalanan bisnis", "Berbagi pelajaran dari nol sampai sukses", "Membangun legacy untuk generasi berikutnya", "Profil contributor"}
						} else if pp.Slug == "family-financial-builder" {
							features = []string{"AI Financial Builder for Family", "Penemuan ide income dengan AI", "Perencanaan keuangan keluarga", "Roadmap mingguan untuk merchant sibuk", "Skill digital untuk merchant", "Dukungan komunitas"}
						} else {
							features = []string{"AI untuk pertumbuhan bisnis", "Workflow konten dan sales", "Prompt library untuk pebisnis", "Studi kasus bisnis", "Diskusi komunitas", "Tantangan implementasi bulanan"}
						}
						for _, f := range features {
							feat := SubscriptionFeature{
								ID:         uuid.New(),
								PlanID:     pp.ID,
								FeatureKey: f,
								TenantID:   &tenantUUID,
							}
							_ = db.WithContext(tenantContext).Create(&feat).Error
						}
					}
				}
			} else {
				db.Model(&SubscriptionPlan{}).Where("id = ?", existingPlan.ID).Updates(map[string]interface{}{
					"amount":              pp.Amount,
					"is_free":             pp.IsFree,
					"pricing_category_id": pp.PricingCategoryID,
					"bundle_id":           pp.BundleID,
					"features":            pp.FeatureMeta,
				})
			}
		}
	}

	return repairLegacyEarlyYearsPlanCategories(db)
}

func createDummyCourseInBundle(db *gorm.DB, tenantContext context.Context, tenantUUID uuid.UUID, bundleID uuid.UUID, courseTitle, courseSlug string, courseCatID uuid.UUID) {
	course := Course{
		ID:               uuid.New(),
		Title:            courseTitle,
		Slug:             courseSlug,
		Description:      "Dummy course for bundle completion testing",
		CourseCategoryID: courseCatID,
		Level:            "high",
		Status:           CourseStatusPublished,
		TenantID:         &tenantUUID,
	}
	if err := db.WithContext(tenantContext).Create(&course).Error; err == nil {
		module := Module{
			ID:          uuid.New(),
			CourseID:    course.ID,
			Title:       "Modul Dasar",
			Description: "Modul pembelajaran dasar",
			TenantID:    &tenantUUID,
		}
		if err := db.WithContext(tenantContext).Create(&module).Error; err == nil {
			l1 := Lesson{
				ID:          uuid.New(),
				ModuleID:    module.ID,
				Title:       "Pelajaran 1: Pengenalan",
				IsPublished: true,
				TenantID:    &tenantUUID,
			}
			l2 := Lesson{
				ID:          uuid.New(),
				ModuleID:    module.ID,
				Title:       "Pelajaran 2: Implementasi",
				IsPublished: true,
				TenantID:    &tenantUUID,
			}
			_ = db.WithContext(tenantContext).Create(&l1).Error
			_ = db.WithContext(tenantContext).Create(&l2).Error
		}

		item := CourseBundleItem{
			ID:       uuid.New(),
			BundleID: bundleID,
			CourseID: course.ID,
			TenantID: &tenantUUID,
		}
		_ = db.WithContext(tenantContext).Create(&item).Error
	}
}

const htmlPaymentSuccess = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Resi Pembayaran HSKITA</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f4f7f6;
            margin: 0;
            padding: 20px;
            color: #333;
        }
        .receipt-container {
            max-width: 450px;
            background: #ffffff;
            margin: 0 auto;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.05);
        }
        .header {
            text-align: center;
            border-bottom: 2px dashed #e2e8f0;
            padding-bottom: 20px;
            margin-bottom: 20px;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #4F46E5;
            margin-bottom: 5px;
        }
        .success-badge {
            background-color: #DEF7EC;
            color: #03543F;
            padding: 6px 12px;
            border-radius: 50px;
            font-size: 13px;
            font-weight: 600;
            display: inline-block;
            margin-top: 10px;
        }
        .success-message {
            font-size: 14px;
            color: #6B7280;
            margin-top: 10px;
            line-height: 1.5;
        }
        .details {
            margin-bottom: 25px;
        }
        .row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
            font-size: 14px;
        }
        .label {
            color: #888;
        }
        .value {
            font-weight: 500;
            text-align: right;
        }
        .divider {
            border-top: 1px solid #edf2f7;
            margin: 15px 0;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            font-size: 18px;
            font-weight: 700;
            color: #111827;
            margin-top: 15px;
        }
        .footer {
            text-align: center;
            font-size: 12px;
            color: #9CA3AF;
            margin-top: 30px;
        }
    </style>
</head>
<body>
<div class="receipt-container">
    <div class="header">
        <div class="logo">HSKITA</div>
        <div class="success-badge">✓ Pembayaran Berhasil</div>
        <p class="success-message">
            Terima kasih! Pembayaran Anda telah diterima dan diverifikasi secara otomatis. Akun belajar Anda kini telah aktif.
        </p>
    </div>
    <div class="details">
        <div class="row">
            <span class="label">Nama Pengguna</span>
            <span class="value">{{PICName}}</span>
        </div>
        <div class="row">
            <span class="label">Order ID</span>
            <span class="value">#{{OrderID}}</span>
        </div>
        <div class="row">
            <span class="label">Waktu Pembayaran</span>
            <span class="value">{{PaidAt}}</span>
        </div>
        <div class="divider"></div>
        <div class="row" style="color: #DC2626;">
            <span class="label" style="color: #DC2626;">Potongan Diskon</span>
            <span class="value">-{{TotalDiscount}}</span>
        </div>
        <div class="total-row">
            <span>Total Bayar</span>
            <span>{{FinalAmount}}</span>
        </div>
    </div>
    <div class="footer">
        <p>Resi ini dibuat secara otomatis dan sah sebagai bukti pembayaran resmi.</p>
        <p>© 2026 HSKITA Learning Platform. All rights reserved.</p>
    </div>
</div>
</body>
</html>`

const htmlPaymentLink = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Tagihan Pembayaran HSKITA</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; color: #333;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7f6; padding: 40px 0;">
        <tr>
            <td align="center">
                <table width="500" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-top: 6px solid #4F46E5; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    <tr>
                        <td style="padding: 30px; text-align: center; background-color: #4F46E5;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 1px;">HSKITA</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="color: #111827; margin: 0 0 20px 0; font-size: 20px; font-weight: bold;">Halo, {{Name}}!</h2>
                            <p style="color: #4B5563; line-height: 1.6; margin: 0 0 25px 0; font-size: 15px;">
                                Tagihan pembayaran pendaftaran HSKITA Anda telah diterbitkan. Silakan selesaikan pembayaran Anda dengan mengklik tombol di bawah ini:
                            </p>
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 10px 0;">
                                        <a href="{{PaymentURL}}" style="background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 14px 35px; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);" target="_blank" rel="nofollow noopener">
                                            Bayar Sekarang
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-left: 4px solid #4F46E5; border-radius: 4px; margin: 25px 0;">
                                <tr>
                                    <td style="padding: 15px;">
                                        <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #4B5563;">
                                            <tr>
                                                <td style="padding: 5px 0;">Order ID:</td>
                                                <td style="padding: 5px 0; text-align: right; color: #111827; font-weight: bold;">#{{OrderID}}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 5px 0;">Jumlah Tagihan:</td>
                                                <td style="padding: 5px 0; text-align: right; color: #111827; font-weight: bold;">Rp {{Amount}}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 5px 0;">Batas Waktu:</td>
                                                <td style="padding: 5px 0; text-align: right; color: #DC2626; font-weight: bold;">{{ExpiryDate}}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            <p style="color: #6B7280; font-size: 13px; margin: 30px 0 10px 0; text-align: center;">
                                Jika tombol di atas tidak berfungsi, salin dan tempel link berikut ke browser Anda:
                            </p>
                            <div style="background-color: #f3f4f6; border: 1px solid #e5e7eb; padding: 12px; border-radius: 8px; text-align: center; margin-bottom: 20px; word-break: break-all;">
                                <a href="{{PaymentURL}}" style="color: #4F46E5; text-decoration: none; font-size: 13px; font-family: monospace;" rel="nofollow noopener" target="_blank">
                                    {{PaymentURL}}
                                </a>
                            </div>
                            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                            <p style="color: #9CA3AF; font-size: 12px; line-height: 1.5; margin: 0;">
                                Mohon selesaikan pembayaran sebelum batas waktu untuk menghindari pembatalan otomatis.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f9fafb; border-top: 1px solid #edf2f7; padding: 20px; text-align: center;">
                            <p style="color: #9CA3AF; margin: 0; font-size: 12px;">
                                © 2026 HSKITA Learning Platform. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`

const htmlActivation = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Aktivasi Akun HSKITA</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; color: #333;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7f6; padding: 40px 0;">
        <tr>
            <td align="center">
                <table width="500" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-top: 6px solid #4F46E5; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    <tr>
                        <td style="padding: 30px; text-align: center; background-color: #4F46E5;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 1px;">HSKITA</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="color: #111827; margin: 0 0 20px 0; font-size: 20px; font-weight: bold;">Halo, {{Name}}!</h2>
                            <p style="color: #4B5563; line-height: 1.6; margin: 0 0 25px 0; font-size: 15px;">
                                Terima kasih telah bergabung dengan HSKITA. Silakan aktifkan akun Anda dan buat kata sandi baru untuk mulai mengakses platform pembelajaran dengan mengklik tombol di bawah ini:
                            </p>
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 10px 0;">
                                        <a href="{{ActivationLink}}" style="background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 14px 35px; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);" target="_blank" rel="nofollow noopener">
                                            Aktifkan Akun Saya
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style="color: #6B7280; font-size: 13px; margin: 30px 0 10px 0; text-align: center;">
                                Jika tombol di atas tidak berfungsi, salin dan tempel link berikut ke browser Anda:
                            </p>
                            <div style="background-color: #f3f4f6; border: 1px solid #e5e7eb; padding: 12px; border-radius: 8px; text-align: center; margin-bottom: 20px; word-break: break-all;">
                                <a href="{{ActivationLink}}" style="color: #4F46E5; text-decoration: none; font-size: 13px; font-family: monospace;" rel="nofollow noopener" target="_blank">
                                    {{ActivationLink}}
                                </a>
                            </div>
                            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                            <p style="color: #9CA3AF; font-size: 12px; line-height: 1.5; margin: 0;">
                                Tautan aktivasi ini akan kedaluwarsa dalam 24 jam. Jika Anda tidak merasa melakukan pendaftaran ini, silakan abaikan email ini.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f9fafb; border-top: 1px solid #edf2f7; padding: 20px; text-align: center;">
                            <p style="color: #9CA3AF; margin: 0; font-size: 12px;">
                                © 2026 HSKITA Learning Platform. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`

const htmlPasswordReset = `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><title>Ubah Password</title></head>
<body style="margin:0;padding:32px;background:#f4f7f6;font-family:Arial,sans-serif;color:#1f2937">
<table width="100%"><tr><td align="center"><table width="520" style="background:#fff;border-radius:12px;padding:32px">
<tr><td><h2>Halo, {{Name}}</h2><p>Kami menerima permintaan untuk mengubah password akun Anda.</p>
<p style="text-align:center;margin:32px 0"><a href="{{ResetLink}}" style="background:#4F46E5;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:bold">Ubah Password</a></p>
<p style="font-size:13px;color:#6b7280">Link ini hanya dapat digunakan sekali dan berlaku selama 30 menit. Jika Anda tidak meminta perubahan password, abaikan email ini.</p>
<p style="font-size:12px;word-break:break-all"><a href="{{ResetLink}}">{{ResetLink}}</a></p></td></tr>
</table></td></tr></table></body></html>`

func SeedEmailTemplates(db *gorm.DB) error {
	typesToSeed := []struct {
		Type        TemplateType
		TencentID   uint64
		Name        string
		Subject     string
		FromAddress string
		Body        string
	}{
		{
			Type:        TypePaymentSuccess,
			TencentID:   70249,
			Name:        "Pembayaran Berhasil",
			Subject:     "Selamat Berlangganan Aplikasi HSKITA",
			FromAddress: "noreply@codeverta.com",
			Body:        htmlPaymentSuccess,
		},
		{
			Type:        TypePaymentLink,
			TencentID:   70346,
			Name:        "Tagihan Pembayaran HSKITA",
			Subject:     "Tagihan Pembayaran HSKITA",
			FromAddress: "noreply@codeverta.com",
			Body:        htmlPaymentLink,
		},
		{
			Type:        TypeActivation,
			TencentID:   70345,
			Name:        "Aktivasi Akun HSKITA",
			Subject:     "Aktivasi Akun HSKITA",
			FromAddress: "noreply@codeverta.com",
			Body:        htmlActivation,
		},
		{
			Type:        TypePasswordReset,
			TencentID:   passwordResetTemplateID(),
			Name:        "Ubah Password Akun",
			Subject:     "Link Ubah Password Akun Anda",
			FromAddress: "noreply@codeverta.com",
			Body:        htmlPasswordReset,
		},
	}

	tenantUUID, err := uuid.Parse("7c3f1a5e-9b2e-4f6a-8d1e-2a4c6b8f9e21")
	if err != nil {
		return err
	}
	tenantContext := context.WithValue(context.Background(), common.CtxTenantKey, Tenant{ID: tenantUUID})

	for _, item := range typesToSeed {
		var existing EmailTemplate
		err := db.Set("skip_tenant_scope", true).Where("type = ?", item.Type).First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			newTpl := EmailTemplate{
				ID:                uuid.New(),
				TencentTemplateID: item.TencentID,
				TemplateStatus:    "APPROVED",
				Type:              item.Type,
				FromAddress:       item.FromAddress,
				Name:              item.Name,
				Subject:           item.Subject,
				Body:              item.Body,
				TenantID:          &tenantUUID,
			}
			if err := db.WithContext(tenantContext).Create(&newTpl).Error; err != nil {
				return err
			}
			fmt.Printf("Seeded email template of type %s with Tencent ID %d\n", item.Type, item.TencentID)
		} else if err == nil {
			changed := false
			if existing.Body == "" {
				existing.Body = item.Body
				changed = true
			}
			if item.Type == TypePasswordReset && item.TencentID > 0 && existing.TencentTemplateID != item.TencentID {
				existing.TencentTemplateID = item.TencentID
				changed = true
			}
			if changed {
				if err := db.Set("skip_tenant_scope", true).Save(&existing).Error; err != nil {
					return err
				}
				fmt.Printf("Updated email template of type %s\n", item.Type)
			}
		}
	}
	return nil
}

func passwordResetTemplateID() uint64 {
	value, _ := strconv.ParseUint(os.Getenv("PASSWORD_RESET_TEMPLATE_ID"), 10, 64)
	return value
}
