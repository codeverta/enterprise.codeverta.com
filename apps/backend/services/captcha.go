package services

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

const captchaTTL = 5 * time.Minute

type captchaEntry struct {
	AnswerHash [sha256.Size]byte
	ExpiresAt  time.Time
}

type CaptchaChallenge struct {
	ID        string    `json:"captcha_id"`
	Image     string    `json:"image"`
	ExpiresAt time.Time `json:"expires_at"`
}

var captchaStore sync.Map

func GenerateCaptcha() (CaptchaChallenge, error) {
	answer, err := secureCaptchaText(6)
	if err != nil {
		return CaptchaChallenge{}, err
	}
	id := uuid.NewString()
	expiresAt := time.Now().Add(captchaTTL)
	captchaStore.Store(id, captchaEntry{AnswerHash: sha256.Sum256([]byte(answer)), ExpiresAt: expiresAt})
	removeExpiredCaptchas()
	svg := captchaSVG(answer)
	return CaptchaChallenge{
		ID: id, Image: "data:image/svg+xml;base64," + base64.StdEncoding.EncodeToString([]byte(svg)), ExpiresAt: expiresAt,
	}, nil
}

// VerifyCaptcha consumes a challenge on every attempt to prevent answer guessing.
func VerifyCaptcha(id, answer string) bool {
	value, ok := captchaStore.LoadAndDelete(strings.TrimSpace(id))
	if !ok {
		return false
	}
	entry, ok := value.(captchaEntry)
	if !ok || time.Now().After(entry.ExpiresAt) {
		return false
	}
	actual := sha256.Sum256([]byte(strings.ToUpper(strings.TrimSpace(answer))))
	return subtle.ConstantTimeCompare(actual[:], entry.AnswerHash[:]) == 1
}

func secureCaptchaText(length int) (string, error) {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	buffer := make([]byte, length)
	random := make([]byte, length)
	if _, err := rand.Read(random); err != nil {
		return "", err
	}
	for i := range buffer {
		buffer[i] = alphabet[int(random[i])%len(alphabet)]
	}
	return string(buffer), nil
}

func captchaSVG(answer string) string {
	noise := make([]byte, 12)
	_, _ = rand.Read(noise)
	color := hex.EncodeToString(noise[:3])
	return fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="72" viewBox="0 0 240 72"><rect width="240" height="72" rx="10" fill="#f8fafc"/><path d="M5 18 C55 62 145 4 235 52 M8 58 C78 8 166 68 232 15" fill="none" stroke="#%s" stroke-opacity=".25" stroke-width="3"/><g fill="#0f172a" font-family="monospace" font-size="34" font-weight="700" letter-spacing="8"><text x="22" y="49" transform="rotate(-2 120 36)">%s</text></g><circle cx="35" cy="16" r="3" fill="#64748b"/><circle cx="204" cy="58" r="4" fill="#94a3b8"/></svg>`, color, answer)
}

func removeExpiredCaptchas() {
	now := time.Now()
	captchaStore.Range(func(key, value interface{}) bool {
		if entry, ok := value.(captchaEntry); !ok || now.After(entry.ExpiresAt) {
			captchaStore.Delete(key)
		}
		return true
	})
}
