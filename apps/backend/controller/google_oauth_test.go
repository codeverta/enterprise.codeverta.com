package controller

import (
	"strings"
	"testing"
	"time"
)

func TestGoogleOAuthStateRoundTripAndTamperProtection(t *testing.T) {
	original := googleOAuthState{
		Nonce: "nonce-for-google-test", TenantID: "tenant-test", Redirect: "/account?tab=orders",
		CallbackURL: "http://localhost:8000/api/auth/google/callback", ExpiresAt: time.Now().UTC().Add(time.Minute).Unix(),
	}
	signed, err := signGoogleState(original)
	if err != nil {
		t.Fatalf("sign state: %v", err)
	}
	parsed, err := parseGoogleState(signed)
	if err != nil {
		t.Fatalf("parse signed state: %v", err)
	}
	if parsed.Nonce != original.Nonce || parsed.TenantID != original.TenantID || parsed.Redirect != original.Redirect {
		t.Fatalf("state mismatch: got %+v want %+v", parsed, original)
	}

	tampered := "x" + signed[1:]
	if _, err := parseGoogleState(tampered); err == nil {
		t.Fatal("tampered state should be rejected")
	}
}

func TestGoogleOAuthStateRejectsExpiredAndUnsafeRedirect(t *testing.T) {
	expired, err := signGoogleState(googleOAuthState{Nonce: "expired", TenantID: "tenant", Redirect: "/", ExpiresAt: time.Now().UTC().Add(-time.Minute).Unix()})
	if err != nil {
		t.Fatalf("sign expired state: %v", err)
	}
	if _, err := parseGoogleState(expired); err == nil {
		t.Fatal("expired state should be rejected")
	}

	for _, unsafe := range []string{"https://evil.example", "//evil.example", strings.Repeat(" ", 3)} {
		if got := safeGoogleRedirect(unsafe); got != "/" {
			t.Fatalf("unsafe redirect %q resolved to %q", unsafe, got)
		}
	}
}
