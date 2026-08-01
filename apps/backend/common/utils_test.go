package common

import (
	"errors"
	"os"
	"testing"
	"time"
)

func TestGetExpiryDurationInMinutes(t *testing.T) {
	t.Setenv("TIAS_EXPIRY_PAYMENT", "90")
	if got := GetExpiryDurationInMinutes(); got != 90 {
		t.Fatalf("expected 90, got %d", got)
	}

	t.Setenv("TIAS_EXPIRY_PAYMENT", "not-a-number")
	if got := GetExpiryDurationInMinutes(); got != 1440 {
		t.Fatalf("expected default 1440 for invalid env, got %d", got)
	}

	os.Unsetenv("TIAS_EXPIRY_PAYMENT")
	if got := GetExpiryDurationInMinutes(); got != 1440 {
		t.Fatalf("expected default 1440 for missing env, got %d", got)
	}
}

func TestMaskData(t *testing.T) {
	tests := []struct {
		name       string
		input      string
		visibleEnd int
		expected   string
	}{
		{"keeps last chars", "08123456", 4, "****3456"},
		{"masks all when too short", "abc", 5, "***"},
		{"zero visible masks all", "abc", 0, "***"},
	}

	for _, tt := range tests {
		if got := MaskData(tt.input, tt.visibleEnd); got != tt.expected {
			t.Fatalf("%s: expected %q, got %q", tt.name, tt.expected, got)
		}
	}
}

func TestFormatIDR(t *testing.T) {
	if got := FormatIDR(390000); got != "Rp 390000" {
		t.Fatalf("expected Rp 390000, got %q", got)
	}
}

func TestPasswordHashValidation(t *testing.T) {
	hash, err := Password2Hash("secret-password")
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	if !ValidatePasswordAndHash("secret-password", hash) {
		t.Fatal("expected valid password to match hash")
	}
	if ValidatePasswordAndHash("wrong-password", hash) {
		t.Fatal("expected wrong password not to match hash")
	}
}

func TestFormatValidationErrorFallback(t *testing.T) {
	result := FormatValidationError(errors.New("boom"))
	if result["global"] != "boom" {
		t.Fatalf("expected global fallback error, got %+v", result)
	}
}

func TestInMemoryRateLimiter(t *testing.T) {
	var limiter InMemoryRateLimiter
	limiter.Init(0)

	if !limiter.Request("ip:1", 2, 60) {
		t.Fatal("first request should pass")
	}
	if !limiter.Request("ip:1", 2, 60) {
		t.Fatal("second request should pass")
	}
	if limiter.Request("ip:1", 2, 60) {
		t.Fatal("third request should be blocked")
	}
}

func TestInMemoryRateLimiterWindowReset(t *testing.T) {
	var limiter InMemoryRateLimiter
	limiter.Init(0)

	if !limiter.Request("ip:2", 1, 0) {
		t.Fatal("first request should pass")
	}
	time.Sleep(time.Second)
	if !limiter.Request("ip:2", 1, 0) {
		t.Fatal("request should pass when duration window has elapsed")
	}
}
