package controller

import (
	"context"
	"gin-template/common"
	"gin-template/model"
	"testing"

	"github.com/google/uuid"
)

func TestSaveExternalTeacherProfilePersistsVerificationFields(t *testing.T) {
	_, db, tenant, _ := setupLMSControllerTest(t)
	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)
	user := model.User{
		ID: uuid.New(), Username: "external-teacher", Email: "external@example.com",
		DisplayName: "Guru Eksternal", Password: "hashed-for-test", Role: model.RoleGuruExternal,
		Status: common.UserStatusEnabled, TenantID: &tenant.ID,
	}
	if err := db.WithContext(ctx).Create(&user).Error; err != nil {
		t.Fatalf("create external teacher: %v", err)
	}

	declaration := true
	input := adminUserMutationInput{
		City: "Bandung", Institution: "SMA KITA", TeachingStatus: "Guru Aktif",
		Simpkb: "SIM-123", Nuptk: "NUPTK-456", Gtk: "GTK-789", Declaration: &declaration,
	}
	if err := saveExternalTeacherProfile(db.WithContext(ctx), &user, input); err != nil {
		t.Fatalf("save external teacher profile: %v", err)
	}

	var profile model.Profile
	if err := db.First(&profile, "user_id = ?", user.ID).Error; err != nil {
		t.Fatalf("load profile: %v", err)
	}
	metadata := jsonMetadata(profile.Metadata)
	verification, ok := metadata["teacher_verification"].(map[string]interface{})
	if !ok {
		t.Fatalf("teacher verification metadata missing: %+v", metadata)
	}
	if verification["city"] != "Bandung" || verification["institution"] != "SMA KITA" {
		t.Fatalf("unexpected verification metadata: %+v", verification)
	}
	if declarationValue, ok := verification["declaration"].(bool); !ok || !declarationValue {
		t.Fatalf("expected accepted declaration, got %+v", verification["declaration"])
	}
}
