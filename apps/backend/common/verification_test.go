package common

import (
	"testing"
	"time"
)

func TestGenerateVerificationCodeLength(t *testing.T) {
	if got := GenerateVerificationCode(6); len(got) != 6 {
		t.Fatalf("expected length 6, got %d (%q)", len(got), got)
	}
	if got := GenerateVerificationCode(0); len(got) != 32 {
		t.Fatalf("expected uuid without dashes length 32, got %d", len(got))
	}
}

func TestRegisterVerifyAndDeleteVerificationCode(t *testing.T) {
	RegisterVerificationCodeWithKey("user@example.com", "123456", EmailVerificationPurpose)
	if !VerifyCodeWithKey("user@example.com", "123456", EmailVerificationPurpose) {
		t.Fatal("expected registered code to verify")
	}
	if VerifyCodeWithKey("user@example.com", "999999", EmailVerificationPurpose) {
		t.Fatal("expected wrong code to fail")
	}

	DeleteKey("user@example.com", EmailVerificationPurpose)
	if VerifyCodeWithKey("user@example.com", "123456", EmailVerificationPurpose) {
		t.Fatal("expected deleted code to fail")
	}
}

func TestVerifyCodeExpires(t *testing.T) {
	oldValidMinutes := VerificationValidMinutes
	VerificationValidMinutes = 1
	defer func() { VerificationValidMinutes = oldValidMinutes }()

	verificationMutex.Lock()
	verificationMap[EmailVerificationPurpose+"expired@example.com"] = verificationValue{
		code: "123456",
		time: time.Now().UTC().Add(-2 * time.Minute),
	}
	verificationMutex.Unlock()

	if VerifyCodeWithKey("expired@example.com", "123456", EmailVerificationPurpose) {
		t.Fatal("expected expired code to fail")
	}
}
