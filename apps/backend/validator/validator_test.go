package validator

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

type validationRequest struct {
	Name  string `json:"name" binding:"required,min=3,max=5,alpha"`
	Email string `json:"email" binding:"required,email"`
	Code  string `json:"code" binding:"len=4,numeric"`
}

func TestValidateRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("valid payload", func(t *testing.T) {
		ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
		ctx.Request = httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"Abcd","email":"a@b.com","code":"1234"}`))
		ctx.Request.Header.Set("Content-Type", "application/json")

		var req validationRequest
		messages, err := ValidateRequest(ctx, &req)
		if err != nil || messages != nil {
			t.Fatalf("expected valid payload, messages=%v err=%v", messages, err)
		}
	})

	t.Run("validation messages", func(t *testing.T) {
		ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
		ctx.Request = httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"1","email":"bad","code":"ab"}`))
		ctx.Request.Header.Set("Content-Type", "application/json")

		var req validationRequest
		messages, err := ValidateRequest(ctx, &req)
		if err != nil {
			t.Fatalf("expected validation errors without bind error, got %v", err)
		}
		if len(messages) == 0 {
			t.Fatal("expected formatted validation messages")
		}
	})

	t.Run("malformed json", func(t *testing.T) {
		ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
		ctx.Request = httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{`))
		ctx.Request.Header.Set("Content-Type", "application/json")

		var req validationRequest
		messages, err := ValidateRequest(ctx, &req)
		if err == nil || len(messages) != 1 {
			t.Fatalf("expected JSON bind error, messages=%v err=%v", messages, err)
		}
	})
}

func TestDateValidationHelpers(t *testing.T) {
	date, err := ValidateDateFormat("2026-05-26")
	if err != nil || date.Year() != 2026 {
		t.Fatalf("expected valid date, got %v %v", date, err)
	}

	if _, msg := ValidateAndParseDate("26-05-2026"); msg != "Invalid date format. Use YYYY-MM-DD" {
		t.Fatalf("expected friendly date error, got %q", msg)
	}
}
