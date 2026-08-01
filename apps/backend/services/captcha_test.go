package services

import (
	"crypto/sha256"
	"testing"
	"time"
)

func TestCaptchaIsValidOnce(t *testing.T) {
	answer := "ABC234"
	id := "captcha-test"
	captchaStore.Store(id, captchaEntry{AnswerHash: sha256.Sum256([]byte(answer)), ExpiresAt: time.Now().Add(time.Minute)})
	if !VerifyCaptcha(id, "abc234") {
		t.Fatal("expected case-insensitive captcha answer to pass")
	}
	if VerifyCaptcha(id, answer) {
		t.Fatal("captcha must be single use")
	}
}
