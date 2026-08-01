package common

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/go-playground/validator/v10"
)

func TestUtilityHelpersCoverEdgeCases(t *testing.T) {
	t.Setenv("TIAS_EXPIRY_PAYMENT", "30")
	if got := GetExpiryDurationInMinutes(); got != 30 {
		t.Fatalf("expected env expiry, got %d", got)
	}

	t.Setenv("TIAS_EXPIRY_PAYMENT", "-1")
	if got := GetExpiryDurationInMinutes(); got != 1440 {
		t.Fatalf("expected default expiry for invalid env, got %d", got)
	}

	if got := GenerateRandomString(24); len(got) != 24 {
		t.Fatalf("expected random string length 24, got %d", len(got))
	}

	for _, tc := range []struct {
		name string
		in   int64
		want string
	}{
		{name: "bytes", in: 900, want: "900 B"},
		{name: "kilobytes boundary", in: int64(sizeKB * 3), want: "3 KB"},
		{name: "megabytes boundary", in: int64(sizeMB * 3), want: "3 MB"},
		{name: "gigabytes boundary", in: int64(sizeGB * 3), want: "3.00 GB"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := Bytes2Size(tc.in); got != tc.want {
				t.Fatalf("Bytes2Size() = %q, want %q", got, tc.want)
			}
		})
	}

	if got := Seconds2Time(31104000 + 2592000 + 86400 + 3600 + 60 + 1); got != "1 年 1 个月 1 天 1 小时 1 分钟 1 秒" {
		t.Fatalf("unexpected Seconds2Time output: %q", got)
	}

	if got := Interface2String("abc"); got != "abc" {
		t.Fatalf("string conversion failed: %q", got)
	}
	if got := Interface2String(12); got != "12" {
		t.Fatalf("int conversion failed: %q", got)
	}
	if got := Interface2String(1.5); got != "1.500000" {
		t.Fatalf("float conversion failed: %q", got)
	}
	if got := Interface2String(true); got != "Not Implemented" {
		t.Fatalf("fallback conversion failed: %q", got)
	}

	if got := IntMax(3, 7); got != 7 {
		t.Fatalf("IntMax returned %d", got)
	}
	if got := Max(9, 2); got != 9 {
		t.Fatalf("Max returned %d", got)
	}
	if got := *ToPtr("value"); got != "value" {
		t.Fatalf("ToPtr returned %q", got)
	}
	if got := GetUUID(); len(got) != 32 || strings.Contains(got, "-") {
		t.Fatalf("GetUUID returned non-compact uuid: %q", got)
	}
	if got := UnescapeHTML("<b>x</b>"); got == nil {
		t.Fatal("UnescapeHTML returned nil")
	}
}

func TestFormatValidationError(t *testing.T) {
	type participant struct {
		PhoneNumber string `validate:"required,min=10"`
		Email       string `validate:"required,email"`
		Status      string `validate:"oneof=PENDING PAID"`
	}
	type request struct {
		Participants []participant `validate:"dive"`
	}

	err := validator.New().Struct(request{
		Participants: []participant{{
			PhoneNumber: "123",
			Email:       "bad-email",
			Status:      "NOPE",
		}},
	})
	got := FormatValidationError(err)

	if got["participants.0._phone_number"] != "Minimal 10 karakter" {
		t.Fatalf("unexpected phone error: %#v", got)
	}
	if got["participants.0._email"] != "Format email salah" {
		t.Fatalf("unexpected email error: %#v", got)
	}
	if got["participants.0._status"] != "Harus salah satu dari: PENDING PAID" {
		t.Fatalf("unexpected status error: %#v", got)
	}

	global := FormatValidationError(errors.New("boom"))
	if global["global"] != "boom" {
		t.Fatalf("unexpected global error: %#v", global)
	}
}

func TestInMemoryRateLimiterWindow(t *testing.T) {
	limiter := InMemoryRateLimiter{}
	limiter.Init(0)

	if !limiter.Request("ip", 2, 1) || !limiter.Request("ip", 2, 1) {
		t.Fatal("first two requests should pass")
	}
	if limiter.Request("ip", 2, 1) {
		t.Fatal("third request in window should be blocked")
	}
	time.Sleep(1100 * time.Millisecond)
	if !limiter.Request("ip", 2, 1) {
		t.Fatal("request after window should pass")
	}
}
