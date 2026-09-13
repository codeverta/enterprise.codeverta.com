package main

import (
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"testing"

	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

func testDatabase(t *testing.T, password string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), databaseFile)
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`CREATE TABLE users (
		username TEXT, email TEXT, status INTEGER, role INTEGER, password TEXT,
		token TEXT, updated_at DATETIME, deleted_at DATETIME
	)`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO users(username,email,status,role,password,token) VALUES(?,?,?,?,?,?)`,
		"admin", "admin@codeverta.com", 1, 99, string(hash), "old-token"); err != nil {
		t.Fatal(err)
	}
	return path
}

func bypassDesktopRunningCheck(t *testing.T) {
	t.Helper()
	previous := ensureDesktopStopped
	ensureDesktopStopped = func() error { return nil }
	t.Cleanup(func() { ensureDesktopStopped = previous })
}

func TestRestoreCommandSupportsMissingAndCorruptDestinations(t *testing.T) {
	bypassDesktopRunningCheck(t)
	source := testDatabase(t, "restored-password")

	missing := filepath.Join(t.TempDir(), "missing", databaseFile)
	if err := restoreCommand([]string{"--database", missing, "--input", source, "--confirm"}); err != nil {
		t.Fatalf("restore to missing destination: %v", err)
	}
	if err := validateSQLite(missing); err != nil {
		t.Fatalf("restored missing destination is invalid: %v", err)
	}

	corrupt := filepath.Join(t.TempDir(), databaseFile)
	if err := os.WriteFile(corrupt, []byte("not a sqlite database"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := restoreCommand([]string{"--database", corrupt, "--input", source, "--confirm"}); err != nil {
		t.Fatalf("restore over corrupt destination: %v", err)
	}
	if err := validateSQLite(corrupt); err != nil {
		t.Fatalf("recovered destination is invalid: %v", err)
	}
}

func TestRestoreRejectsInvalidInputBeforeChangingDestination(t *testing.T) {
	bypassDesktopRunningCheck(t)
	target := testDatabase(t, "keep-this-password")
	invalid := filepath.Join(t.TempDir(), "invalid.db")
	if err := os.WriteFile(invalid, []byte("invalid"), 0o600); err != nil {
		t.Fatal(err)
	}
	err := restoreCommand([]string{"--database", target, "--input", invalid, "--confirm"})
	if err == nil || !strings.Contains(err.Error(), "bukan database SQLite") {
		t.Fatalf("expected invalid input rejection, got %v", err)
	}
	if err := validateSQLite(target); err != nil {
		t.Fatalf("active database changed after rejected restore: %v", err)
	}
}

func TestFindUserAndValidateSQLite(t *testing.T) {
	path := testDatabase(t, "old-password")
	if err := validateSQLite(path); err != nil {
		t.Fatal(err)
	}
	db, err := openReadOnly(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	user, err := findUser(db, "ADMIN")
	if err != nil {
		t.Fatal(err)
	}
	if user.Email != "admin@codeverta.com" || bcrypt.CompareHashAndPassword([]byte(user.Password), []byte("old-password")) != nil {
		t.Fatalf("unexpected user: %#v", user)
	}
}

func TestCopyBackupAndReplaceDatabase(t *testing.T) {
	target := testDatabase(t, "old-password")
	if err := checkpointSQLite(target); err != nil {
		t.Fatal(err)
	}
	backup := filepath.Join(t.TempDir(), "backup.db")
	if err := copyFile(target, backup, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := validateSQLite(backup); err != nil {
		t.Fatal(err)
	}

	replacement := testDatabase(t, "new-password")
	temporary := target + ".restore-tmp"
	if err := copyFile(replacement, temporary, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := replaceFile(temporary, target); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(target); err != nil {
		t.Fatal(err)
	}
	db, err := openReadOnly(target)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	user, err := findUser(db, "admin")
	if err != nil {
		t.Fatal(err)
	}
	if bcrypt.CompareHashAndPassword([]byte(user.Password), []byte("new-password")) != nil {
		t.Fatal("replacement database was not installed")
	}
}

func TestBackupCommandWritesChecksumAndDetectsTampering(t *testing.T) {
	bypassDesktopRunningCheck(t)
	source := testDatabase(t, "backup-password")
	backup := filepath.Join(t.TempDir(), "backup.db")
	if err := backupCommand([]string{"--database", source, "--output", backup}); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(backup + ".sha256"); err != nil {
		t.Fatalf("checksum sidecar was not created: %v", err)
	}
	if err := verifyDatabaseChecksumIfPresent(backup); err != nil {
		t.Fatalf("valid backup checksum rejected: %v", err)
	}
	file, err := os.OpenFile(backup, os.O_WRONLY|os.O_APPEND, 0)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := file.WriteString("tampered"); err != nil {
		_ = file.Close()
		t.Fatal(err)
	}
	_ = file.Close()
	if err := verifyDatabaseChecksumIfPresent(backup); err == nil {
		t.Fatal("tampered backup passed checksum verification")
	}
}
