package services

import (
	"os"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestPureServiceHelpers(t *testing.T) {
	if got := formatIDR(1234567); got != "1.234.567" {
		t.Fatalf("formatIDR=%q", got)
	}

	first, last := splitName("Septiyan Halel Wijaya")
	if first != "Septiyan" || last != "Halel Wijaya" {
		t.Fatalf("splitName multi=%q %q", first, last)
	}
	first, last = splitName("Samantha")
	if first != "Samantha" || last != "Samantha" {
		t.Fatalf("splitName single=%q %q", first, last)
	}

	for _, method := range []string{"bni", "BRI", "mandiri", "permata", "cimb", "bjb"} {
		if !isBankVA(method) {
			t.Fatalf("%s should be a bank VA", method)
		}
	}
	if isBankVA("QRIS") {
		t.Fatal("QRIS should not be a bank VA")
	}

	statusCases := map[string]string{
		"SUCCEEDED":        "PAID",
		"failed":           "EXPIRED",
		"VOIDED":           "EXPIRED",
		"pending":          "PENDING",
		"REQUIRES_ACTION":  "PENDING",
		"UNKNOWN_EXTERNAL": "UNKNOWN_EXTERNAL",
	}
	for in, want := range statusCases {
		if got := normalizeXenditV3Status(in); got != want {
			t.Fatalf("normalizeXenditV3Status(%q)=%q want %q", in, got, want)
		}
	}

	statusMap := map[uint64]string{0: "APPROVED", 1: "PENDING", 2: "REJECTED", 99: "UNKNOWN"}
	for in, want := range statusMap {
		if got := mapTencentStatus(in); got != want {
			t.Fatalf("mapTencentStatus(%d)=%q want %q", in, got, want)
		}
	}

	if got := formatRibuanTanpaRp(1234567); got != "1.234.567" {
		t.Fatalf("formatRibuanTanpaRp=%q", got)
	}
}

func TestXenditAuthAndFreshScopedDB(t *testing.T) {
	t.Setenv("XENDIT_SECRET_KEY", "secret")
	if got := getXenditAuth(); got != "Basic c2VjcmV0Og==" {
		t.Fatalf("unexpected xendit auth: %q", got)
	}

	db, err := gorm.Open(sqlite.Open("file:service-helper?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	db = db.Set("tenant_id", "tenant-1").Set("skip_tenant_scope", true)
	fresh := freshScopedDB(db)

	if tenantID, ok := fresh.Get("tenant_id"); !ok || tenantID != "tenant-1" {
		t.Fatalf("tenant scope was not copied: %v %v", tenantID, ok)
	}
	if skip, ok := fresh.Get("skip_tenant_scope"); !ok || skip != true {
		t.Fatalf("skip tenant flag was not copied: %v %v", skip, ok)
	}

	os.Unsetenv("XENDIT_SECRET_KEY")
}
