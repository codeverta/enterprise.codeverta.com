package controller

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	coremodel "gin-template/model"
	buyingmodel "gin-template/modules/buying/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupMasterDataTestRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open master data test database: %v", err)
	}
	if err := db.AutoMigrate(
		&buyingmodel.Item{},
		&buyingmodel.ItemUOM{},
		&buyingmodel.ItemBarcode{},
		&buyingmodel.ItemReorderLevel{},
		&buyingmodel.ItemSupplier{},
	); err != nil {
		t.Fatalf("migrate master data test database: %v", err)
	}

	tenantID := uuid.New()
	tenantDB := db.Set("tenant_id", tenantID.String())
	coremodel.DB = tenantDB
	ctrl := NewMasterDataController()
	router := gin.New()
	router.Use(func(ctx *gin.Context) {
		ctx.Set("db", tenantDB)
		ctx.Set("tenant_id", tenantID.String())
		ctx.Next()
	})
	router.GET("/items", ctrl.ItemList)
	router.POST("/items", ctrl.ItemCreate)
	router.GET("/items/:id", ctrl.ItemGet)
	router.PUT("/items/:id", ctrl.ItemUpdate)
	router.DELETE("/items/:id", ctrl.ItemDelete)
	return router, db
}

func masterDataRequest(t *testing.T, router http.Handler, method, path string, payload interface{}) *httptest.ResponseRecorder {
	t.Helper()
	var body bytes.Buffer
	if payload != nil {
		if err := json.NewEncoder(&body).Encode(payload); err != nil {
			t.Fatalf("encode master data request: %v", err)
		}
	}
	request := httptest.NewRequest(method, path, &body)
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

func TestItemCRUDUsesSoftDelete(t *testing.T) {
	router, db := setupMasterDataTestRouter(t)
	payload := map[string]interface{}{
		"item_code": "ITEM-CRUD-001", "item_name": "Item CRUD", "item_group": "Products", "stock_uom": "Pcs",
		"is_stock_item": true, "is_purchase_item": true, "standard_rate": 12500, "image_url": "erp/items/example.webp",
		"uoms":     []map[string]interface{}{{"uom": "Box", "conversion_factor": 12}},
		"barcodes": []map[string]interface{}{{"barcode": "899000000001", "barcode_type": "EAN", "uom": "Pcs"}},
	}

	createdResponse := masterDataRequest(t, router, http.MethodPost, "/items", payload)
	if createdResponse.Code != http.StatusCreated {
		t.Fatalf("create item status = %d, body = %s", createdResponse.Code, createdResponse.Body.String())
	}
	var created buyingmodel.Item
	if err := json.Unmarshal(createdResponse.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode created item: %v", err)
	}
	if created.ID == uuid.Nil || created.ImageURL != "erp/items/example.webp" || len(created.UOMs) != 1 || len(created.Barcodes) != 1 {
		t.Fatalf("created item or children incomplete: %+v", created)
	}

	listResponse := masterDataRequest(t, router, http.MethodGet, "/items?q=CRUD", nil)
	if listResponse.Code != http.StatusOK || !bytes.Contains(listResponse.Body.Bytes(), []byte("ITEM-CRUD-001")) {
		t.Fatalf("list item status = %d, body = %s", listResponse.Code, listResponse.Body.String())
	}

	payload["item_name"] = "Item CRUD Updated"
	updatedResponse := masterDataRequest(t, router, http.MethodPut, "/items/"+created.ID.String(), payload)
	if updatedResponse.Code != http.StatusOK || !bytes.Contains(updatedResponse.Body.Bytes(), []byte("Item CRUD Updated")) {
		t.Fatalf("update item status = %d, body = %s", updatedResponse.Code, updatedResponse.Body.String())
	}

	deleteResponse := masterDataRequest(t, router, http.MethodDelete, "/items/"+created.ID.String(), nil)
	if deleteResponse.Code != http.StatusNoContent {
		t.Fatalf("delete item status = %d, body = %s", deleteResponse.Code, deleteResponse.Body.String())
	}

	getDeletedResponse := masterDataRequest(t, router, http.MethodGet, "/items/"+created.ID.String(), nil)
	if getDeletedResponse.Code != http.StatusNotFound {
		t.Fatalf("get deleted item status = %d, body = %s", getDeletedResponse.Code, getDeletedResponse.Body.String())
	}
	listDeletedResponse := masterDataRequest(t, router, http.MethodGet, "/items?q=CRUD", nil)
	if listDeletedResponse.Code != http.StatusOK || bytes.Contains(listDeletedResponse.Body.Bytes(), []byte("ITEM-CRUD-001")) {
		t.Fatalf("soft-deleted item still appears in list: %s", listDeletedResponse.Body.String())
	}

	var archived buyingmodel.Item
	if err := db.Unscoped().First(&archived, "id = ?", created.ID).Error; err != nil {
		t.Fatalf("find soft-deleted item with unscoped query: %v", err)
	}
	if !archived.DeletedAt.Valid {
		t.Fatal("expected deleted_at to be set after deleting item")
	}
}

func TestItemImageUploadReturnsStoredObjectKey(t *testing.T) {
	gin.SetMode(gin.TestMode)
	controller := &MasterDataController{
		UploadItemImage: func(_ multipart.File, header *multipart.FileHeader) (string, error) {
			if header.Filename != "product.png" {
				t.Fatalf("unexpected uploaded filename: %s", header.Filename)
			}
			return "erp/items/product.webp", nil
		},
	}
	router := gin.New()
	router.POST("/items/upload-image", controller.ItemImageUpload)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "product.png")
	if err != nil {
		t.Fatalf("create multipart file: %v", err)
	}
	if _, err := part.Write([]byte("fake-image")); err != nil {
		t.Fatalf("write multipart file: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	request := httptest.NewRequest(http.MethodPost, "/items/upload-image", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(`"image_url":"erp/items/product.webp"`)) {
		t.Fatalf("upload image status = %d, body = %s", response.Code, response.Body.String())
	}
}
