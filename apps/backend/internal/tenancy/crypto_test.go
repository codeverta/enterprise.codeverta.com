package tenancy

import (
	"encoding/base64"
	"strings"
	"testing"
)

func testCipher(t *testing.T) *CredentialCipher {
	t.Helper()
	key := base64.StdEncoding.EncodeToString([]byte("0123456789abcdef0123456789abcdef"))
	cipher, err := NewCredentialCipher(key)
	if err != nil {
		t.Fatal(err)
	}
	return cipher
}

func TestCredentialCipherRoundTrip(t *testing.T) {
	cipher := testCipher(t)
	encrypted, err := cipher.Encrypt("tenant-secret")
	if err != nil {
		t.Fatal(err)
	}
	if encrypted == "tenant-secret" || strings.Contains(encrypted, "tenant-secret") {
		t.Fatal("encrypted credential contains plaintext")
	}
	plain, err := cipher.Decrypt(encrypted)
	if err != nil {
		t.Fatal(err)
	}
	if plain != "tenant-secret" {
		t.Fatalf("got %q", plain)
	}
}

func TestCredentialCipherRejectsInvalidKey(t *testing.T) {
	if _, err := NewCredentialCipher(base64.StdEncoding.EncodeToString([]byte("short"))); err == nil {
		t.Fatal("expected invalid key length to fail")
	}
}
