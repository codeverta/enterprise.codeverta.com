package common

import (
	"github.com/golang-jwt/jwt/v5"
)

// Pastikan struktur Claims sama dengan yang ada di Controller
type Claims struct {
	UserId                 string `json:"id"`
	Username               string `json:"username"`
	Role                   int    `json:"role"`
	TokenVersion           string `json:"token_version"`
	ImpersonatorID         string `json:"impersonator_id,omitempty"`
	ImpersonatorRole       int    `json:"impersonator_role,omitempty"`
	ImpersonationSessionID string `json:"impersonation_session_id,omitempty"`
	jwt.RegisteredClaims
}
