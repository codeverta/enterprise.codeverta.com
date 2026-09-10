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

func setupTerritoryTestRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	if err := db.AutoMigrate(&sellingmodel.Territory{}, &sellingmodel.TerritoryTarget{}); err != nil {
		t.Fatalf("migrate database: %v", err)
	}
	coremodel.DB = db
	controller := NewTerritoryController()
	router := gin.New()
	router.Use(func(ctx *gin.Context) {
		ctx.Set("db", db)
		ctx.Set("tenant_id", "tenant-territory-test")
		ctx.Next()
	})
	router.GET("/selling/territories", controller.List)
	router.GET("/selling/territories/options", controller.Options)
	router.GET("/selling/territories/tree", controller.Tree)
	router.GET("/selling/territories/:id", controller.Get)
	router.POST("/selling/territories", controller.Create)
	router.PUT("/selling/territories/:id", controller.Update)
	router.DELETE("/selling/territories/:id", controller.Delete)
	return router, db
}

func territoryRequest(t *testing.T, router *gin.Engine, method, path string, payload interface{}) *httptest.ResponseRecorder {
	t.Helper()
	var body bytes.Buffer
	if payload != nil {
		if err := json.NewEncoder(&body).Encode(payload); err != nil {
			t.Fatalf("encode payload: %v", err)
		}
	}
	req, err := http.NewRequest(method, path, &body)
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	return recorder
}

func TestTerritoryCRUDAndTargets(t *testing.T) {
	router, _ := setupTerritoryTestRouter(t)

	// 1. Initial list triggers auto-seeding of All Territories & Indonesia
	listRes := territoryRequest(t, router, http.MethodGet, "/selling/territories", nil)
	if listRes.Code != http.StatusOK {
		t.Fatalf("list status = %d, body = %s", listRes.Code, listRes.Body.String())
	}
	var listBody struct {
		Data []sellingmodel.Territory `json:"data"`
	}
	if err := json.Unmarshal(listRes.Body.Bytes(), &listBody); err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if len(listBody.Data) < 2 {
		t.Fatalf("expected seeded territories >= 2, got %d", len(listBody.Data))
	}

	// 2. Create new child territory with targets
	createPayload := map[string]interface{}{
		"territory_name":    "Jakarta Selatan",
		"parent_territory":  "Indonesia",
		"is_group":          false,
		"territory_manager": "budi.santoso",
		"disabled":          false,
		"targets": []map[string]interface{}{
			{
				"item_group":          "Products",
				"fiscal_year":         "2026",
				"target_qty":          500,
				"target_amount":       75000000,
				"target_distribution": "Even",
			},
		},
	}
	createRes := territoryRequest(t, router, http.MethodPost, "/selling/territories", createPayload)
	if createRes.Code != http.StatusCreated {
		t.Fatalf("create status = %d, body = %s", createRes.Code, createRes.Body.String())
	}
	var created sellingmodel.Territory
	if err := json.Unmarshal(createRes.Body.Bytes(), &created); err != nil {
		t.Fatalf("unmarshal created: %v", err)
	}
	if created.TerritoryName != "Jakarta Selatan" || len(created.Targets) != 1 {
		t.Fatalf("unexpected created territory: %+v", created)
	}
	if created.Targets[0].TargetAmount != 75000000 {
		t.Fatalf("unexpected target amount: %v", created.Targets[0].TargetAmount)
	}

	// 3. Get by ID
	getRes := territoryRequest(t, router, http.MethodGet, "/selling/territories/"+created.ID, nil)
	if getRes.Code != http.StatusOK {
		t.Fatalf("get status = %d, body = %s", getRes.Code, getRes.Body.String())
	}

	// 4. Update territory
	updatePayload := map[string]interface{}{
		"territory_name":    "Jakarta Selatan Updated",
		"parent_territory":  "Indonesia",
		"is_group":          false,
		"territory_manager": "budi.santoso",
		"disabled":          false,
		"targets": []map[string]interface{}{
			{
				"item_group":          "Products",
				"fiscal_year":         "2026",
				"target_qty":          600,
				"target_amount":       90000000,
				"target_distribution": "Quarterly",
			},
			{
				"item_group":          "Raw Material",
				"fiscal_year":         "2026",
				"target_qty":          200,
				"target_amount":       20000000,
				"target_distribution": "Even",
			},
		},
	}
	updateRes := territoryRequest(t, router, http.MethodPut, "/selling/territories/"+created.ID, updatePayload)
	if updateRes.Code != http.StatusOK {
		t.Fatalf("update status = %d, body = %s", updateRes.Code, updateRes.Body.String())
	}
	var updated sellingmodel.Territory
	if err := json.Unmarshal(updateRes.Body.Bytes(), &updated); err != nil {
		t.Fatalf("unmarshal updated: %v", err)
	}
	if updated.TerritoryName != "Jakarta Selatan Updated" || len(updated.Targets) != 2 {
		t.Fatalf("unexpected updated territory: %+v", updated)
	}

	// 5. Check tree endpoint
	treeRes := territoryRequest(t, router, http.MethodGet, "/selling/territories/tree", nil)
	if treeRes.Code != http.StatusOK {
		t.Fatalf("tree status = %d, body = %s", treeRes.Code, treeRes.Body.String())
	}

	// 6. Delete territory
	delRes := territoryRequest(t, router, http.MethodDelete, "/selling/territories/"+created.ID, nil)
	if delRes.Code != http.StatusOK {
		t.Fatalf("delete status = %d, body = %s", delRes.Code, delRes.Body.String())
	}
}
