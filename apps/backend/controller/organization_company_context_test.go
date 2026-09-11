package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"gin-template/common"
	"gin-template/model"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func companyContextTestDB(t *testing.T) (*gorm.DB, model.Tenant) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Tenant{}, &model.Company{}, &model.UserAppPreference{}, &model.UserCompanyUsage{}))
	tenant := model.Tenant{ID: uuid.New(), Name: "Test " + uuid.NewString(), Domain: uuid.NewString() + ".test", IsActive: true}
	require.NoError(t, db.Create(&tenant).Error)
	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)
	return db.WithContext(ctx), tenant
}

func contextRequest(t *testing.T, db *gorm.DB, tenant model.Tenant, userID uuid.UUID, method, path string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var payload *bytes.Reader
	if body == nil {
		payload = bytes.NewReader(nil)
	} else {
		raw, err := json.Marshal(body)
		require.NoError(t, err)
		payload = bytes.NewReader(raw)
	}
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	recorder := httptest.NewRecorder()
	c, _ = gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(method, path, payload)
	c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), common.CtxTenantKey, tenant))
	c.Set("db", db)
	c.Set("id", userID)
	c.Set(common.CtxTenantKey, tenant)
	controller := NewOrganizationController(db)
	if method == http.MethodGet {
		controller.GetCompanyContext(c)
	} else {
		controller.SelectCompany(c)
	}
	return recorder
}

func TestCompanyContextIsPerUserAndPromotesMostUsedCompany(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, tenant := companyContextTestDB(t)
	companyA := model.Company{ID: uuid.New(), TenantID: tenant.ID, Name: "Company A", Abbreviation: "A", Currency: "IDR", IsActive: true}
	companyB := model.Company{ID: uuid.New(), TenantID: tenant.ID, Name: "Company B", Abbreviation: "B", Currency: "IDR", IsActive: true}
	require.NoError(t, db.Create(&companyA).Error)
	require.NoError(t, db.Create(&companyB).Error)

	userA, userB := uuid.New(), uuid.New()
	for i := 0; i < 3; i++ {
		response := contextRequest(t, db, tenant, userA, http.MethodPost, "/company-context/select", map[string]any{"company_id": companyB.ID})
		require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	}
	response := contextRequest(t, db, tenant, userB, http.MethodPost, "/company-context/select", map[string]any{"company_id": companyA.ID})
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())

	var preferenceA, preferenceB model.UserAppPreference
	require.NoError(t, db.Where("user_id = ?", userA).First(&preferenceA).Error)
	require.NoError(t, db.Where("user_id = ?", userB).First(&preferenceB).Error)
	require.Equal(t, companyB.ID, *preferenceA.ActiveCompanyID)
	require.Equal(t, companyA.ID, *preferenceB.ActiveCompanyID)

	var usage model.UserCompanyUsage
	require.NoError(t, db.Where("user_id = ? AND company_id = ?", userA, companyB.ID).First(&usage).Error)
	require.Equal(t, uint64(3), usage.SelectionCount)
}

func TestCompanyContextDefaultsToAnActiveCompany(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, tenant := companyContextTestDB(t)
	inactive := model.Company{ID: uuid.New(), TenantID: tenant.ID, Name: "Archived", Abbreviation: "OLD", IsActive: false}
	active := model.Company{ID: uuid.New(), TenantID: tenant.ID, Name: "Current", Abbreviation: "CUR", IsActive: true}
	require.NoError(t, db.Create(&inactive).Error)
	require.NoError(t, db.Model(&inactive).Update("is_active", false).Error)
	require.NoError(t, db.Create(&active).Error)

	userID := uuid.New()
	response := contextRequest(t, db, tenant, userID, http.MethodGet, "/company-context", nil)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	var preference model.UserAppPreference
	require.NoError(t, db.Where("user_id = ?", userID).First(&preference).Error)
	require.Equal(t, active.ID, *preference.ActiveCompanyID)
}
