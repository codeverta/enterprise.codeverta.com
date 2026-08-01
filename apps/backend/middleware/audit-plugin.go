package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
	"time"

	"gin-template/common"
	"gin-template/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	auditBeforeRowsKey = "audit:before_rows"
	auditTableName     = "audit_logs"
)

// RegisterAuditPlugin records every successful GORM create, update, and delete.
// Logs are inserted in the same transaction as the mutation, so history and data
// cannot get out of sync. Raw SQL executed with DB.Exec is intentionally outside
// GORM's model callback lifecycle.
func RegisterAuditPlugin(db *gorm.DB) {
	beforeMutation := func(tx *gorm.DB) {
		if !shouldAudit(tx) {
			return
		}
		rows, err := snapshotRows(tx)
		if err != nil {
			tx.AddError(fmt.Errorf("capture audit snapshot: %w", err))
			return
		}
		tx.InstanceSet(auditBeforeRowsKey, rows)
	}

	afterCreate := func(tx *gorm.DB) {
		if !shouldAudit(tx) || tx.Error != nil || tx.RowsAffected == 0 {
			return
		}
		for _, row := range destinationRows(tx) {
			writeAuditLog(tx, "CREATE", nil, row)
		}
	}
	afterUpdate := func(tx *gorm.DB) {
		if !shouldAudit(tx) || tx.Error != nil || tx.RowsAffected == 0 {
			return
		}
		before, _ := auditRows(tx)
		after, err := reloadRows(tx, before)
		if err != nil {
			tx.AddError(fmt.Errorf("reload audit snapshot: %w", err))
			return
		}
		for _, oldRow := range before {
			newRow := after[rowIdentity(tx, oldRow)]
			if newRow == nil {
				newRow = applyUpdateAssignments(tx, oldRow)
			}
			writeAuditLog(tx, "UPDATE", oldRow, newRow)
		}
	}
	afterDelete := func(tx *gorm.DB) {
		if !shouldAudit(tx) || tx.Error != nil || tx.RowsAffected == 0 {
			return
		}
		before, _ := auditRows(tx)
		for _, row := range before {
			writeAuditLog(tx, "DELETE", row, nil)
		}
	}

	db.Callback().Create().After("gorm:create").Register("audit:after_create", afterCreate)
	db.Callback().Update().After("tenant_scope").Before("gorm:update").Register("audit:before_update", beforeMutation)
	db.Callback().Update().After("gorm:update").Register("audit:after_update", afterUpdate)
	db.Callback().Delete().After("tenant_scope").Before("gorm:delete").Register("audit:before_delete", beforeMutation)
	db.Callback().Delete().After("gorm:delete").Register("audit:after_delete", afterDelete)
}

func shouldAudit(tx *gorm.DB) bool {
	if tx == nil || tx.Statement == nil || tx.Statement.Schema == nil {
		return false
	}
	if skip, ok := tx.Get("skip_audit"); ok {
		if value, valid := skip.(bool); valid && value {
			return false
		}
	}
	return tx.Statement.Schema.Table != auditTableName
}

func snapshotRows(tx *gorm.DB) ([]map[string]interface{}, error) {
	query := cleanAuditDB(tx).Table(tx.Statement.Schema.Table)
	if where, ok := tx.Statement.Clauses["WHERE"]; ok {
		query = query.Clauses(where.Expression)
	}
	var rows []map[string]interface{}
	return rows, query.Find(&rows).Error
}

func cleanAuditDB(tx *gorm.DB) *gorm.DB {
	return tx.Session(&gorm.Session{NewDB: true, SkipHooks: true}).
		Set("skip_tenant_scope", true).
		Set("skip_audit", true)
}

func auditRows(tx *gorm.DB) ([]map[string]interface{}, bool) {
	value, ok := tx.InstanceGet(auditBeforeRowsKey)
	if !ok {
		return nil, false
	}
	rows, ok := value.([]map[string]interface{})
	return rows, ok
}

func reloadRows(tx *gorm.DB, before []map[string]interface{}) (map[string]map[string]interface{}, error) {
	result := make(map[string]map[string]interface{}, len(before))
	for _, oldRow := range before {
		query := cleanAuditDB(tx).Table(tx.Statement.Schema.Table)
		for _, field := range tx.Statement.Schema.PrimaryFields {
			value, ok := oldRow[field.DBName]
			if !ok {
				continue
			}
			query = query.Where(clause.Eq{Column: field.DBName, Value: value})
		}
		var row map[string]interface{}
		if err := query.Take(&row).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				continue
			}
			return nil, err
		}
		result[rowIdentity(tx, oldRow)] = row
	}
	return result, nil
}

func destinationRows(tx *gorm.DB) []map[string]interface{} {
	if tx.Statement == nil || tx.Statement.Schema == nil || !tx.Statement.ReflectValue.IsValid() {
		return nil
	}
	value := tx.Statement.ReflectValue
	for value.Kind() == reflect.Ptr {
		if value.IsNil() {
			return nil
		}
		value = value.Elem()
	}
	values := []reflect.Value{value}
	if value.Kind() == reflect.Slice || value.Kind() == reflect.Array {
		values = make([]reflect.Value, value.Len())
		for i := 0; i < value.Len(); i++ {
			values[i] = value.Index(i)
		}
	}
	rows := make([]map[string]interface{}, 0, len(values))
	for _, item := range values {
		for item.Kind() == reflect.Ptr {
			if item.IsNil() {
				break
			}
			item = item.Elem()
		}
		row := make(map[string]interface{})
		for _, field := range tx.Statement.Schema.Fields {
			if field.DBName == "" || field.DBName == "-" {
				continue
			}
			if fieldValue, _ := field.ValueOf(tx.Statement.Context, item); fieldValue != nil {
				row[field.DBName] = fieldValue
			}
		}
		if len(row) > 0 {
			rows = append(rows, row)
		}
	}
	return rows
}

func applyUpdateAssignments(tx *gorm.DB, oldRow map[string]interface{}) map[string]interface{} {
	row := cloneRow(oldRow)
	if setClause, ok := tx.Statement.Clauses["SET"].Expression.(clause.Set); ok {
		for _, assignment := range setClause {
			row[assignment.Column.Name] = assignment.Value
		}
	}
	return row
}

func writeAuditLog(tx *gorm.DB, action string, before, after map[string]interface{}) {
	changes := buildChanges(action, before, after)
	if action == "UPDATE" && len(changes.ChangedColumns) == 0 {
		return
	}
	payload, err := json.Marshal(changes)
	if err != nil {
		tx.AddError(fmt.Errorf("encode audit changes: %w", err))
		return
	}
	request := requestAuditData(tx.Statement.Context)
	tenantID := tenantIDFromContext(tx.Statement.Context)
	if tenantID == nil {
		if value := firstValue(after, before, "tenant_id"); value != nil {
			if parsed, parseErr := uuid.Parse(fmt.Sprint(value)); parseErr == nil {
				tenantID = &parsed
			}
		}
	}
	now := time.Now()
	logRow := map[string]interface{}{
		"id": uuid.New(), "created_at": now, "updated_at": now,
		"user_id": request.UserID, "action": action,
		"table_name": tx.Statement.Schema.Table,
		"record_id":  rowIdentity(tx, firstRow(after, before)),
		"changes":    string(payload), "ip_address": request.IPAddress,
		"user_agent": request.UserAgent, "tenant_id": tenantID,
	}
	if err := cleanAuditDB(tx).Table(auditTableName).Create(logRow).Error; err != nil {
		tx.AddError(fmt.Errorf("write audit log: %w", err))
	}
}

type auditChanges struct {
	Before         map[string]interface{}            `json:"before,omitempty"`
	After          map[string]interface{}            `json:"after,omitempty"`
	ChangedColumns map[string]map[string]interface{} `json:"changed_columns,omitempty"`
}

func buildChanges(action string, before, after map[string]interface{}) auditChanges {
	before = redactRow(before)
	after = redactRow(after)
	result := auditChanges{Before: before, After: after}
	if action != "UPDATE" {
		return result
	}
	result.ChangedColumns = make(map[string]map[string]interface{})
	keys := make(map[string]struct{}, len(before)+len(after))
	for key := range before {
		keys[key] = struct{}{}
	}
	for key := range after {
		keys[key] = struct{}{}
	}
	for key := range keys {
		if key == "updated_at" || jsonEqual(before[key], after[key]) {
			continue
		}
		result.ChangedColumns[key] = map[string]interface{}{"before": before[key], "after": after[key]}
	}
	return result
}

func redactRow(row map[string]interface{}) map[string]interface{} {
	if row == nil {
		return nil
	}
	redacted := cloneRow(row)
	for key := range redacted {
		name := strings.ToLower(key)
		for _, sensitive := range []string{"password", "secret", "token", "credential", "authorization", "cookie", "otp", "recovery_code", "gateway_data"} {
			if strings.Contains(name, sensitive) {
				redacted[key] = "[REDACTED]"
				break
			}
		}
	}
	return redacted
}

func cloneRow(row map[string]interface{}) map[string]interface{} {
	if row == nil {
		return nil
	}
	copyRow := make(map[string]interface{}, len(row))
	for key, value := range row {
		if bytes, ok := value.([]byte); ok {
			copyRow[key] = string(bytes)
			continue
		}
		copyRow[key] = value
	}
	return copyRow
}

func jsonEqual(left, right interface{}) bool {
	l, _ := json.Marshal(left)
	r, _ := json.Marshal(right)
	return string(l) == string(r)
}

func rowIdentity(tx *gorm.DB, row map[string]interface{}) string {
	if row == nil || tx.Statement == nil || tx.Statement.Schema == nil {
		return ""
	}
	parts := make([]string, 0, len(tx.Statement.Schema.PrimaryFields))
	for _, field := range tx.Statement.Schema.PrimaryFields {
		if value, ok := row[field.DBName]; ok {
			parts = append(parts, fmt.Sprint(value))
		}
	}
	if len(parts) == 0 {
		for _, candidate := range []string{"id", "uuid"} {
			if value, ok := row[candidate]; ok {
				return fmt.Sprint(value)
			}
		}
	}
	return strings.Join(parts, ":")
}

func firstRow(rows ...map[string]interface{}) map[string]interface{} {
	for _, row := range rows {
		if row != nil {
			return row
		}
	}
	return nil
}

func firstValue(rows1, rows2 map[string]interface{}, key string) interface{} {
	for _, row := range []map[string]interface{}{rows1, rows2} {
		if row != nil {
			if value, ok := row[key]; ok {
				return value
			}
		}
	}
	return nil
}

type requestAudit struct {
	UserID               uuid.UUID
	IPAddress, UserAgent string
}

func requestAuditData(ctx context.Context) requestAudit {
	data := requestAudit{UserID: uuid.Nil}
	if ctx == nil {
		return data
	}
	for _, key := range []string{"userID", "id"} {
		if parsed, ok := parseUUID(ctx.Value(key)); ok {
			data.UserID = parsed
			break
		}
	}
	if ginCtx, ok := ctx.(*gin.Context); ok && ginCtx.Request != nil {
		data.IPAddress = ginCtx.ClientIP()
		data.UserAgent = ginCtx.Request.UserAgent()
	}
	return data
}

func parseUUID(value interface{}) (uuid.UUID, bool) {
	switch typed := value.(type) {
	case uuid.UUID:
		return typed, typed != uuid.Nil
	case string:
		parsed, err := uuid.Parse(typed)
		return parsed, err == nil
	default:
		return uuid.Nil, false
	}
}

func tenantIDFromContext(ctx context.Context) *uuid.UUID {
	if ctx == nil {
		return nil
	}
	if tenant, ok := ctx.Value(common.CtxTenantKey).(model.Tenant); ok && tenant.ID != uuid.Nil {
		id := tenant.ID
		return &id
	}
	return nil
}
