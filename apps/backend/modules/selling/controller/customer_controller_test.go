package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	coremodel "gin-template/model"
	sellingmodel "gin-template/modules/selling/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupCustomerTestRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	if err := db.AutoMigrate(&sellingmodel.Customer{}); err != nil {
		t.Fatalf("migrate database: %v", err)
	}
	coremodel.DB = db
	controller := NewCustomerController()
	router := gin.New()
	router.Use(func(ctx *gin.Context) {
		ctx.Set("db", db)
		ctx.Set("tenant_id", "tenant-customer-test")
		ctx.Next()
	})
	router.GET("/selling/customers", controller.List)
	router.GET("/selling/customers/:id", controller.Get)
	router.POST("/selling/customers", controller.Create)
	router.PUT("/selling/customers/:id", controller.Update)
	router.DELETE("/selling/customers/:id", controller.Delete)
	return router, db
}

func TestCustomerSingleDefaultForPOSConstraint(t *testing.T) {
	router, db := setupCustomerTestRouter(t)

	// 1. Create first customer with is_default_for_pos = true
	cust1Body, _ := json.Marshal(map[string]interface{}{
		"customer_name":      "Customer POS 1",
		"is_default_for_pos": true,
	})
	req1 := httptest.NewRequest(http.MethodPost, "/selling/customers", bytes.NewReader(cust1Body))
	req1.Header.Set("Content-Type", "application/json")
	w1 := httptest.NewRecorder()
	router.ServeHTTP(w1, req1)
	if w1.Code != http.StatusCreated {
		t.Fatalf("create cust1 failed with status %d: %s", w1.Code, w1.Body.String())
	}
	var cust1 sellingmodel.Customer
	_ = json.Unmarshal(w1.Body.Bytes(), &cust1)
	if !cust1.IsDefaultForPOS {
		t.Fatalf("expected cust1 to have is_default_for_pos = true")
	}

	// 2. Create second customer with is_default_for_pos = true
	cust2Body, _ := json.Marshal(map[string]interface{}{
		"customer_name":      "Customer POS 2",
		"is_default_for_pos": true,
	})
	req2 := httptest.NewRequest(http.MethodPost, "/selling/customers", bytes.NewReader(cust2Body))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)
	if w2.Code != http.StatusCreated {
		t.Fatalf("create cust2 failed with status %d: %s", w2.Code, w2.Body.String())
	}

	// Verify only cust2 is true, and cust1 is now false
	var countDefault int64
	db.Model(&sellingmodel.Customer{}).Where("is_default_for_pos = ?", true).Count(&countDefault)
	if countDefault != 1 {
		t.Fatalf("expected exactly 1 default customer, got %d", countDefault)
	}

	var dbCust1, dbCust2 sellingmodel.Customer
	db.First(&dbCust1, "id = ?", cust1.ID)
	db.First(&dbCust2, "customer_name = ?", "Customer POS 2")
	if dbCust1.IsDefaultForPOS {
		t.Fatalf("expected cust1 to have is_default_for_pos = false now")
	}
	if !dbCust2.IsDefaultForPOS {
		t.Fatalf("expected cust2 to have is_default_for_pos = true")
	}

	// 3. Update cust1 back to is_default_for_pos = true
	dbCust1.IsDefaultForPOS = true
	updateBody, _ := json.Marshal(dbCust1)
	req3 := httptest.NewRequest(http.MethodPut, "/selling/customers/"+dbCust1.ID, bytes.NewReader(updateBody))
	req3.Header.Set("Content-Type", "application/json")
	w3 := httptest.NewRecorder()
	router.ServeHTTP(w3, req3)
	if w3.Code != http.StatusOK {
		t.Fatalf("update cust1 failed with status %d: %s", w3.Code, w3.Body.String())
	}

	// Verify only cust1 is now true, and cust2 is now false
	db.Model(&sellingmodel.Customer{}).Where("is_default_for_pos = ?", true).Count(&countDefault)
	if countDefault != 1 {
		t.Fatalf("expected exactly 1 default customer after update, got %d", countDefault)
	}

	db.First(&dbCust1, "id = ?", cust1.ID)
	db.First(&dbCust2, "id = ?", dbCust2.ID)
	if !dbCust1.IsDefaultForPOS {
		t.Fatalf("expected cust1 to have is_default_for_pos = true after update")
	}
	if dbCust2.IsDefaultForPOS {
		t.Fatalf("expected cust2 to have is_default_for_pos = false after cust1 updated to default")
	}
}
