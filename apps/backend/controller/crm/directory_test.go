package crm

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"gin-template/middleware"
	crmmodel "gin-template/model/crm"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestDirectoryAccountContactTagsAndInteractions(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:crm_directory?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := crmmodel.Migrate(db); err != nil {
		t.Fatal(err)
	}
	middleware.RegisterTenantPlugin(db)
	tenantID, actor := uuid.New(), uuid.New()
	handler := NewController()
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("db", db.Session(&gorm.Session{}).Set("tenant_id", tenantID.String()))
		c.Set("userID", actor)
		c.Next()
	})
	router.POST("/crm/directory/accounts", handler.CreateAccount)
	router.GET("/crm/directory/accounts", handler.ListAccounts)
	router.POST("/crm/directory/contacts", handler.CreateContact)
	router.GET("/crm/directory/contacts", handler.ListContacts)
	router.POST("/crm/directory/:kind/:id/interactions", handler.CreateInteraction)
	router.GET("/crm/directory/:kind/:id/interactions", handler.ListInteractions)

	parent := performDirectoryRequest(t, router, http.MethodPost, "/crm/directory/accounts", `{"name":"Zenit Group","industry":"Technology","company_size":"enterprise","region":"Jakarta","tags":["Priority","Partner"]}`)
	if parent.Code != http.StatusCreated {
		t.Fatalf("create account status=%d body=%s", parent.Code, parent.Body.String())
	}
	var account accountView
	if err := json.Unmarshal(parent.Body.Bytes(), &account); err != nil {
		t.Fatal(err)
	}
	if account.ID == uuid.Nil || len(account.Tags) != 2 {
		t.Fatalf("unexpected account response: %#v", account)
	}

	contactBody := fmt.Sprintf(`{"first_name":"Budi","last_name":"Utomo","account_id":"%s","email":"budi@example.com","tags":["Decision Maker"]}`, account.ID)
	contact := performDirectoryRequest(t, router, http.MethodPost, "/crm/directory/contacts", contactBody)
	if contact.Code != http.StatusCreated {
		t.Fatalf("create contact status=%d body=%s", contact.Code, contact.Body.String())
	}
	var createdContact contactView
	if err := json.Unmarshal(contact.Body.Bytes(), &createdContact); err != nil {
		t.Fatal(err)
	}
	if createdContact.AccountName != "Zenit Group" || len(createdContact.Tags) != 1 {
		t.Fatalf("unexpected contact response: %#v", createdContact)
	}

	interaction := performDirectoryRequest(t, router, http.MethodPost, fmt.Sprintf("/crm/directory/contacts/%s/interactions", createdContact.ID), `{"type":"meeting","subject":"Product demo","status":"completed"}`)
	if interaction.Code != http.StatusCreated {
		t.Fatalf("create interaction status=%d body=%s", interaction.Code, interaction.Body.String())
	}
	history := performDirectoryRequest(t, router, http.MethodGet, fmt.Sprintf("/crm/directory/contacts/%s/interactions", createdContact.ID), "")
	if history.Code != http.StatusOK {
		t.Fatalf("history status=%d body=%s", history.Code, history.Body.String())
	}
	var activities []crmmodel.Activity
	if err := json.Unmarshal(history.Body.Bytes(), &activities); err != nil {
		t.Fatal(err)
	}
	if len(activities) != 1 || activities[0].Subject != "Product demo" {
		t.Fatalf("unexpected history: %#v", activities)
	}

	list := performDirectoryRequest(t, router, http.MethodGet, "/crm/directory/accounts?tag=Priority", "")
	if list.Code != http.StatusOK {
		t.Fatalf("account list status=%d body=%s", list.Code, list.Body.String())
	}
	var result struct {
		Data []accountView `json:"data"`
	}
	if err := json.Unmarshal(list.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if len(result.Data) != 1 || result.Data[0].ContactCount != 1 {
		t.Fatalf("unexpected account list: %#v", result.Data)
	}
}

func performDirectoryRequest(t *testing.T, router http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		request.Header.Set("Content-Type", "application/json")
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}
