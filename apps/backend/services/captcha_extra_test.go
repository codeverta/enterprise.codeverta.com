package services

import (
	"crypto/sha256"
	"strings"
	"testing"
	"time"
)

func TestCaptchaGenerateAndVerify(t *testing.T) {
	t.Run("generate captcha returns challenge", func(t *testing.T) {
		challenge, err := GenerateCaptcha()
		if err != nil {
			t.Fatalf("generate: %v", err)
		}
		if challenge.ID == "" {
			t.Fatal("expected captcha ID")
		}
		if !strings.HasPrefix(challenge.Image, "data:image/svg+xml;base64,") {
			t.Fatal("expected base64 SVG image")
		}
		if challenge.ExpiresAt.Before(time.Now()) {
			t.Fatal("expiry should be in the future")
		}
	})

	t.Run("verify correct answer case-insensitive", func(t *testing.T) {
		answer := "TESTXY"
		id := "verify-case-test"
		captchaStore.Store(id, captchaEntry{AnswerHash: sha256.Sum256([]byte(answer)), ExpiresAt: time.Now().Add(time.Minute)})

		if !VerifyCaptcha(id, "testxy") {
			t.Fatal("expected lowercase to match")
		}
	})

	t.Run("verify wrong answer", func(t *testing.T) {
		answer := "RIGHT"
		id := "wrong-answer"
		captchaStore.Store(id, captchaEntry{AnswerHash: sha256.Sum256([]byte(answer)), ExpiresAt: time.Now().Add(time.Minute)})

		if VerifyCaptcha(id, "WRONG") {
			t.Fatal("expected wrong answer to fail")
		}
	})

	t.Run("verify expired captcha", func(t *testing.T) {
		answer := "EXPIRED"
		id := "expired-captcha"
		captchaStore.Store(id, captchaEntry{AnswerHash: sha256.Sum256([]byte(answer)), ExpiresAt: time.Now().Add(-time.Minute)})

		if VerifyCaptcha(id, "EXPIRED") {
			t.Fatal("expected expired captcha to fail")
		}
	})

	t.Run("verify non-existent captcha", func(t *testing.T) {
		if VerifyCaptcha("nonexistent", "ANYTHING") {
			t.Fatal("expected non-existent captcha to fail")
		}
	})

	t.Run("verify is single-use even on success", func(t *testing.T) {
		answer := "ONETIME"
		id := "single-use"
		captchaStore.Store(id, captchaEntry{AnswerHash: sha256.Sum256([]byte(answer)), ExpiresAt: time.Now().Add(time.Minute)})

		if !VerifyCaptcha(id, "ONETIME") {
			t.Fatal("first use should succeed")
		}
		if VerifyCaptcha(id, answer) {
			t.Fatal("second use should fail (deleted after first)")
		}
	})

	t.Run("verify trims whitespace", func(t *testing.T) {
		answer := "SPACE"
		id := "trim-test"
		captchaStore.Store(id, captchaEntry{AnswerHash: sha256.Sum256([]byte(answer)), ExpiresAt: time.Now().Add(time.Minute)})

		if !VerifyCaptcha(id, "  SPACE  ") {
			t.Fatal("should trim whitespace around answer")
		}
	})
}

func TestSecureCaptchaText(t *testing.T) {
	t.Run("generates correct length", func(t *testing.T) {
		text, err := secureCaptchaText(6)
		if err != nil {
			t.Fatalf("generate: %v", err)
		}
		if len(text) != 6 {
			t.Fatalf("expected 6 chars, got %d", len(text))
		}
	})

	t.Run("uses safe alphabet only", func(t *testing.T) {
		const safeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
		for _, length := range []int{4, 6, 8} {
			text, err := secureCaptchaText(length)
			if err != nil {
				t.Fatalf("generate: %v", err)
			}
			for _, c := range text {
				if !strings.ContainsRune(safeAlphabet, c) {
					t.Fatalf("char %c not in safe alphabet", c)
				}
			}
		}
	})

	t.Run("empty length returns empty", func(t *testing.T) {
		text, err := secureCaptchaText(0)
		if err != nil {
			t.Fatalf("generate: %v", err)
		}
		if text != "" {
			t.Fatalf("expected empty, got %q", text)
		}
	})
}

func TestCaptchaSVG(t *testing.T) {
	t.Run("generates valid SVG", func(t *testing.T) {
		svg := captchaSVG("ABCDEF")
		if !strings.HasPrefix(svg, "<svg") {
			t.Fatal("expected SVG start tag")
		}
		if !strings.HasSuffix(svg, "</svg>") {
			t.Fatal("expected SVG end tag")
		}
		if !strings.Contains(svg, "ABCDEF") {
			t.Fatal("expected answer text in SVG")
		}
	})

	t.Run("different answers produce different SVGs", func(t *testing.T) {
		svg1 := captchaSVG("AAA")
		svg2 := captchaSVG("BBB")
		if svg1 == svg2 {
			t.Fatal("expected different SVGs for different answers (due to random noise)")
		}
	})
}
