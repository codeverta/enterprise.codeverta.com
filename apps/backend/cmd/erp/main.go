package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"flag"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"gin-template/internal/platform/adminauth"
	"gin-template/internal/platform/provisioning"
	"gin-template/internal/tenancy"
	"gin-template/model"

	_ "github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
	"gorm.io/gorm"
)

func main() {
	_ = godotenv.Load()
	if len(os.Args) < 3 || (os.Args[1] != "tenant" && os.Args[1] != "platform") {
		usage()
	}
	if !strings.EqualFold(os.Getenv("TENANCY_MODE"), "database-per-tenant") {
		fatalf("TENANCY_MODE must be database-per-tenant")
	}
	if err := model.InitDB(); err != nil {
		fatalf("open platform database: %v", err)
	}
	defer model.CloseDB()
	if os.Args[1] == "platform" {
		createPlatformAdmin(os.Args[2:])
		return
	}
	registry := tenancy.NewRegistry(model.DB, 5*time.Minute)
	cipher, err := tenancy.NewCredentialCipher(os.Getenv("TENANT_CREDENTIAL_KEY"))
	if err != nil {
		fatalf("credential key: %v", err)
	}
	manager := tenancy.NewDatabaseManager(cipher, tenancy.PoolConfig{})
	defer manager.Close()
	ctx := context.Background()

	switch os.Args[2] {
	case "list":
		rows, err := registry.List(ctx)
		if err != nil {
			fatalf("list tenants: %v", err)
		}
		for _, row := range rows {
			fmt.Printf("%s\t%s\t%s\t%s\n", row.Slug, row.Status, row.Plan, row.PrimaryDomain)
		}
	case "status":
		if len(os.Args) != 4 {
			fatalf("usage: erp tenant status <slug>")
		}
		row, err := registry.FindBySlug(ctx, os.Args[3])
		if err != nil {
			fatalf("tenant status: %v", err)
		}
		fmt.Printf("slug=%s status=%s plan=%s domain=%s schema=%d\n", row.Slug, row.Status, row.Plan, row.PrimaryDomain, row.SchemaVersion)
	case "migrate":
		migrateTenants(ctx, registry, manager, os.Args[3:])
	case "create":
		createTenant(ctx, registry, manager, cipher, os.Args[3:])
	default:
		usage()
	}
}

func createPlatformAdmin(args []string) {
	if len(args) == 0 || args[0] != "create-admin" {
		fatalf("usage: erp platform create-admin --email ... --password ...")
	}
	flags := flag.NewFlagSet("platform create-admin", flag.ExitOnError)
	email := flags.String("email", "", "platform administrator email")
	password := flags.String("password", "", "platform administrator password")
	_ = flags.Parse(args[1:])
	if err := adminauth.CreateAdmin(model.DB, *email, *password); err != nil {
		fatalf("create platform admin: %v", err)
	}
	fmt.Printf("platform administrator %s created\n", strings.ToLower(strings.TrimSpace(*email)))
}

func createTenant(ctx context.Context, registry *tenancy.Registry, manager *tenancy.DatabaseManager, cipher *tenancy.CredentialCipher, args []string) {
	if len(args) == 0 || strings.HasPrefix(args[0], "-") {
		fatalf("usage: erp tenant create <slug> --domain ... --admin ... [--name ...]")
	}
	slug := args[0]
	flags := flag.NewFlagSet("tenant create", flag.ExitOnError)
	domain := flags.String("domain", "", "tenant hostname")
	admin := flags.String("admin", "", "tenant administrator email")
	name := flags.String("name", "", "tenant display name")
	plan := flags.String("plan", "starter", "subscription plan")
	adminPassword := flags.String("admin-password", "", "initial tenant administrator password")
	_ = flags.Parse(args[1:])
	if flags.NArg() != 0 {
		fatalf("usage: erp tenant create <slug> --domain ... --admin ... [--name ...]")
	}
	if *adminPassword == "" {
		*adminPassword = randomPassword()
	}
	adminDB, err := sql.Open("mysql", os.Getenv("TENANT_DB_ADMIN_DSN"))
	if err != nil {
		fatalf("open provisioning connection: %v", err)
	}
	defer adminDB.Close()
	port := 3306
	if parsed, parseErr := strconv.Atoi(os.Getenv("TENANT_DB_PORT")); parseErr == nil && parsed > 0 && parsed <= 65535 {
		port = parsed
	}
	tenantName := strings.TrimSpace(*name)
	if tenantName == "" {
		tenantName = slug
	}
	service := provisioning.NewService(registry, manager, cipher, provisioning.MySQLProvisioner{Admin: adminDB},
		func(_ context.Context, db *gorm.DB) error { return model.MigrateTenantSchema(db) },
		func(ctx context.Context, db *gorm.DB, tenant tenancy.Record, request provisioning.Request) error {
			return model.BootstrapTenantAdmin(ctx, db, tenant, request.AdminEmail, request.AdminPassword)
		}, envOr("TENANT_DB_HOST", "mysql"), uint16(port), envOr("TENANT_PLATFORM_DOMAIN_SUFFIX", "erp.example.com"))
	row, err := service.Create(ctx, provisioning.Request{Name: tenantName, Slug: slug, Domain: *domain, Plan: *plan, AdminEmail: *admin, AdminPassword: *adminPassword})
	if err != nil {
		fatalf("provision tenant: %v", err)
	}
	fmt.Printf("tenant %s is active at %s\ninitial admin: %s\ninitial password: %s\nchange this password immediately after first login\n", row.Slug, row.PrimaryDomain, *admin, *adminPassword)
}

func migrateTenants(ctx context.Context, registry *tenancy.Registry, manager *tenancy.DatabaseManager, args []string) {
	flags := flag.NewFlagSet("tenant migrate", flag.ExitOnError)
	all := flags.Bool("all", false, "migrate every tenant and continue after failures")
	_ = flags.Parse(args)
	var rows []tenancy.Record
	var err error
	if *all {
		rows, err = registry.List(ctx)
	} else if flags.NArg() == 1 {
		var row tenancy.Record
		row, err = registry.FindBySlug(ctx, flags.Arg(0))
		rows = []tenancy.Record{row}
	} else {
		fatalf("usage: erp tenant migrate <slug> | --all")
	}
	if err != nil {
		fatalf("resolve tenants: %v", err)
	}
	failures := 0
	for _, row := range rows {
		if row.Status == tenancy.StatusProvisioning || row.Status == tenancy.StatusFailed || row.Status == tenancy.StatusTerminated {
			fmt.Printf("SKIP %s status=%s\n", row.Slug, row.Status)
			continue
		}
		db, openErr := manager.GetDB(ctx, row)
		if openErr == nil {
			openErr = model.MigrateTenantSchema(db)
		}
		if openErr != nil {
			failures++
			fmt.Fprintf(os.Stderr, "FAILED %s: %v\n", row.Slug, openErr)
			continue
		}
		fmt.Printf("OK %s\n", row.Slug)
	}
	if failures > 0 {
		os.Exit(2)
	}
}

func randomPassword() string {
	buffer := make([]byte, 24)
	if _, err := rand.Read(buffer); err != nil {
		fatalf("generate admin password: %v", err)
	}
	return base64.RawURLEncoding.EncodeToString(buffer)
}

func envOr(name, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}

func usage() {
	fmt.Fprintln(os.Stderr, "usage: erp tenant <create|list|status|migrate> [options] | erp platform create-admin [options]")
	os.Exit(1)
}

func fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
