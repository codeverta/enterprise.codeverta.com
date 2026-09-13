package tenancy

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type resolverStub struct{ records map[string]Record }

func (r resolverStub) ResolveByHost(_ context.Context, host string) (Record, error) {
	normalized, err := NormalizeHost(host)
	if err != nil {
		return Record{}, err
	}
	record, ok := r.records[normalized]
	if !ok {
		return Record{}, ErrTenantNotFound
	}
	return record, nil
}
func (r resolverStub) ResolveByID(_ context.Context, id string) (Record, error) {
	for _, record := range r.records {
		if record.ID.String() == id {
			return record, nil
		}
	}
	return Record{}, ErrTenantNotFound
}
func (resolverStub) Invalidate(string) {}

func testTenantMiddleware(t *testing.T, records map[string]Record) (*Middleware, *DatabaseManager) {
	t.Helper()
	cipher := testCipher(t)
	for host, record := range records {
		if record.DatabasePasswordEncrypted == "" {
			record.DatabasePasswordEncrypted, _ = cipher.Encrypt("secret")
			record.DatabaseDriver = "mysql"
			record.PrimaryDomain = host
			records[host] = record
		}
	}
	manager := NewDatabaseManagerWithOpener(cipher, PoolConfig{}, func(record Record, _ string) (*gorm.DB, error) {
		return gorm.Open(sqlite.Open("file:"+record.ID.String()+"?mode=memory&cache=shared"), &gorm.Config{})
	})
	return NewMiddleware(resolverStub{records: records}, manager), manager
}

func TestMiddlewareResolvesHostAndRejectsUnknown(t *testing.T) {
	gin.SetMode(gin.TestMode)
	alphaID := uuid.New()
	middleware, manager := testTenantMiddleware(t, map[string]Record{
		"alpha.erp.example.com": {ID: alphaID, Slug: "alpha", Status: StatusActive},
	})
	t.Cleanup(manager.Close)
	router := gin.New()
	router.Use(middleware.Resolve())
	router.GET("/resource", func(c *gin.Context) {
		tenant, ok := FromContext(c.Request.Context())
		if !ok {
			c.Status(500)
			return
		}
		c.String(200, tenant.ID.String())
	})

	request := httptest.NewRequest(http.MethodGet, "/resource", nil)
	request.Host = "alpha.erp.example.com"
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != 200 || response.Body.String() != alphaID.String() {
		t.Fatalf("valid host: status=%d body=%s", response.Code, response.Body.String())
	}

	request = httptest.NewRequest(http.MethodGet, "/resource", nil)
	request.Host = "unknown.erp.example.com"
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != 404 {
		t.Fatalf("unknown host returned %d", response.Code)
	}
}

func TestReadOnlyTenantRejectsMutationButAllowsLogin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	middleware, manager := testTenantMiddleware(t, map[string]Record{
		"readonly.erp.example.com": {ID: uuid.New(), Slug: "readonly", Status: StatusReadOnly},
	})
	t.Cleanup(manager.Close)
	router := gin.New()
	router.Use(middleware.Resolve())
	router.POST("/api/invoices", func(c *gin.Context) { c.Status(204) })
	router.POST("/api/auth/login", func(c *gin.Context) { c.Status(204) })

	for route, expected := range map[string]int{"/api/invoices": 403, "/api/auth/login": 204} {
		request := httptest.NewRequest(http.MethodPost, route, nil)
		request.Host = "readonly.erp.example.com"
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		if response.Code != expected {
			t.Fatalf("%s returned %d, want %d", route, response.Code, expected)
		}
	}
}

func TestJWTBindingCannotCrossTenant(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tenantID := uuid.New()
	db, _ := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Request = c.Request.WithContext(WithScope(c.Request.Context(), Context{ID: tenantID}, db))
		c.Set("jwt_tenant_id", uuid.NewString())
		c.Next()
	}, RequireJWTBinding())
	router.GET("/", func(c *gin.Context) { c.Status(204) })
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/", nil))
	if response.Code != 403 {
		t.Fatalf("cross-tenant JWT returned %d", response.Code)
	}
}
