package services

import (
	"os"
	"strings"
	"testing"
)

func TestEmailHelperFunctions(t *testing.T) {
	t.Run("formatIDR", func(t *testing.T) {
		cases := map[float64]string{
			0:          "0",
			1000:       "1.000",
			1500000:    "1.500.000",
			250.50:     "250", // formatIDR truncates, doesn't round
			999999999:  "999.999.999",
		}
		for input, expected := range cases {
			got := formatIDR(input)
			if got != expected {
				t.Errorf("formatIDR(%f) = %q, want %q", input, got, expected)
			}
		}
	})

	t.Run("formatRibuanTanpaRp", func(t *testing.T) {
		cases := map[float64]string{
			0:          "0",
			1000:       "1.000",
			2500000:    "2.500.000",
			1234567.89: "1.234.568",
		}
		for input, expected := range cases {
			got := formatRibuanTanpaRp(input)
			if got != expected {
				t.Errorf("formatRibuanTanpaRp(%f) = %q, want %q", input, got, expected)
			}
		}
	})

	t.Run("splitName", func(t *testing.T) {
		cases := []struct {
			full      string
			wantFirst string
			wantLast  string
		}{
			{"John Doe", "John", "Doe"},
			{"Sarah", "Sarah", "Sarah"},
			{"", "", ""},
			{"  spaced  ", "spaced", "spaced"},
		}
		for _, tc := range cases {
			first, last := splitName(tc.full)
			if first != tc.wantFirst || last != tc.wantLast {
				t.Errorf("splitName(%q) = (%q, %q), want (%q, %q)", tc.full, first, last, tc.wantFirst, tc.wantLast)
			}
		}
	})

	t.Run("isBankVA", func(t *testing.T) {
		for _, method := range []string{"bni", "BRI", "mandiri", "permata", "cimb", "bjb"} {
			if !isBankVA(method) {
				t.Errorf("%s should be a bank VA", method)
			}
		}
		if isBankVA("QRIS") {
			t.Error("QRIS should not be a bank VA")
		}
		if isBankVA("") {
			t.Error("empty should not be a bank VA")
		}
	})

	t.Run("normalizeXenditV3Status", func(t *testing.T) {
		cases := map[string]string{
			"SUCCEEDED":          "PAID",
			"FAILED":             "EXPIRED",
			"VOIDED":             "EXPIRED",
			"PENDING":            "PENDING",
			"REQUIRES_ACTION":    "PENDING",
			"":                   "",
			"RANDOM_STRING":      "RANDOM_STRING",
		}
		for input, expected := range cases {
			got := normalizeXenditV3Status(input)
			if got != expected {
				t.Errorf("normalizeXenditV3Status(%q) = %q, want %q", input, got, expected)
			}
		}
	})

	t.Run("mapTencentStatus", func(t *testing.T) {
		cases := map[uint64]string{
			0: "APPROVED",
			1: "PENDING",
			2: "REJECTED",
			3: "UNKNOWN",
		}
		for input, expected := range cases {
			got := mapTencentStatus(input)
			if got != expected {
				t.Errorf("mapTencentStatus(%d) = %q, want %q", input, got, expected)
			}
		}
	})
}

func TestGetXenditAuth(t *testing.T) {
	t.Run("generates correct basic auth", func(t *testing.T) {
		os.Setenv("XENDIT_SECRET_KEY", "test-secret-key")
		defer os.Unsetenv("XENDIT_SECRET_KEY")

		auth := getXenditAuth()
		if !strings.HasPrefix(auth, "Basic ") {
			t.Fatalf("expected Basic auth, got %q", auth)
		}
		if auth == "" {
			t.Fatal("auth should not be empty")
		}
	})

	t.Run("empty secret returns basic auth of colon", func(t *testing.T) {
		os.Unsetenv("XENDIT_SECRET_KEY")
		auth := getXenditAuth()
		// Base64(":") = Og==, so auth is "Basic Og=="
		if auth != "Basic Og==" {
			t.Fatalf("expected 'Basic Og==', got %q", auth)
		}
	})
}
