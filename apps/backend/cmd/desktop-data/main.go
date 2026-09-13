package main

import (
	"bufio"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"flag"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/term"
)

const (
	databaseFile = "codeverta-offline.db"
	localAPIAddr = "127.0.0.1:7843"
)

var ensureDesktopStopped = requireDesktopStopped

type userRecord struct {
	Username string
	Email    string
	Status   int
	Role     int
	Password string
}

func main() {
	if len(os.Args) < 2 {
		usage()
	}

	var err error
	switch os.Args[1] {
	case "locate":
		err = locate()
	case "inspect":
		err = inspectCommand(os.Args[2:])
	case "verify-password":
		err = verifyCommand(os.Args[2:])
	case "reset-password":
		err = resetCommand(os.Args[2:])
	case "backup":
		err = backupCommand(os.Args[2:])
	case "restore", "import":
		err = restoreCommand(os.Args[2:])
	default:
		usage()
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR:", err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, `Codeverta ERP desktop data utility

Usage:
  desktop-data locate
  desktop-data inspect --database <codeverta-offline.db>
  desktop-data verify-password --database <db> --identifier admin
  desktop-data reset-password --database <db> --identifier admin
  desktop-data backup --database <db> --output <backup.db>
  desktop-data restore --database <db> --input <backup.db> --confirm

Password input is requested interactively and is never printed.`)
	os.Exit(2)
}

func locate() error {
	paths, err := candidateDatabasePaths()
	if err != nil {
		return err
	}
	found := false
	for _, path := range paths {
		info, statErr := os.Stat(path)
		if statErr == nil && !info.IsDir() {
			fmt.Printf("FOUND\t%s\t%d bytes\n", path, info.Size())
			found = true
		} else {
			fmt.Printf("MISSING\t%s\n", path)
		}
	}
	if !found {
		return errors.New("database desktop tidak ditemukan; selesaikan onboarding offline terlebih dahulu")
	}
	return nil
}

func candidateDatabasePaths() ([]string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	switch runtime.GOOS {
	case "darwin":
		return []string{filepath.Join(home, "Library", "Application Support", "com.codeverta.erp", databaseFile)}, nil
	case "windows":
		base := strings.TrimSpace(os.Getenv("APPDATA"))
		if base == "" {
			return nil, errors.New("APPDATA tidak tersedia")
		}
		return []string{filepath.Join(base, "com.codeverta.erp", databaseFile)}, nil
	default:
		base := strings.TrimSpace(os.Getenv("XDG_DATA_HOME"))
		if base == "" {
			base = filepath.Join(home, ".local", "share")
		}
		return []string{filepath.Join(base, "com.codeverta.erp", databaseFile)}, nil
	}
}

func inspectCommand(args []string) error {
	flags := flag.NewFlagSet("inspect", flag.ContinueOnError)
	database := flags.String("database", "", "SQLite database path")
	if err := flags.Parse(args); err != nil {
		return err
	}
	db, err := openReadOnly(*database)
	if err != nil {
		return err
	}
	defer db.Close()

	var integrity string
	if err := db.QueryRow("PRAGMA integrity_check").Scan(&integrity); err != nil {
		return fmt.Errorf("integrity check gagal: %w", err)
	}
	fmt.Println("Database integrity:", integrity)
	rows, err := db.Query(`SELECT username, email, status, role FROM users WHERE deleted_at IS NULL ORDER BY role DESC, username ASC`)
	if err != nil {
		return fmt.Errorf("membaca users: %w", err)
	}
	defer rows.Close()
	fmt.Printf("%-22s %-34s %-8s %s\n", "USERNAME", "EMAIL", "STATUS", "ROLE")
	for rows.Next() {
		var user userRecord
		if err := rows.Scan(&user.Username, &user.Email, &user.Status, &user.Role); err != nil {
			return err
		}
		fmt.Printf("%-22s %-34s %-8d %d\n", user.Username, user.Email, user.Status, user.Role)
	}
	return rows.Err()
}

func verifyCommand(args []string) error {
	flags := flag.NewFlagSet("verify-password", flag.ContinueOnError)
	database := flags.String("database", "", "SQLite database path")
	identifier := flags.String("identifier", "admin", "username or email")
	if err := flags.Parse(args); err != nil {
		return err
	}
	password, err := readSecret("Password yang ingin diperiksa: ")
	if err != nil {
		return err
	}
	db, err := openReadOnly(*database)
	if err != nil {
		return err
	}
	defer db.Close()
	user, err := findUser(db, *identifier)
	if err != nil {
		return err
	}
	if user.Status != 1 {
		return fmt.Errorf("password tidak diperiksa karena akun berstatus %d (status aktif adalah 1)", user.Status)
	}
	if bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)) != nil {
		return errors.New("password tidak cocok")
	}
	fmt.Printf("OK: password cocok untuk %s (%s), status aktif, role %d\n", user.Username, user.Email, user.Role)
	return nil
}

func resetCommand(args []string) error {
	flags := flag.NewFlagSet("reset-password", flag.ContinueOnError)
	database := flags.String("database", "", "SQLite database path")
	identifier := flags.String("identifier", "admin", "username or email")
	enable := flags.Bool("enable", false, "enable account while resetting")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if err := ensureDesktopStopped(); err != nil {
		return err
	}
	password, err := readSecret("Password baru: ")
	if err != nil {
		return err
	}
	confirmation, err := readSecret("Ulangi password baru: ")
	if err != nil {
		return err
	}
	if password != confirmation {
		return errors.New("konfirmasi password tidak sama")
	}
	if len(password) < 8 || len(password) > 72 {
		return errors.New("password harus 8 sampai 72 karakter")
	}

	db, err := openReadWrite(*database)
	if err != nil {
		return err
	}
	defer db.Close()
	if _, err := findUser(db, *identifier); err != nil {
		return err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	query := `UPDATE users SET password = ?, token = ?, updated_at = CURRENT_TIMESTAMP WHERE deleted_at IS NULL AND (LOWER(username) = ? OR LOWER(email) = ?)`
	params := []any{string(hash), uuid.NewString(), normalizeIdentifier(*identifier), normalizeIdentifier(*identifier)}
	if *enable {
		query = `UPDATE users SET password = ?, token = ?, status = 1, updated_at = CURRENT_TIMESTAMP WHERE deleted_at IS NULL AND (LOWER(username) = ? OR LOWER(email) = ?)`
	}
	result, err := db.Exec(query, params...)
	if err != nil {
		return fmt.Errorf("reset password gagal: %w", err)
	}
	affected, _ := result.RowsAffected()
	if affected != 1 {
		return fmt.Errorf("reset dibatalkan: %d user berubah", affected)
	}
	fmt.Printf("OK: password %s berhasil di-reset; semua token login lama dibatalkan\n", normalizeIdentifier(*identifier))
	return nil
}

func backupCommand(args []string) error {
	flags := flag.NewFlagSet("backup", flag.ContinueOnError)
	database := flags.String("database", "", "SQLite database path")
	output := flags.String("output", "", "backup output path")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if err := ensureDesktopStopped(); err != nil {
		return err
	}
	source, err := requireDatabase(*database)
	if err != nil {
		return err
	}
	if err := checkpointSQLite(source); err != nil {
		return fmt.Errorf("menyiapkan snapshot SQLite: %w", err)
	}
	target := strings.TrimSpace(*output)
	if target == "" {
		target = source + ".backup-" + time.Now().Format("20060102-150405")
	}
	if _, err := os.Stat(target); err == nil {
		return fmt.Errorf("file output sudah ada: %s", target)
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	if err := copyFile(source, target, 0o600); err != nil {
		return err
	}
	if err := validateSQLite(target); err != nil {
		_ = os.Remove(target)
		return fmt.Errorf("backup tidak valid: %w", err)
	}
	checksum, err := databaseChecksum(target)
	if err != nil {
		_ = os.Remove(target)
		return fmt.Errorf("menghitung checksum backup: %w", err)
	}
	if err := os.WriteFile(target+".sha256", []byte(checksum+"\n"), 0o600); err != nil {
		_ = os.Remove(target)
		return fmt.Errorf("menyimpan checksum backup: %w", err)
	}
	fmt.Println("OK: backup database dibuat di", target)
	fmt.Println("CATATAN: salin folder uploads dan desktop-config.json untuk backup perangkat yang lengkap.")
	return nil
}

func restoreCommand(args []string) error {
	flags := flag.NewFlagSet("restore", flag.ContinueOnError)
	database := flags.String("database", "", "destination SQLite database path")
	input := flags.String("input", "", "backup database path")
	confirm := flags.Bool("confirm", false, "confirm replacement")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if !*confirm {
		return errors.New("restore memerlukan --confirm")
	}
	if err := ensureDesktopStopped(); err != nil {
		return err
	}
	targetValue := strings.TrimSpace(*database)
	if targetValue == "" {
		return errors.New("--database wajib diisi; gunakan command locate untuk menemukannya")
	}
	target, err := filepath.Abs(targetValue)
	if err != nil {
		return err
	}
	source := strings.TrimSpace(*input)
	if source == "" {
		return errors.New("--input wajib diisi")
	}
	if err := validateSQLite(source); err != nil {
		return fmt.Errorf("input bukan database SQLite Codeverta yang sehat: %w", err)
	}
	if err := verifyDatabaseChecksumIfPresent(source); err != nil {
		return fmt.Errorf("checksum backup tidak valid: %w", err)
	}
	targetInfo, targetErr := os.Stat(target)
	targetExists := targetErr == nil && !targetInfo.IsDir()
	if targetErr != nil && !errors.Is(targetErr, os.ErrNotExist) {
		return fmt.Errorf("memeriksa database tujuan: %w", targetErr)
	}
	if targetErr == nil && targetInfo.IsDir() {
		return errors.New("path database tujuan mengarah ke folder")
	}
	safety := ""
	if targetExists {
		checkpointErr := checkpointSQLite(target)
		safety = target + ".before-restore-" + time.Now().Format("20060102-150405")
		if err := copyFile(target, safety, 0o600); err != nil {
			return fmt.Errorf("membuat safety backup: %w", err)
		}
		// If the active database is damaged and cannot checkpoint, preserve its
		// WAL companions for forensic/manual recovery, then continue with the
		// explicitly confirmed healthy restore.
		if checkpointErr != nil {
			for _, suffix := range []string{"-wal", "-shm"} {
				if _, statErr := os.Stat(target + suffix); statErr == nil {
					_ = copyFile(target+suffix, safety+suffix, 0o600)
				}
			}
		}
	} else if err := os.MkdirAll(filepath.Dir(target), 0o700); err != nil {
		return fmt.Errorf("membuat folder database tujuan: %w", err)
	}
	temporary := target + ".restore-tmp"
	_ = os.Remove(temporary)
	if err := copyFile(source, temporary, 0o600); err != nil {
		return err
	}
	if err := validateSQLite(temporary); err != nil {
		_ = os.Remove(temporary)
		return fmt.Errorf("salinan restore tidak valid: %w", err)
	}
	if err := replaceFile(temporary, target); err != nil {
		_ = os.Remove(temporary)
		return fmt.Errorf("mengganti database: %w; database lama tersimpan di %s", err, safety)
	}
	_ = os.Remove(target + "-wal")
	_ = os.Remove(target + "-shm")
	if err := validateSQLite(target); err != nil {
		if safety != "" {
			_ = os.Remove(target)
			_ = copyFile(safety, target, 0o600)
		}
		return fmt.Errorf("validasi setelah restore gagal: %w", err)
	}
	fmt.Println("OK: database berhasil di-restore dari", source)
	if safety != "" {
		fmt.Println("Safety backup database sebelumnya:", safety)
	}
	return nil
}

func openReadOnly(path string) (*sql.DB, error) {
	path, err := requireDatabase(path)
	if err != nil {
		return nil, err
	}
	return sql.Open("sqlite3", "file:"+filepath.ToSlash(path)+"?mode=ro&_busy_timeout=5000")
}

func openReadWrite(path string) (*sql.DB, error) {
	path, err := requireDatabase(path)
	if err != nil {
		return nil, err
	}
	return sql.Open("sqlite3", "file:"+filepath.ToSlash(path)+"?_busy_timeout=5000&_foreign_keys=on")
}

func requireDatabase(path string) (string, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return "", errors.New("--database wajib diisi; gunakan command locate untuk menemukannya")
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return "", fmt.Errorf("database tidak ditemukan: %w", err)
	}
	if info.IsDir() {
		return "", errors.New("path database mengarah ke folder")
	}
	return abs, nil
}

func findUser(db *sql.DB, identifier string) (userRecord, error) {
	identifier = normalizeIdentifier(identifier)
	if identifier == "" {
		return userRecord{}, errors.New("identifier wajib diisi")
	}
	var user userRecord
	err := db.QueryRow(`SELECT username, email, status, role, password FROM users WHERE deleted_at IS NULL AND (LOWER(username) = ? OR LOWER(email) = ?) LIMIT 1`, identifier, identifier).
		Scan(&user.Username, &user.Email, &user.Status, &user.Role, &user.Password)
	if errors.Is(err, sql.ErrNoRows) {
		return user, fmt.Errorf("user %q tidak ditemukan", identifier)
	}
	return user, err
}

func normalizeIdentifier(value string) string { return strings.ToLower(strings.TrimSpace(value)) }

func readSecret(prompt string) (string, error) {
	fmt.Fprint(os.Stderr, prompt)
	if term.IsTerminal(int(os.Stdin.Fd())) {
		value, err := term.ReadPassword(int(os.Stdin.Fd()))
		fmt.Fprintln(os.Stderr)
		if err != nil {
			return "", err
		}
		return string(value), nil
	}
	value, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		return "", err
	}
	return strings.TrimRight(value, "\r\n"), nil
}

func requireDesktopStopped() error {
	connection, err := net.DialTimeout("tcp", localAPIAddr, 250*time.Millisecond)
	if err == nil {
		_ = connection.Close()
		return errors.New("Codeverta Desktop masih berjalan; tutup aplikasi sepenuhnya lalu ulangi command")
	}
	return nil
}

func validateSQLite(path string) error {
	db, err := sql.Open("sqlite3", "file:"+filepath.ToSlash(path)+"?mode=ro&_busy_timeout=5000")
	if err != nil {
		return err
	}
	defer db.Close()
	var result string
	if err := db.QueryRow("PRAGMA integrity_check").Scan(&result); err != nil {
		return err
	}
	if result != "ok" {
		return fmt.Errorf("integrity_check=%s", result)
	}
	var usersTable int
	if err := db.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'users'`).Scan(&usersTable); err != nil {
		return err
	}
	if usersTable != 1 {
		return errors.New("tabel users tidak ditemukan")
	}
	return nil
}

func verifyDatabaseChecksumIfPresent(path string) error {
	expected, err := os.ReadFile(path + ".sha256")
	if errors.Is(err, os.ErrNotExist) {
		return nil // Backward compatibility for backups created before checksums.
	}
	if err != nil {
		return err
	}
	actual, err := databaseChecksum(path)
	if err != nil {
		return err
	}
	if strings.TrimSpace(string(expected)) != actual {
		return errors.New("SHA-256 tidak cocok; file mungkin rusak atau dimodifikasi")
	}
	return nil
}

func databaseChecksum(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

func checkpointSQLite(path string) error {
	db, err := openReadWrite(path)
	if err != nil {
		return err
	}
	defer db.Close()
	var busy, logFrames, checkpointedFrames int
	if err := db.QueryRow("PRAGMA wal_checkpoint(TRUNCATE)").Scan(&busy, &logFrames, &checkpointedFrames); err != nil {
		return err
	}
	if busy != 0 {
		return fmt.Errorf("database masih sibuk (busy=%d, log=%d, checkpointed=%d)", busy, logFrames, checkpointedFrames)
	}
	return db.Close()
}

func copyFile(source, target string, mode os.FileMode) error {
	input, err := os.Open(source)
	if err != nil {
		return err
	}
	defer input.Close()
	if err := os.MkdirAll(filepath.Dir(target), 0o700); err != nil {
		return err
	}
	output, err := os.OpenFile(target, os.O_CREATE|os.O_EXCL|os.O_WRONLY, mode)
	if err != nil {
		return err
	}
	success := false
	defer func() {
		_ = output.Close()
		if !success {
			_ = os.Remove(target)
		}
	}()
	if _, err := io.Copy(output, input); err != nil {
		return err
	}
	if err := output.Sync(); err != nil {
		return err
	}
	if err := output.Close(); err != nil {
		return err
	}
	success = true
	return nil
}

func replaceFile(source, target string) error {
	if runtime.GOOS != "windows" {
		return os.Rename(source, target)
	}
	old := target + ".replace-old"
	_ = os.Remove(old)
	if err := os.Rename(target, old); err != nil {
		return err
	}
	if err := os.Rename(source, target); err != nil {
		_ = os.Rename(old, target)
		return err
	}
	return os.Remove(old)
}
