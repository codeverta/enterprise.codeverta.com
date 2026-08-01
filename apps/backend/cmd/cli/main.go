package main

import (
	"flag"
	"fmt"
	"gin-template/common"
	"gin-template/model"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	// Load .env
	godotenv.Load()

	// Init logger
	common.InitZapLogger()
	defer common.SyncLogger()

	// Init DB
	common.SysLog("Initializing database...")
	if err := model.InitDB(); err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: Failed to init DB: %v\n", err)
		os.Exit(1)
	}
	defer model.CloseDB()

	resetCmd := flag.NewFlagSet("reset-password", flag.ExitOnError)
	rEmail := resetCmd.String("email", "", "Email user (superadmin/admin)")
	rPass := resetCmd.String("password", "", "Password baru")

	createCmd := flag.NewFlagSet("create-admin", flag.ExitOnError)
	cEmail := createCmd.String("email", "", "Email admin baru")
	cPass := createCmd.String("password", "", "Password admin baru")
	cName := createCmd.String("name", "Admin", "Nama display admin")
	cRole := createCmd.Int("role", 99, "Role: 99=admin, 100=superadmin")

	listCmd := flag.NewFlagSet("list-users", flag.ExitOnError)

	roleCmd := flag.NewFlagSet("set-role", flag.ExitOnError)
	rTargetEmail := roleCmd.String("email", "", "Email user")
	rNewRole := roleCmd.Int("role", 0, "Role baru (30=mentor, 99=admin, 100=superadmin)")

	seedCmd := flag.NewFlagSet("seed", flag.ExitOnError)

	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	switch os.Args[1] {
	case "reset-password":
		resetCmd.Parse(os.Args[2:])
		cmdResetPassword(*rEmail, *rPass)

	case "create-admin":
		createCmd.Parse(os.Args[2:])
		cmdCreateAdmin(*cEmail, *cPass, *cName, *cRole)

	case "list-users":
		listCmd.Parse(os.Args[2:])
		cmdListUsers()

	case "set-role":
		roleCmd.Parse(os.Args[2:])
		cmdSetRole(*rTargetEmail, *rNewRole)

	case "seed":
		seedCmd.Parse(os.Args[2:])
		cmdSeed()

	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n\n", os.Args[1])
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println(`
Usage: go run cmd/cli/main.go <command> [flags]

Commands:
  reset-password   Reset password user via email
    --email     Email user (superadmin/admin)
    --password  Password baru

  create-admin     Buat user admin baru
    --email     Email admin baru (required)
    --password  Password admin baru (required)
    --name      Nama display (default: "Admin")
    --role      Role: 99=admin, 100=superadmin (default: 99)

  list-users       Tampilkan daftar semua user

  set-role         Ubah role user
    --email     Email user (required)
    --role      Role baru: 30=mentor, 99=admin, 100=superadmin (required)

  seed             Seed ulang data awal (kategori, pricing, dll)
  `)
}

func cmdResetPassword(email, password string) {
	if email == "" || password == "" {
		fmt.Fprintln(os.Stderr, "ERROR: --email dan --password wajib diisi")
		os.Exit(1)
	}
	if len(password) < 6 {
		fmt.Fprintln(os.Stderr, "ERROR: Password minimal 6 karakter")
		os.Exit(1)
	}

	// Cek user exists
	var user model.User
	if err := model.DB.Where("email = ?", email).First(&user).Error; err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: User dengan email '%s' tidak ditemukan\n", email)
		os.Exit(1)
	}

	if err := model.ResetUserPasswordByEmail(email, password); err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: Gagal reset password: %v\n", err)
		os.Exit(1)
	}

	roleName := roleLabel(user.Role)
	fmt.Printf("✅ Password berhasil di-reset untuk %s (%s)\n", email, roleName)
}

func cmdCreateAdmin(email, password, name string, role int) {
	if email == "" || password == "" {
		fmt.Fprintln(os.Stderr, "ERROR: --email dan --password wajib diisi")
		os.Exit(1)
	}
	if role != 99 && role != 100 {
		fmt.Fprintln(os.Stderr, "ERROR: Role harus 99 (admin) atau 100 (superadmin)")
		os.Exit(1)
	}

	// Cek duplicate email
	var count int64
	model.DB.Model(&model.User{}).Where("email = ?", email).Count(&count)
	if count > 0 {
		fmt.Fprintf(os.Stderr, "ERROR: Email '%s' sudah terdaftar\n", email)
		os.Exit(1)
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: Gagal hash password: %v\n", err)
		os.Exit(1)
	}

	tenantUUID, err := uuid.Parse("7c3f1a5e-9b2e-4f6a-8d1e-2a4c6b8f9e21")
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: Gagal parse tenant UUID: %v\n", err)
		os.Exit(1)
	}
	now := time.Now()

	user := model.User{
		Email:       email,
		Password:    string(hashed),
		DisplayName: name,
		Role:        role,
		Status:      1,
		Username:    email,
		TenantID:    &tenantUUID,
		CreatedAt:   &now,
		UpdatedAt:   &now,
	}
	if err := model.DB.Create(&user).Error; err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: Gagal membuat user: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("✅ User %s (%s) berhasil dibuat dengan role %s\n", email, name, roleLabel(role))
}

func cmdListUsers() {
	var users []model.User
	if err := model.DB.Order("role desc, email asc").Find(&users).Error; err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: Gagal memuat users: %v\n", err)
		os.Exit(1)
	}

	if len(users) == 0 {
		fmt.Println("Tidak ada user ditemukan.")
		return
	}

	fmt.Printf("\n%-40s %-20s %-12s %s\n", "Email", "Nama", "Role", "Status")
	fmt.Println("──────────────────────────────────────────────────────────────────────────────")
	for _, u := range users {
		fmt.Printf("%-40s %-20s %-12s %d\n",
			u.Email,
			u.DisplayName,
			roleLabel(u.Role),
			u.Status,
		)
	}
	fmt.Printf("\nTotal: %d user(s)\n", len(users))
}

func cmdSetRole(email string, newRole int) {
	if email == "" || newRole == 0 {
		fmt.Fprintln(os.Stderr, "ERROR: --email dan --role wajib diisi")
		os.Exit(1)
	}
	if newRole != 30 && newRole != 99 && newRole != 100 {
		fmt.Fprintln(os.Stderr, "ERROR: Role harus 30 (mentor), 99 (admin), atau 100 (superadmin)")
		os.Exit(1)
	}

	result := model.DB.Model(&model.User{}).Where("email = ?", email).Update("role", newRole)
	if result.RowsAffected == 0 {
		fmt.Fprintf(os.Stderr, "ERROR: User dengan email '%s' tidak ditemukan\n", email)
		os.Exit(1)
	}
	if result.Error != nil {
		fmt.Fprintf(os.Stderr, "ERROR: Gagal update role: %v\n", result.Error)
		os.Exit(1)
	}

	fmt.Printf("✅ Role user %s berhasil diubah menjadi %s\n", email, roleLabel(newRole))
}

func cmdSeed() {
	model.SeedUsers(model.DB)
	model.SeedPricingCategories(model.DB)
	model.SeedSubscriptionPlans(model.DB)
	model.SeedEmailTemplates(model.DB)
	fmt.Println("✅ Seed data berhasil")
}

func roleLabel(role int) string {
	switch role {
	case 100:
		return "Superadmin"
	case 99:
		return "Admin"
	case 30:
		return "Mentor"
	case 20:
		return "Student"
	case 10:
		return "Parent"
	default:
		return fmt.Sprintf("Role-%d", role)
	}
}
