package controller

import (
	"context"
	"encoding/base64"
	"errors"
	"gin-template/common"
	"gin-template/model"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// --- REGISTRATION FLOW (Harus login dulu pakai JWT) ---

func (ac *AuthController) BeginRegistration(c *gin.Context) {
	// 1. Ambil User ID dari JWT Claims
	userIDInterface, exists := c.Get("id")
	if !exists {
		sendBadRequest(c, "Unauthorized: User ID not found in context", nil)
		return
	}

	var userID uuid.UUID
	var err error

	// Cek tipe datanya: String atau UUID?
	switch v := userIDInterface.(type) {
	case string:
		// Kalau string, kita parse dulu
		userID, err = uuid.Parse(v)
		if err != nil {
			sendBadRequest(c, "Invalid User ID format", nil)
			return
		}
	case uuid.UUID:
		// Kalau sudah UUID, langsung pakai
		userID = v
	default:
		sendBadRequest(c, "Invalid User ID type", nil)
		return
	}

	user, err := model.GetUserById(userID, false)
	if err != nil {
		sendBadRequest(c, ErrUserNotFound, nil)
		return
	}
	registerOptions := func(credCreationOpts *protocol.PublicKeyCredentialCreationOptions) {
		// FIX: Versi lama butuh pointer bool, bukan string enum
		requireRK := true
		credCreationOpts.AuthenticatorSelection.RequireResidentKey = &requireRK

		// Tetap set ini untuk kompatibilitas
		credCreationOpts.AuthenticatorSelection.ResidentKey = protocol.ResidentKeyRequirementRequired
		credCreationOpts.AuthenticatorSelection.UserVerification = protocol.VerificationRequired
	}

	// 2. Exclude credentials yang sudah ada (biar gak daftar jari yang sama 2x)
	// (Logic ambil credentials dari DB, sama seperti sebelumnya)

	// 3. Generate Challenge
	options, sessionData, err := ac.Wn.BeginRegistration(user, registerOptions)
	if err != nil {

		sendBadRequest(c, "Failed to begin registration", err.Error())
		return
	}

	// 4. SIMPAN KE REDIS
	// Key menggunakan UserID string
	if err := ac.saveWebAuthnSession(c, user.ID.String(), sessionData); err != nil {
		sendBadRequest(c, "Redis error", err.Error())
		return
	}

	c.JSON(http.StatusOK, options)
}

func (ac *AuthController) FinishRegistration(c *gin.Context) {
	userIDInterface, exists := c.Get("id")
	if !exists {
		sendBadRequest(c, "Unauthorized: User ID not found in context", nil)
		return
	}

	var userID uuid.UUID
	var err error

	// Cek tipe datanya: String atau UUID?
	switch v := userIDInterface.(type) {
	case string:
		// Kalau string, kita parse dulu
		userID, err = uuid.Parse(v)
		if err != nil {
			sendBadRequest(c, "Invalid User ID format", nil)
			return
		}
	case uuid.UUID:
		// Kalau sudah UUID, langsung pakai
		userID = v
	default:
		sendBadRequest(c, "Invalid User ID type", nil)
		return
	}

	user, _ := model.GetUserById(userID, false)
	log := zap.L().With(zap.String("func", "AuthController.FinishRegistration"), zap.String("user_id", user.ID.String()))

	// 1. LOAD DARI REDIS
	sessionData, err := ac.loadWebAuthnSession(c, user.ID.String())
	if err != nil {
		sendBadRequest(c, err.Error(), nil) // Session expired
		return
	}

	// 2. Verifikasi ke Library WebAuthn
	credential, err := ac.Wn.FinishRegistration(user, *sessionData, c.Request)
	if err != nil {
		log.Error("Registration verification failed", zap.Error(err))
		sendBadRequest(c, "Registration verification failed", err.Error())
		return
	}
	encodedID := base64.RawURLEncoding.EncodeToString(credential.ID)
	// 3. Simpan Credential Baru ke DB (Table WebAuthnCredential)
	newCred := model.WebAuthnCredential{
		CredentialID:    encodedID,
		UserID:          user.ID,
		PublicKey:       credential.PublicKey,
		AttestationType: credential.AttestationType,

		// Simpan Data Authenticator
		SignCount:    credential.Authenticator.SignCount,
		CloneWarning: credential.Authenticator.CloneWarning,

		// --- FIX: SIMPAN FLAGS BACKUP ---
		BackupEligible: credential.Flags.BackupEligible,
		BackupState:    credential.Flags.BackupState,
	}

	if err := ac.DB.Create(&newCred).Error; err != nil {
		sendBadRequest(c, "Database error", err.Error())
		return
	}

	sendSuccess(c, nil, "Passkey registered successfully")
}

// --- LOGIN FLOW (Passwordless) ---
func (ac *AuthController) BeginLogin(c *gin.Context) {
	log := zap.L().With(zap.String("func", "AuthController.BeginLogin"))
	var req struct {
		Email string `json:"email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Warn("Invalid parameters", zap.Error(err))
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	// 1. Cari User by Email
	var user model.User
	if err := ac.DB.Set("skip_tenant_scope", true).Where("email = ?", req.Email).First(&user).Error; err != nil {
		log.Warn("User not found or db error", zap.String("email", req.Email), zap.Error(err))
		sendBadRequest(c, ErrUserNotFound, nil)
		return
	}

	// 2. Load existing credentials user ini
	var creds []model.WebAuthnCredential
	if err := ac.DB.Set("skip_tenant_scope", true).Where("user_id = ?", user.ID).Find(&creds).Error; err != nil {
		log.Error("Failed to fetch credentials", zap.Error(err))
		sendBadRequest(c, "System error", nil)
		return
	}

	// LOGIC CHECK 1: Apakah ada data di DB?
	if len(creds) == 0 {
		log.Warn("Found no credentials for user", zap.String("user_id", user.ID.String()))
		// Pesan error ini memberi tahu frontend bahwa user harus login password dulu & register passkey
		sendBadRequest(c, "User has no registered passkeys", nil)
		return
	}

	// 3. Convert ke format Library
	var libraryCreds []webauthn.Credential

	// HAPUS variabel 'allowedCreds' yang bikin error sebelumnya!

	log.Info("Processing credentials from DB", zap.Int("count", len(creds)))

	for _, c := range creds {
		// Decode Base64 ID dari DB ke Binary
		decodedID, err := base64.RawURLEncoding.DecodeString(c.CredentialID)
		if err != nil {
			log.Error("Failed to decode credential ID", zap.String("id", c.CredentialID))
			continue
		}

		// Masukkan ke struct library
		libraryCreds = append(libraryCreds, webauthn.Credential{
			ID:              decodedID,
			PublicKey:       c.PublicKey,
			AttestationType: c.AttestationType,
			Authenticator: webauthn.Authenticator{
				CloneWarning: c.CloneWarning,
				SignCount:    c.SignCount,
			},
			Flags: webauthn.CredentialFlags{
				BackupEligible: c.BackupEligible,
				BackupState:    c.BackupState,
				UserPresent:    true,
				UserVerified:   true,
			},
		})
	}

	// INJECT KE USER OBJECT
	user.WebAuthnCreds = libraryCreds
	log.Info("Valid credentials count", zap.Int("count", len(libraryCreds)))

	// LOGIC CHECK 2: Apakah hasil decode sukses?
	// FIX: Cek 'libraryCreds', BUKAN 'allowedCreds'
	if len(libraryCreds) == 0 {
		log.Error("All credentials failed to decode")
		sendBadRequest(c, "Data credential rusak. Silakan register ulang.", nil)
		return
	}

	// 4. Generate Challenge
	// Library otomatis baca dari user.WebAuthnCreds
	options, sessionData, err := ac.Wn.BeginLogin(&user)
	if err != nil {
		log.Error("BeginLogin webauthn lib error", zap.Error(err))
		sendBadRequest(c, "Login error", err.Error())
		return
	}

	// 5. SIMPAN KE REDIS
	if err := ac.saveWebAuthnSession(c, user.ID.String(), sessionData); err != nil {
		log.Error("Redis save session error", zap.Error(err))
		sendBadRequest(c, "Redis error", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"options": options,
		"user_id": user.ID.String(),
	})
}

func (ac *AuthController) FinishLogin(c *gin.Context) {
	// --- PERBAIKAN DISINI ---
	// Ambil dari Query Param (?user_id=...) BUKAN dari Context (c.Get)
	// Karena saat Login, user belum punya Token/Context, data dikirim via URL.
	userIDStr := c.Query("user_id")

	if userIDStr == "" {
		sendBadRequest(c, "User ID is required", nil)
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		sendBadRequest(c, "Invalid User ID format", nil)
		return
	}
	c.Set("login_attempt_user_id", userID)
	// ------------------------

	// Load User
	user, err := model.GetUserById(userID, false)
	if err != nil {
		sendBadRequest(c, ErrUserNotFound, nil)
		return
	}

	// ============================================================
	// STEP PENTING: INJECT CREDENTIALS LAGI!
	// ============================================================
	var dbCreds []model.WebAuthnCredential
	// Pastikan pakai db instance yang bersih
	if err := ac.DB.Set("skip_tenant_scope", true).Where("user_id = ?", user.ID).Find(&dbCreds).Error; err != nil {
		sendBadRequest(c, "Failed to load credentials", nil)
		return
	}

	var libraryCreds []webauthn.Credential
	for _, c := range dbCreds {
		decodedID, err := base64.RawURLEncoding.DecodeString(c.CredentialID)
		if err != nil {
			continue
		}
		libraryCreds = append(libraryCreds, webauthn.Credential{
			ID:              decodedID,
			PublicKey:       c.PublicKey,
			AttestationType: c.AttestationType,
			Authenticator: webauthn.Authenticator{
				CloneWarning: c.CloneWarning,
				SignCount:    c.SignCount,
			},
			Flags: webauthn.CredentialFlags{
				BackupEligible: c.BackupEligible, // Load dari DB
				BackupState:    c.BackupState,    // Load dari DB

				// Set default true untuk UserPresent/Verified agar aman
				UserPresent:  true,
				UserVerified: true,
			},
		})
	}
	// Masukkan ke kantong user
	user.WebAuthnCreds = libraryCreds

	// 2. AMBIL SESSION DARI REDIS
	// Gunakan userIDStr yang didapat dari query param
	sessionData, err := ac.loadWebAuthnSession(c, userIDStr)
	if err != nil {
		sendBadRequest(c, "Session expired or invalid", nil)
		return
	}

	// 3. Verifikasi Signature
	credential, err := ac.Wn.FinishLogin(user, *sessionData, c.Request)
	if err != nil {
		zap.L().Error("Verification failed", zap.Error(err))
		sendBadRequest(c, "Verification failed", err.Error())
		return
	}

	// 4. Update Sign Count
	encodedID := base64.RawURLEncoding.EncodeToString(credential.ID)

	ac.DB.Model(&model.WebAuthnCredential{}).
		Where("credential_id = ?", encodedID).
		Update("sign_count", credential.Authenticator.SignCount)

	// 5. Generate JWT
	accessToken, refreshToken, err := generateTokens(user)
	if err != nil {
		sendBadRequest(c, ErrTokenGenerationFailed, nil)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Login successful via WebAuthn",
		"data": gin.H{
			"user":          user,
			"access_token":  accessToken,
			"refresh_token": refreshToken,
		},
	})
}

func (ac *AuthController) BeginDiscoverableLogin(c *gin.Context) {
	// Panggil library khusus untuk Discoverable Login
	// Ini akan return options dengan allowCredentials kosong (karena kita belum tahu siapa usernya)
	options, sessionData, err := ac.Wn.BeginDiscoverableLogin()

	if err != nil {
		zap.L().Error("BeginDiscoverableLogin error", zap.Error(err))
		sendBadRequest(c, "Error begin login", err.Error())
		return
	}

	// PENTING: Karena kita belum tahu User ID-nya,
	// Kita simpan Session di Redis menggunakan CHALLENGE sebagai Key-nya.
	// Challenge itu string unik yang digenerate library.
	challenge := sessionData.Challenge

	if err := ac.saveWebAuthnSession(c, challenge, sessionData); err != nil {
		zap.L().Error("Redis save session error", zap.Error(err))
		sendBadRequest(c, "Redis error", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"options": options,
		// Kita tidak return user_id, karena frontend cuma butuh options
	})
}

func (ac *AuthController) FinishDiscoverableLogin(c *gin.Context) {
	// 1. Ambil Challenge dari Query Param
	challenge := c.Query("challenge")
	if challenge == "" {
		sendBadRequest(c, "Challenge is required", nil)
		return
	}

	// 2. Load Session dari Redis
	sessionData, err := ac.loadWebAuthnSession(c, challenge)
	if err != nil {
		sendBadRequest(c, "Session expired or invalid", nil)
		return
	}

	// --- VARIABEL PENAMPUNG (Workaround untuk library versi lama) ---
	// Kita siapkan variabel ini untuk menangkap user saat handler dijalankan
	var foundUser *model.User

	// 3. Define Handler (Ini yang diperbaiki)
	userHandler := func(rawID, userHandle []byte) (webauthn.User, error) {
		if len(userHandle) == 0 {
			return nil, errors.New("user handle is empty")
		}

		var userID uuid.UUID
		var parseErr error

		// --- DUAL PARSING STRATEGY ---
		// Masalah "invalid user handle format" terjadi karena format di chip device (String 36 char)
		// beda dengan ekspektasi library (Binary 16 byte). Kita coba keduanya.

		// Cara 1: Coba Parse sebagai String (e.g., "ed7354af-...")
		// Ini biasanya berhasil jika method WebAuthnID() me-return []byte(u.ID.String())
		userID, parseErr = uuid.Parse(string(userHandle))

		// Cara 2: Jika gagal, Coba Parse sebagai Binary (Raw Bytes)
		if parseErr != nil {
			userID, parseErr = uuid.FromBytes(userHandle)
		}

		// Jika kedua cara gagal, baru return error
		if parseErr != nil {
			return nil, errors.New("failed to parse user handle: " + parseErr.Error())
		}

		// 4. Cari User di DB
		user, err := model.GetUserById(userID, false)
		if err != nil {
			return nil, err
		}

		// 5. INJECT CREDENTIALS (WAJIB)
		// Kita harus load credential user ini agar library bisa verifikasi signature
		var dbCreds []model.WebAuthnCredential
		// Gunakan instance DB bersih
		if err := ac.DB.Set("skip_tenant_scope", true).Where("user_id = ?", user.ID).Find(&dbCreds).Error; err != nil {
			return nil, err
		}

		var libraryCreds []webauthn.Credential
		for _, c := range dbCreds {
			decodedID, err := base64.RawURLEncoding.DecodeString(c.CredentialID)
			if err != nil {
				continue
			}

			libraryCreds = append(libraryCreds, webauthn.Credential{
				ID:              decodedID,
				PublicKey:       c.PublicKey,
				AttestationType: c.AttestationType,
				// Masukkan Flags (BackupEligible ada disini untuk library v0.15.0)
				Flags: webauthn.CredentialFlags{
					BackupEligible: c.BackupEligible,
					BackupState:    c.BackupState,
					UserPresent:    true,
					UserVerified:   true,
				},
				Authenticator: webauthn.Authenticator{
					CloneWarning: c.CloneWarning,
					SignCount:    c.SignCount,
				},
			})
		}

		// Masukkan list credential ke object user
		user.WebAuthnCreds = libraryCreds

		// --- TANGKAP USER DISINI ---
		foundUser = user
		c.Set("login_attempt_user_id", user.ID)

		// Return user pointer langsung (karena model.GetUserById sudah return *User)
		return user, nil
	}

	// 4. Panggil Library
	// Library akan menjalankan userHandler -> Mencari User -> Verifikasi Signature
	credential, err := ac.Wn.FinishDiscoverableLogin(userHandler, *sessionData, c.Request)
	if err != nil {
		zap.L().Error("FinishDiscoverableLogin verification failed", zap.Error(err))
		sendBadRequest(c, "Verification failed", err.Error())
		return
	}

	// 5. Cek apakah user berhasil ditangkap
	if foundUser == nil {
		sendBadRequest(c, "User not found during login process", nil)
		return
	}

	// 6. Update Sign Count (Security Check)
	encodedID := base64.RawURLEncoding.EncodeToString(credential.ID)
	ac.DB.Model(&model.WebAuthnCredential{}).
		Where("credential_id = ?", encodedID).
		Update("sign_count", credential.Authenticator.SignCount)

	// 7. Generate JWT Token (Gunakan foundUser yang sudah ditangkap)
	accessToken, refreshToken, err := generateTokens(foundUser)
	if err != nil {
		sendBadRequest(c, ErrTokenGenerationFailed, nil)
		return
	}

	// 8. Return Success
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Login successful via Discoverable Passkey",
		"data": gin.H{
			"user":          foundUser,
			"access_token":  accessToken,
			"refresh_token": refreshToken,
		},
	})
}

// Helper: Simpan session WebAuthn ke Redis
func (ac *AuthController) saveWebAuthnSession(ctx context.Context, key string, data *webauthn.SessionData) error {
	// Key prefix: "webauthn:session:<uuid>"
	redisKey := "webauthn:session:" + key

	// Set expire 5 menit (cukup untuk user scan jari)
	return common.SetCache(ctx, redisKey, data, 5*time.Minute)
}

// Helper: Ambil session WebAuthn dari Redis
func (ac *AuthController) loadWebAuthnSession(ctx context.Context, key string) (*webauthn.SessionData, error) {
	redisKey := "webauthn:session:" + key
	var data webauthn.SessionData

	// Gunakan fungsi GetCache dari common package kamu
	found := common.GetCache(ctx, redisKey, &data)
	if !found {
		return nil, errors.New("authentication session expired or not found")
	}

	// Hapus session setelah diambil agar tidak bisa direplay (One-time use)
	_ = common.DeleteCache(ctx, redisKey)

	return &data, nil
}
