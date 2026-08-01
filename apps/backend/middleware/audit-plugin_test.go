package middleware

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"gin-template/common"
	"gin-template/model"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type auditTestItem struct {
	ID        uuid.UUID `gorm:"type:char(36);primaryKey"`
	Name      string
	Password  string
	TenantID  *uuid.UUID
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt
}

func TestAuditPluginRecordsCreateUpdateDeleteAndActor(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	if err := db.AutoMigrate(&auditTestItem{}, &model.AuditLog{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	RegisterAuditPlugin(db)

	tenant := model.Tenant{ID: uuid.New()}
	actorID := uuid.New()
	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)
	ctx = context.WithValue(ctx, "id", actorID.String())
	item := auditTestItem{ID: uuid.New(), Name: "Before", Password: "top-secret", TenantID: &tenant.ID}
	if err := db.WithContext(ctx).Create(&item).Error; err != nil {
		t.Fatalf("create item: %v", err)
	}
	if err := db.WithContext(ctx).Model(&item).Update("name", "After").Error; err != nil {
		t.Fatalf("update item: %v", err)
	}
	if err := db.WithContext(ctx).Delete(&item).Error; err != nil {
		t.Fatalf("delete item: %v", err)
	}

	var logs []model.AuditLog
	if err := db.Order("created_at ASC").Find(&logs).Error; err != nil {
		t.Fatalf("read logs: %v", err)
	}
	if len(logs) != 3 {
		t.Fatalf("expected 3 logs, got %d", len(logs))
	}
	for index, action := range []string{"CREATE", "UPDATE", "DELETE"} {
		if logs[index].Action != action {
			t.Errorf("log %d action = %q, want %q", index, logs[index].Action, action)
		}
		if logs[index].UserID != actorID {
			t.Errorf("log %d actor = %s, want %s", index, logs[index].UserID, actorID)
		}
		if logs[index].RecordID != item.ID.String() {
			t.Errorf("log %d record = %q, want %q", index, logs[index].RecordID, item.ID)
		}
	}

	var update auditChanges
	if err := json.Unmarshal([]byte(logs[1].Changes), &update); err != nil {
		t.Fatalf("decode update: %v", err)
	}
	nameChange, ok := update.ChangedColumns["name"]
	if !ok {
		t.Fatalf("name missing from changed columns: %s", logs[1].Changes)
	}
	if nameChange["before"] != "Before" || nameChange["after"] != "After" {
		t.Errorf("unexpected name diff: %#v", nameChange)
	}
	if update.Before["password"] != "[REDACTED]" || update.After["password"] != "[REDACTED]" {
		t.Errorf("password was not redacted")
	}
}
