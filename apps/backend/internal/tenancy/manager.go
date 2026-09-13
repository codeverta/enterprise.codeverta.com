package tenancy

import (
	"context"
	"fmt"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

type PoolConfig struct {
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
	ConnMaxIdleTime time.Duration
	IdlePoolTTL     time.Duration
}
type poolEntry struct {
	db       *gorm.DB
	lastUsed time.Time
}
type OpenFunc func(Record, string) (*gorm.DB, error)
type DatabaseManager struct {
	cipher *CredentialCipher
	cfg    PoolConfig
	opener OpenFunc
	onOpen func(*gorm.DB)
	mu     sync.RWMutex
	create singleflight.Group
	pools  map[string]*poolEntry
	stop   chan struct{}
}

// SetOnOpen installs per-database callbacks (for example auditing) before a
// newly created tenant pool becomes visible to requests. Configure at startup.
func (m *DatabaseManager) SetOnOpen(callback func(*gorm.DB)) { m.onOpen = callback }

func NewDatabaseManager(cipher *CredentialCipher, cfg PoolConfig) *DatabaseManager {
	if cfg.MaxOpenConns <= 0 {
		cfg.MaxOpenConns = 20
	}
	if cfg.MaxIdleConns <= 0 {
		cfg.MaxIdleConns = 5
	}
	if cfg.ConnMaxLifetime <= 0 {
		cfg.ConnMaxLifetime = 30 * time.Minute
	}
	if cfg.ConnMaxIdleTime <= 0 {
		cfg.ConnMaxIdleTime = 5 * time.Minute
	}
	if cfg.IdlePoolTTL <= 0 {
		cfg.IdlePoolTTL = 15 * time.Minute
	}
	m := &DatabaseManager{cipher: cipher, cfg: cfg, opener: openMySQL, pools: map[string]*poolEntry{}, stop: make(chan struct{})}
	go m.evictLoop()
	return m
}
func NewDatabaseManagerWithOpener(cipher *CredentialCipher, cfg PoolConfig, opener OpenFunc) *DatabaseManager {
	m := NewDatabaseManager(cipher, cfg)
	m.opener = opener
	return m
}
func openMySQL(tenant Record, password string) (*gorm.DB, error) {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local", tenant.DatabaseUser, password, tenant.DatabaseHost, tenant.DatabasePort, tenant.DatabaseName)
	return gorm.Open(mysql.Open(dsn), &gorm.Config{PrepareStmt: true, DisableForeignKeyConstraintWhenMigrating: true})
}
func (m *DatabaseManager) GetDB(ctx context.Context, tenant Record) (*gorm.DB, error) {
	key := tenant.ID.String()
	m.mu.Lock()
	if p := m.pools[key]; p != nil {
		p.lastUsed = time.Now()
		db := p.db
		m.mu.Unlock()
		return db.WithContext(ctx), nil
	}
	m.mu.Unlock()

	value, err, _ := m.create.Do(key, func() (any, error) {
		m.mu.Lock()
		if p := m.pools[key]; p != nil {
			p.lastUsed = time.Now()
			db := p.db
			m.mu.Unlock()
			return db, nil
		}
		m.mu.Unlock()
		password, err := m.cipher.Decrypt(tenant.DatabasePasswordEncrypted)
		if err != nil {
			return nil, ErrTenantUnavailable
		}
		if tenant.DatabaseDriver != "" && tenant.DatabaseDriver != "mysql" && tenant.DatabaseDriver != "mariadb" {
			return nil, ErrTenantUnavailable
		}
		db, err := m.opener(tenant, password)
		if err != nil {
			return nil, ErrTenantUnavailable
		}
		if m.onOpen != nil {
			m.onOpen(db)
		}
		sqlDB, err := db.DB()
		if err != nil {
			return nil, ErrTenantUnavailable
		}
		sqlDB.SetMaxOpenConns(m.cfg.MaxOpenConns)
		sqlDB.SetMaxIdleConns(m.cfg.MaxIdleConns)
		sqlDB.SetConnMaxLifetime(m.cfg.ConnMaxLifetime)
		sqlDB.SetConnMaxIdleTime(m.cfg.ConnMaxIdleTime)
		pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()
		if err = sqlDB.PingContext(pingCtx); err != nil {
			_ = sqlDB.Close()
			return nil, ErrTenantUnavailable
		}
		m.mu.Lock()
		m.pools[key] = &poolEntry{db: db, lastUsed: time.Now()}
		m.mu.Unlock()
		return db, nil
	})
	if err != nil {
		return nil, err
	}
	return value.(*gorm.DB).WithContext(ctx), nil
}
func (m *DatabaseManager) ClosePool(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	p := m.pools[id]
	if p == nil {
		return nil
	}
	delete(m.pools, id)
	sqlDB, err := p.db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
func (m *DatabaseManager) HealthCheck(ctx context.Context, tenant Record) error {
	db, err := m.GetDB(ctx, tenant)
	if err != nil {
		return err
	}
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.PingContext(ctx)
}
func (m *DatabaseManager) Close() {
	close(m.stop)
	m.mu.Lock()
	defer m.mu.Unlock()
	for k, p := range m.pools {
		if sqlDB, e := p.db.DB(); e == nil {
			_ = sqlDB.Close()
		}
		delete(m.pools, k)
	}
}
func (m *DatabaseManager) evictLoop() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			m.evictIdle()
		case <-m.stop:
			return
		}
	}
}
func (m *DatabaseManager) evictIdle() {
	cut := time.Now().Add(-m.cfg.IdlePoolTTL)
	m.mu.Lock()
	defer m.mu.Unlock()
	for k, p := range m.pools {
		if p.lastUsed.Before(cut) {
			if sqlDB, e := p.db.DB(); e == nil {
				_ = sqlDB.Close()
			}
			delete(m.pools, k)
		}
	}
}
