package controller

import (
	"testing"
	"time"

	"gin-template/model"
)

func TestEnsureAIUsageUsesJakartaCalendarDateAndIsIdempotent(t *testing.T) {
	db, tenant := setupControllerTestDB(t)
	if err := db.AutoMigrate(&model.UserAppPreference{}, &model.AIChatDailyUsage{}); err != nil {
		t.Fatalf("migrate app preference models: %v", err)
	}

	scopedDB := tenantScopedDB(db, tenant)
	userID := tenant.ID                                           // A stable UUID is sufficient; these tables do not have a user FK.
	now := time.Date(2026, time.July, 20, 19, 15, 0, 0, time.UTC) // 21 July in Jakarta.

	first, _, err := ensureAIUsage(scopedDB, userID, now)
	if err != nil {
		t.Fatalf("first ensure usage: %v", err)
	}
	if got := first.UsageDate.Format("2006-01-02"); got != "2026-07-21" {
		t.Fatalf("usage date = %s, want Jakarta calendar date 2026-07-21", got)
	}

	second, _, err := ensureAIUsage(scopedDB, userID, now)
	if err != nil {
		t.Fatalf("second ensure usage: %v", err)
	}
	if second.ID != first.ID {
		t.Fatalf("ensure created a duplicate row: first=%s second=%s", first.ID, second.ID)
	}

	if err := scopedDB.Delete(&second).Error; err != nil {
		t.Fatalf("soft delete usage: %v", err)
	}
	restored, _, err := ensureAIUsage(scopedDB, userID, now)
	if err != nil {
		t.Fatalf("restore soft-deleted usage: %v", err)
	}
	if restored.ID != first.ID || restored.DeletedAt.Valid {
		t.Fatalf("soft-deleted usage was not restored")
	}
}
