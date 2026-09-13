package desktoprecovery

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// CurrentSchemaVersion is independent from the desktop application version.
// Increment it only when a release changes the persisted ERP schema or data.
const CurrentSchemaVersion = 1

const (
	journalFileName     = "desktop-migration-pending.json"
	forceBackupFileName = "desktop-update-pending"
	lastRecoveryName    = "desktop-last-recovery.json"
	backupDirectoryName = "recovery-backups"
	defaultRetention    = 5
)

type Manager struct {
	databasePath string
	appVersion   string
	retention    int
}

type Session struct {
	journal migrationJournal
	active  bool
}

func (s *Session) NeedsMigration() bool {
	return s != nil && s.active && s.journal.FromSchemaVersion < s.journal.ToSchemaVersion
}

type migrationJournal struct {
	FromSchemaVersion int       `json:"fromSchemaVersion"`
	ToSchemaVersion   int       `json:"toSchemaVersion"`
	AppVersion        string    `json:"appVersion"`
	BackupPath        string    `json:"backupPath,omitempty"`
	BackupSHA256      string    `json:"backupSha256,omitempty"`
	OriginalExisted   bool      `json:"originalExisted"`
	CreatedAt         time.Time `json:"createdAt"`
}

type recoveryEvent struct {
	Reason      string    `json:"reason"`
	BackupPath  string    `json:"backupPath,omitempty"`
	RecoveredAt time.Time `json:"recoveredAt"`
}

func New(databasePath, appVersion string) *Manager {
	retention := defaultRetention
	if configured, err := strconv.Atoi(strings.TrimSpace(os.Getenv("DESKTOP_BACKUP_RETENTION"))); err == nil && configured > 0 {
		retention = configured
	}
	return &Manager{
		databasePath: filepath.Clean(databasePath),
		appVersion:   strings.TrimSpace(appVersion),
		retention:    retention,
	}
}

func (m *Manager) Prepare() (*Session, error) {
	if strings.TrimSpace(m.databasePath) == "" || m.databasePath == "." {
		return nil, errors.New("desktop recovery database path is empty")
	}
	if err := os.MkdirAll(filepath.Dir(m.databasePath), 0o700); err != nil {
		return nil, fmt.Errorf("create desktop data directory: %w", err)
	}
	if err := m.recoverInterruptedMigration(); err != nil {
		return nil, err
	}

	currentVersion, err := readSchemaVersion(m.databasePath)
	if err != nil {
		return nil, fmt.Errorf("read desktop schema version: %w", err)
	}
	_, forceErr := os.Stat(m.forceBackupPath())
	forceBackup := forceErr == nil
	if forceErr != nil && !errors.Is(forceErr, os.ErrNotExist) {
		return nil, fmt.Errorf("read desktop update marker: %w", forceErr)
	}
	if currentVersion >= CurrentSchemaVersion && !forceBackup {
		return &Session{}, nil
	}

	journal := migrationJournal{
		FromSchemaVersion: currentVersion,
		ToSchemaVersion:   CurrentSchemaVersion,
		AppVersion:        m.appVersion,
		CreatedAt:         time.Now().UTC(),
	}
	info, statErr := os.Stat(m.databasePath)
	journal.OriginalExisted = statErr == nil && !info.IsDir() && info.Size() > 0
	if statErr != nil && !errors.Is(statErr, os.ErrNotExist) {
		return nil, fmt.Errorf("inspect desktop database: %w", statErr)
	}
	if journal.OriginalExisted {
		backupPath, checksum, backupErr := m.createSnapshot(currentVersion, forceBackup)
		if backupErr != nil {
			return nil, backupErr
		}
		journal.BackupPath = backupPath
		journal.BackupSHA256 = checksum
	}
	if err := writeJSONAtomic(m.journalPath(), journal); err != nil {
		return nil, fmt.Errorf("write migration recovery journal: %w", err)
	}
	return &Session{journal: journal, active: true}, nil
}

func (m *Manager) Commit(session *Session) error {
	if session == nil || !session.active {
		return nil
	}
	db, err := openSQLite(m.databasePath)
	if err != nil {
		return err
	}
	defer db.Close()
	if err := integrityCheck(db); err != nil {
		return fmt.Errorf("post-migration integrity check: %w", err)
	}
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS desktop_schema_migrations (
		version INTEGER PRIMARY KEY,
		app_version TEXT NOT NULL,
		applied_at DATETIME NOT NULL
	)`); err != nil {
		return fmt.Errorf("create desktop migration ledger: %w", err)
	}
	if _, err := db.Exec(`INSERT OR REPLACE INTO desktop_schema_migrations(version, app_version, applied_at) VALUES(?,?,?)`,
		CurrentSchemaVersion, m.appVersion, time.Now().UTC()); err != nil {
		return fmt.Errorf("record desktop schema migration: %w", err)
	}
	if err := db.Close(); err != nil {
		return fmt.Errorf("close migration ledger: %w", err)
	}
	if err := os.Remove(m.journalPath()); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("remove migration recovery journal: %w", err)
	}
	_ = os.Remove(m.forceBackupPath())
	return m.pruneSnapshots()
}

func (m *Manager) Rollback(session *Session, reason error) error {
	if session == nil || !session.active {
		return nil
	}
	if err := m.restoreJournal(session.journal); err != nil {
		return err
	}
	return m.finishRecovery("migration failed: "+safeReason(reason), session.journal.BackupPath)
}

func (m *Manager) recoverInterruptedMigration() error {
	data, err := os.ReadFile(m.journalPath())
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("read migration recovery journal: %w", err)
	}
	var journal migrationJournal
	if err := json.Unmarshal(data, &journal); err != nil {
		return fmt.Errorf("invalid migration recovery journal: %w", err)
	}
	if err := m.restoreJournal(journal); err != nil {
		return fmt.Errorf("recover interrupted desktop migration: %w", err)
	}
	return m.finishRecovery("interrupted migration detected during startup", journal.BackupPath)
}

func (m *Manager) restoreJournal(journal migrationJournal) error {
	if !journal.OriginalExisted {
		for _, suffix := range []string{"", "-wal", "-shm"} {
			if err := os.Remove(m.databasePath + suffix); err != nil && !errors.Is(err, os.ErrNotExist) {
				return fmt.Errorf("remove incomplete database: %w", err)
			}
		}
		return nil
	}
	if journal.BackupPath == "" || journal.BackupSHA256 == "" {
		return errors.New("recovery journal does not contain a verified backup")
	}
	checksum, err := fileSHA256(journal.BackupPath)
	if err != nil {
		return fmt.Errorf("verify recovery backup: %w", err)
	}
	if checksum != journal.BackupSHA256 {
		return errors.New("recovery backup checksum does not match the migration journal")
	}
	if err := validateSQLiteFile(journal.BackupPath); err != nil {
		return fmt.Errorf("recovery backup is invalid: %w", err)
	}
	temporary := m.databasePath + ".recovery-tmp"
	_ = os.Remove(temporary)
	if err := copyFile(journal.BackupPath, temporary); err != nil {
		return err
	}
	if err := replaceFile(temporary, m.databasePath); err != nil {
		_ = os.Remove(temporary)
		return err
	}
	_ = os.Remove(m.databasePath + "-wal")
	_ = os.Remove(m.databasePath + "-shm")
	return validateSQLiteFile(m.databasePath)
}

func (m *Manager) createSnapshot(currentVersion int, forced bool) (string, string, error) {
	if err := checkpointAndValidate(m.databasePath); err != nil {
		return "", "", fmt.Errorf("prepare pre-migration snapshot: %w", err)
	}
	if err := os.MkdirAll(m.backupDirectory(), 0o700); err != nil {
		return "", "", err
	}
	kind := fmt.Sprintf("schema-v%d-to-v%d", currentVersion, CurrentSchemaVersion)
	if forced && currentVersion >= CurrentSchemaVersion {
		kind = fmt.Sprintf("pre-update-schema-v%d", currentVersion)
	}
	name := fmt.Sprintf("%s-%s.db", kind, time.Now().UTC().Format("20060102T150405.000000000Z"))
	path := filepath.Join(m.backupDirectory(), name)
	if err := copyFile(m.databasePath, path); err != nil {
		return "", "", fmt.Errorf("create pre-migration snapshot: %w", err)
	}
	if err := validateSQLiteFile(path); err != nil {
		_ = os.Remove(path)
		return "", "", fmt.Errorf("validate pre-migration snapshot: %w", err)
	}
	checksum, err := fileSHA256(path)
	if err != nil {
		_ = os.Remove(path)
		return "", "", err
	}
	if err := writeFileAtomic(path+".sha256", []byte(checksum+"\n")); err != nil {
		_ = os.Remove(path)
		return "", "", fmt.Errorf("write snapshot checksum: %w", err)
	}
	return path, checksum, nil
}

func (m *Manager) finishRecovery(reason, backupPath string) error {
	if err := writeJSONAtomic(m.lastRecoveryPath(), recoveryEvent{
		Reason: reason, BackupPath: backupPath, RecoveredAt: time.Now().UTC(),
	}); err != nil {
		return err
	}
	if err := os.Remove(m.journalPath()); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	_ = os.Remove(m.forceBackupPath())
	return nil
}

func (m *Manager) pruneSnapshots() error {
	entries, err := os.ReadDir(m.backupDirectory())
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	type snapshot struct {
		path    string
		modTime time.Time
	}
	var snapshots []snapshot
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".db" {
			continue
		}
		info, infoErr := entry.Info()
		if infoErr != nil {
			return infoErr
		}
		snapshots = append(snapshots, snapshot{filepath.Join(m.backupDirectory(), entry.Name()), info.ModTime()})
	}
	sort.Slice(snapshots, func(i, j int) bool { return snapshots[i].modTime.After(snapshots[j].modTime) })
	if len(snapshots) <= m.retention {
		return nil
	}
	for _, snapshot := range snapshots[m.retention:] {
		if err := os.Remove(snapshot.path); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
		_ = os.Remove(snapshot.path + ".sha256")
	}
	return nil
}

func readSchemaVersion(path string) (int, error) {
	if _, err := os.Stat(path); errors.Is(err, os.ErrNotExist) {
		return 0, nil
	} else if err != nil {
		return 0, err
	}
	db, err := openSQLite(path)
	if err != nil {
		return 0, err
	}
	defer db.Close()
	var exists int
	if err := db.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='desktop_schema_migrations'`).Scan(&exists); err != nil {
		return 0, err
	}
	if exists == 0 {
		return 0, nil
	}
	var version sql.NullInt64
	if err := db.QueryRow(`SELECT MAX(version) FROM desktop_schema_migrations`).Scan(&version); err != nil {
		return 0, err
	}
	return int(version.Int64), nil
}

func checkpointAndValidate(path string) error {
	db, err := openSQLite(path)
	if err != nil {
		return err
	}
	defer db.Close()
	var busy, logFrames, checkpointedFrames int
	if err := db.QueryRow(`PRAGMA wal_checkpoint(TRUNCATE)`).Scan(&busy, &logFrames, &checkpointedFrames); err != nil {
		return err
	}
	if busy != 0 {
		return fmt.Errorf("database is busy (log=%d checkpointed=%d)", logFrames, checkpointedFrames)
	}
	return integrityCheck(db)
}

func validateSQLiteFile(path string) error {
	db, err := openSQLiteReadOnly(path)
	if err != nil {
		return err
	}
	defer db.Close()
	return integrityCheck(db)
}

func integrityCheck(db *sql.DB) error {
	var result string
	if err := db.QueryRow(`PRAGMA integrity_check`).Scan(&result); err != nil {
		return err
	}
	if result != "ok" {
		return fmt.Errorf("integrity_check=%s", result)
	}
	return nil
}

func openSQLite(path string) (*sql.DB, error) {
	return sql.Open("sqlite3", "file:"+filepath.ToSlash(path)+"?_busy_timeout=5000&_foreign_keys=on")
}

func openSQLiteReadOnly(path string) (*sql.DB, error) {
	return sql.Open("sqlite3", "file:"+filepath.ToSlash(path)+"?mode=ro&_busy_timeout=5000")
}

func copyFile(source, target string) error {
	input, err := os.Open(source)
	if err != nil {
		return err
	}
	defer input.Close()
	if err := os.MkdirAll(filepath.Dir(target), 0o700); err != nil {
		return err
	}
	output, err := os.OpenFile(target, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
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
	if err := os.Rename(source, target); err == nil {
		return syncDirectory(filepath.Dir(target))
	}
	old := target + ".recovery-old"
	_ = os.Remove(old)
	if err := os.Rename(target, old); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	if err := os.Rename(source, target); err != nil {
		_ = os.Rename(old, target)
		return err
	}
	_ = os.Remove(old)
	return syncDirectory(filepath.Dir(target))
}

func writeJSONAtomic(path string, value any) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	return writeFileAtomic(path, data)
}

func writeFileAtomic(path string, data []byte) error {
	temporary := path + ".tmp"
	_ = os.Remove(temporary)
	file, err := os.OpenFile(temporary, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	if _, err := file.Write(data); err != nil {
		_ = file.Close()
		_ = os.Remove(temporary)
		return err
	}
	if err := file.Sync(); err != nil {
		_ = file.Close()
		_ = os.Remove(temporary)
		return err
	}
	if err := file.Close(); err != nil {
		_ = os.Remove(temporary)
		return err
	}
	return replaceFile(temporary, path)
}

func fileSHA256(path string) (string, error) {
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

func syncDirectory(path string) error {
	if runtime.GOOS == "windows" {
		return nil
	}
	directory, err := os.Open(path)
	if err != nil {
		return err
	}
	defer directory.Close()
	return directory.Sync()
}

func safeReason(reason error) string {
	if reason == nil {
		return "unknown error"
	}
	message := reason.Error()
	if len(message) > 500 {
		return message[:500]
	}
	return message
}

func (m *Manager) journalPath() string {
	return filepath.Join(filepath.Dir(m.databasePath), journalFileName)
}
func (m *Manager) forceBackupPath() string {
	return filepath.Join(filepath.Dir(m.databasePath), forceBackupFileName)
}
func (m *Manager) lastRecoveryPath() string {
	return filepath.Join(filepath.Dir(m.databasePath), lastRecoveryName)
}
func (m *Manager) backupDirectory() string {
	return filepath.Join(filepath.Dir(m.databasePath), backupDirectoryName)
}
