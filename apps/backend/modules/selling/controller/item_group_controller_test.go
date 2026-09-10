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

func setupItemGroupTestRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	if err := db.AutoMigrate(&sellingmodel.ItemGroup{}); err != nil {
		t.Fatalf("migrate database: %v", err)
	}
	coremodel.DB = db
	controller := NewItemGroupController()
	router := gin.New()
	router.Use(func(ctx *gin.Context) {
		ctx.Set("db", db)
		ctx.Set("tenant_id", "tenant-item-group-test")
		ctx.Next()
	})
	router.GET("/selling/item-groups/tree", controller.Tree)
	router.GET("/selling/item-groups", controller.List)
	router.GET("/selling/item-groups/:id", controller.Get)
	router.POST("/selling/item-groups", controller.Create)
	router.PUT("/selling/item-groups/:id", controller.Update)
	router.DELETE("/selling/item-groups/:id", controller.Delete)
	return router, db
}

func itemGroupRequest(t *testing.T, router *gin.Engine, method, path string, payload interface{}) *httptest.ResponseRecorder {
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

func TestItemGroupTreeAndCRUD(t *testing.T) {
	router, _ := setupItemGroupTestRouter(t)

	// 1. Initial tree query triggers auto-seeding of All Item Groups and 5 standard children
	treeRes := itemGroupRequest(t, router, http.MethodGet, "/selling/item-groups/tree", nil)
	if treeRes.Code != http.StatusOK {
		t.Fatalf("tree status = %d, body = %s", treeRes.Code, treeRes.Body.String())
	}
	var treeBody struct {
		Data []ItemGroupTreeNode `json:"data"`
	}
	if err := json.Unmarshal(treeRes.Body.Bytes(), &treeBody); err != nil {
		t.Fatalf("unmarshal tree: %v", err)
	}
	if len(treeBody.Data) == 0 {
		t.Fatalf("expected tree root, got empty")
	}
	root := treeBody.Data[0]
	if root.ItemGroupName != "All Item Groups" || !root.IsGroup {
		t.Fatalf("unexpected root: %+v", root)
	}
	if len(root.Children) != 5 {
		t.Fatalf("expected 5 children under All Item Groups, got %d", len(root.Children))
	}

	// 2. Reject creating sub-group under non-group parent
	failPayload := map[string]interface{}{
		"item_group_name":   "Electronics",
		"parent_item_group": "Products", // Products is is_group = false initially
		"is_group":          false,
	}
	failRes := itemGroupRequest(t, router, http.MethodPost, "/selling/item-groups", failPayload)
	if failRes.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 when parent is not a group, got %d", failRes.Code)
	}

	// 3. Update 'Products' to is_group = true
	var listRes struct {
		Data []sellingmodel.ItemGroup `json:"data"`
	}
	lRes := itemGroupRequest(t, router, http.MethodGet, "/selling/item-groups?q=Products", nil)
	_ = json.Unmarshal(lRes.Body.Bytes(), &listRes)
	var productsID string
	for _, it := range listRes.Data {
		if it.ItemGroupName == "Products" {
			productsID = it.ID
			break
		}
	}
	if productsID == "" {
		t.Fatalf("Products group ID not found")
	}

	updateProductsPayload := map[string]interface{}{
		"item_group_name":   "Products",
		"parent_item_group": "All Item Groups",
		"is_group":          true,
	}
	updRes := itemGroupRequest(t, router, http.MethodPut, "/selling/item-groups/"+productsID, updateProductsPayload)
	if updRes.Code != http.StatusOK {
		t.Fatalf("update Products to group failed: %s", updRes.Body.String())
	}

	// 4. Now create 'Electronics' under 'Products'
	okPayload := map[string]interface{}{
		"item_group_name":   "Electronics",
		"parent_item_group": "Products",
		"is_group":          false,
	}
	okRes := itemGroupRequest(t, router, http.MethodPost, "/selling/item-groups", okPayload)
	if okRes.Code != http.StatusCreated {
		t.Fatalf("create Electronics status = %d, body = %s", okRes.Code, okRes.Body.String())
	}
	var created sellingmodel.ItemGroup
	_ = json.Unmarshal(okRes.Body.Bytes(), &created)

	// 5. Delete newly created leaf node
	delRes := itemGroupRequest(t, router, http.MethodDelete, "/selling/item-groups/"+created.ID, nil)
	if delRes.Code != http.StatusOK {
		t.Fatalf("delete Electronics failed: %s", delRes.Body.String())
	}
}
