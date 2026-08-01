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
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupStoreTestRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open store test database: %v", err)
	}
	if err := db.AutoMigrate(
		&sellingmodel.StoreCategory{}, &sellingmodel.StoreProduct{}, &sellingmodel.StoreCartItem{},
		&sellingmodel.StoreWishlistItem{}, &sellingmodel.StoreOrder{}, &sellingmodel.StoreOrderItem{},
	); err != nil {
		t.Fatalf("migrate store test database: %v", err)
	}
	coremodel.DB = db
	ctrl := NewStoreController()
	router := gin.New()
	router.Use(func(ctx *gin.Context) {
		ctx.Set("db", db)
		ctx.Set("tenant_id", "tenant-store-test")
		ctx.Set("id", "buyer-store-test")
		ctx.Next()
	})
	router.GET("/categories", ctrl.Categories)
	router.GET("/products", ctrl.Products)
	router.GET("/products/:slug", ctrl.Product)
	router.GET("/cart", ctrl.Cart)
	router.POST("/cart/:productID", ctrl.AddCart)
	router.GET("/wishlist", ctrl.Wishlist)
	router.POST("/wishlist/:productID", ctrl.AddWishlist)
	router.GET("/orders", ctrl.Orders)
	router.POST("/orders", ctrl.CreateOrder)
	return router
}

func storeRequest(t *testing.T, router http.Handler, method, path string, payload interface{}) *httptest.ResponseRecorder {
	t.Helper()
	var body bytes.Buffer
	if payload != nil {
		if err := json.NewEncoder(&body).Encode(payload); err != nil {
			t.Fatalf("encode request: %v", err)
		}
	}
	request := httptest.NewRequest(method, path, &body)
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

func TestStoreCatalogCartWishlistAndCheckout(t *testing.T) {
	router := setupStoreTestRouter(t)

	categories := storeRequest(t, router, http.MethodGet, "/categories", nil)
	if categories.Code != http.StatusOK {
		t.Fatalf("categories status = %d, body = %s", categories.Code, categories.Body.String())
	}

	productsResponse := storeRequest(t, router, http.MethodGet, "/products", nil)
	if productsResponse.Code != http.StatusOK {
		t.Fatalf("products status = %d, body = %s", productsResponse.Code, productsResponse.Body.String())
	}
	var productsEnvelope struct {
		Data []sellingmodel.StoreProduct `json:"data"`
	}
	if err := json.Unmarshal(productsResponse.Body.Bytes(), &productsEnvelope); err != nil {
		t.Fatalf("decode products: %v", err)
	}
	if len(productsEnvelope.Data) < 5 {
		t.Fatalf("expected seeded products, got %d", len(productsEnvelope.Data))
	}
	product := productsEnvelope.Data[0]

	detail := storeRequest(t, router, http.MethodGet, "/products/"+product.Slug, nil)
	if detail.Code != http.StatusOK {
		t.Fatalf("product detail status = %d, body = %s", detail.Code, detail.Body.String())
	}

	addCart := storeRequest(t, router, http.MethodPost, "/cart/"+product.ID, map[string]int{"quantity": 2})
	if addCart.Code != http.StatusOK {
		t.Fatalf("add cart status = %d, body = %s", addCart.Code, addCart.Body.String())
	}
	addWishlist := storeRequest(t, router, http.MethodPost, "/wishlist/"+product.ID, nil)
	if addWishlist.Code != http.StatusOK {
		t.Fatalf("add wishlist status = %d, body = %s", addWishlist.Code, addWishlist.Body.String())
	}

	orderResponse := storeRequest(t, router, http.MethodPost, "/orders", map[string]string{
		"payment_method": "GoPay",
		"address":        "Jl. Integrasi API No. 1, Jakarta",
	})
	if orderResponse.Code != http.StatusCreated {
		t.Fatalf("create order status = %d, body = %s", orderResponse.Code, orderResponse.Body.String())
	}

	cart := storeRequest(t, router, http.MethodGet, "/cart", nil)
	var cartEnvelope struct {
		Data []sellingmodel.StoreCartItem `json:"data"`
	}
	if err := json.Unmarshal(cart.Body.Bytes(), &cartEnvelope); err != nil {
		t.Fatalf("decode cart: %v", err)
	}
	if len(cartEnvelope.Data) != 0 {
		t.Fatalf("cart should be empty after checkout, got %d items", len(cartEnvelope.Data))
	}

	orders := storeRequest(t, router, http.MethodGet, "/orders", nil)
	var ordersEnvelope struct {
		Data []sellingmodel.StoreOrder `json:"data"`
	}
	if err := json.Unmarshal(orders.Body.Bytes(), &ordersEnvelope); err != nil {
		t.Fatalf("decode orders: %v", err)
	}
	if len(ordersEnvelope.Data) != 1 || len(ordersEnvelope.Data[0].Items) != 1 {
		t.Fatalf("expected one persisted order with one item, got %+v", ordersEnvelope.Data)
	}
}
