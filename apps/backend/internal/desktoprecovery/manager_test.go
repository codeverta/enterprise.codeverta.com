package desktoprecovery

import (
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func createRecoveryTestDatabase(t *testing.T, path, value string) {
	t.Helper()
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.Exec(`CREATE TABLE financial_records (id INTEGER PRIMARY KEY, value TEXT NOT NULL)`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO financial_records(value) VALUES(?)`, value); err != nil {
		t.Fatal(err)
	}
}

func readRecoveryTestValue(t *testing.T, path string) string {
	t.Helper()
	db, err := sql.Open("sqlite3", "file:"+filepath.ToSlash(path)+"?mode=ro")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var value string
	if err := db.QueryRow(`SELECT value FROM financial_records WHERE id=1`).Scan(&value); err != nil {
		t.Fatal(err)
	}
	return value
}

func overwriteRecoveryTestValue(t *testing.T, path, value string) {
	t.Helper()
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`UPDATE financial_records SET value=? WHERE id=1`, value); err != nil {
		_ = db.Close()
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
}

func TestRollbackRestoresVerifiedPreMigrationSnapshot(t *testing.T) {
	path := filepath.Join(t.TempDir(), "codeverta-offline.db")
	createRecoveryTestDatabase(t, path, "original-financial-data")
	manager := New(path, "0.0.2")

	session, err := manager.Prepare()
	if err != nil {
		t.Fatal(err)
	}
	if !session.active || session.journal.BackupPath == "" {
		t.Fatal("expected an active recovery session with a snapshot")
	}
	overwriteRecoveryTestValue(t, path, "partially-migrated-data")
	if err := manager.Rollback(session, sql.ErrTxDone); err != nil {
		t.Fatal(err)
	}
	if got := readRecoveryTestValue(t, path); got != "original-financial-data" {
		t.Fatalf("snapshot was not restored, got %q", got)
	}
	if _, err := os.Stat(manager.lastRecoveryPath()); err != nil {
		t.Fatalf("expected recovery audit file: %v", err)
	}
}

func TestPrepareRecoversMigrationInterruptedByProcessCrash(t *testing.T) {
	path := filepath.Join(t.TempDir(), "codeverta-offline.db")
	createRecoveryTestDatabase(t, path, "before-crash")
	manager := New(path, "0.0.2")

	if _, err := manager.Prepare(); err != nil {
		t.Fatal(err)
	}
	overwriteRecoveryTestValue(t, path, "after-partial-migration")

	nextStartup := New(path, "0.0.2")
	session, err := nextStartup.Prepare()
	if err != nil {
		t.Fatal(err)
	}
	if got := readRecoveryTestValue(t, path); got != "before-crash" {
		t.Fatalf("startup did not recover the interrupted migration, got %q", got)
	}
	if err := nextStartup.Rollback(session, nil); err != nil {
		t.Fatal(err)
	}
}

func TestCommitRecordsSchemaVersionAndForcedUpdateSnapshot(t *testing.T) {
	path := filepath.Join(t.TempDir(), "codeverta-offline.db")
	createRecoveryTestDatabase(t, path, "committed")
	manager := New(path, "0.0.2")
	session, err := manager.Prepare()
	if err != nil {
		t.Fatal(err)
	}
	if err := manager.Commit(session); err != nil {
		t.Fatal(err)
	}
	version, err := readSchemaVersion(path)
	if err != nil || version != CurrentSchemaVersion {
		t.Fatalf("expected schema version %d, got %d (%v)", CurrentSchemaVersion, version, err)
	}

	if err := os.WriteFile(manager.forceBackupPath(), []byte("0.0.3\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	forcedSession, err := manager.Prepare()
	if err != nil {
		t.Fatal(err)
	}
	if !forcedSession.active || !strings.Contains(filepath.Base(forcedSession.journal.BackupPath), "pre-update") {
		t.Fatalf("expected forced pre-update backup, got %#v", forcedSession.journal)
	}
	if forcedSession.NeedsMigration() {
		t.Fatal("application-only update should not rerun schema migrations")
	}
	if err := manager.Commit(forcedSession); err != nil {
		t.Fatal(err)
	}
}

func TestRollbackRejectsTamperedSnapshot(t *testing.T) {
	path := filepath.Join(t.TempDir(), "codeverta-offline.db")
	createRecoveryTestDatabase(t, path, "safe")
	manager := New(path, "0.0.2")
	session, err := manager.Prepare()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(session.journal.BackupPath, []byte("tampered"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := manager.Rollback(session, sql.ErrTxDone); err == nil || !strings.Contains(err.Error(), "checksum") {
		t.Fatalf("expected checksum failure, got %v", err)
	}
	if got := readRecoveryTestValue(t, path); got != "safe" {
		t.Fatalf("active database changed unexpectedly: %q", got)
	}
}
