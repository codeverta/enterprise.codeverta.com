package crm

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"gin-template/middleware"
	crmmodel "gin-template/model/crm"
	sellingmodel "gin-template/modules/selling/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestSuccessfulSalesOrderCreatesLoyaltyPointEntry(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:crm_sales_order_loyalty?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := crmmodel.Migrate(db); err != nil {
		t.Fatal(err)
	}
	if err := sellingmodel.Migrate(db); err != nil {
		t.Fatal(err)
	}
	middleware.RegisterTenantPlugin(db)

	tenantID := uuid.New()
	tenant := tenantID.String()
	customer := sellingmodel.Customer{
		ID: "cust-sales-order-loyalty", TenantID: tenant, CustomerName: "Sales Order Loyal Customer",
		CustomerGroup: "Retail", Territory: "Indonesia",
	}
	program := sellingmodel.LoyaltyProgram{
		ID: "lp-sales-order-loyalty", TenantID: tenant, LoyaltyProgramName: "Sales Order Rewards",
		CustomerGroup: "Retail", CustomerTerritory: "Indonesia", AutoOptIn: true,
		CollectionRules: []sellingmodel.CollectionRule{{ID: "rule-sales-order", TierName: "Default", CollectionFactor: 10000}},
	}
	for _, value := range []interface{}{&customer, &program} {
		if err := db.Create(value).Error; err != nil {
			t.Fatal(err)
		}
	}

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("db", db.Session(&gorm.Session{}).Set("tenant_id", tenant))
		c.Set("userID", uuid.New())
		c.Next()
	})
	router.POST("/crm/:resource", NewController().Create)

	request := httptest.NewRequest(http.MethodPost, "/crm/sales-orders", strings.NewReader(`{
		"order_number":"SO-LOYALTY-001",
		"company":"PT ZENIT TECHNOLOGY SOLUTION",
		"customer":"Sales Order Loyal Customer",
		"transaction_date":"`+time.Now().Format(time.RFC3339)+`",
		"currency":"IDR",
		"total_amount":75000,
		"status":"confirmed"
	}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusCreated {
		t.Fatalf("sales order create status=%d body=%s", response.Code, response.Body.String())
	}

	var entries []sellingmodel.LoyaltyPointEntry
	if err := db.Set("tenant_id", tenant).Where("tenant_id = ?", tenant).Find(&entries).Error; err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 || entries[0].LoyaltyPoints != 7 || entries[0].ReferenceType != "Sales Order" || entries[0].SalesInvoice != "SO-LOYALTY-001" {
		t.Fatalf("unexpected sales order loyalty entries: %+v", entries)
	}
}
