package provisioning

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"

	"gin-template/internal/tenancy"
)

var sqlIdentifier = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

type MySQLProvisioner struct{ Admin *sql.DB }

func (p MySQLProvisioner) Create(ctx context.Context, tenant tenancy.Record, password string) error {
	if p.Admin == nil {
		return errors.New("database administrator connection is missing")
	}
	if !sqlIdentifier.MatchString(tenant.DatabaseName) || !sqlIdentifier.MatchString(tenant.DatabaseUser) {
		return errors.New("unsafe database identifier")
	}
	database := "`" + tenant.DatabaseName + "`"
	account := "'" + tenant.DatabaseUser + "'@'%'"
	statements := []struct {
		query string
		args  []any
	}{
		{"CREATE DATABASE IF NOT EXISTS " + database + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", nil},
		{"CREATE USER IF NOT EXISTS " + account + " IDENTIFIED BY ?", []any{password}},
		{"ALTER USER " + account + " IDENTIFIED BY ?", []any{password}},
		{"GRANT ALL PRIVILEGES ON " + database + ".* TO " + account, nil},
	}
	for _, statement := range statements {
		if _, err := p.Admin.ExecContext(ctx, statement.query, statement.args...); err != nil {
			return fmt.Errorf("database provisioning statement failed: %w", err)
		}
	}
	return nil
}
