package tenancy

import (
	"context"
	"errors"

	"gorm.io/gorm"
)

type contextKey uint8

const tenantKey contextKey = 1
const databaseKey contextKey = 2

func WithScope(ctx context.Context, tenant Context, db *gorm.DB) context.Context {
	ctx = context.WithValue(ctx, tenantKey, tenant)
	return context.WithValue(ctx, databaseKey, db)
}
func FromContext(ctx context.Context) (Context, bool) {
	v, ok := ctx.Value(tenantKey).(Context)
	return v, ok
}
func DBFromContext(ctx context.Context) (*gorm.DB, error) {
	db, ok := ctx.Value(databaseKey).(*gorm.DB)
	if !ok || db == nil {
		return nil, errors.New("tenant database missing from context")
	}
	return db.WithContext(ctx), nil
}
func WithTransaction(ctx context.Context, fn func(context.Context, *gorm.DB) error) error {
	db, err := DBFromContext(ctx)
	if err != nil {
		return err
	}
	return db.Transaction(func(tx *gorm.DB) error { return fn(context.WithValue(ctx, databaseKey, tx), tx) })
}
