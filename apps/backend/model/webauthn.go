package model

import (
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// --- STRUCT DATABASE ---

type WebAuthnCredential struct {
	// ID Credential biasanya panjang, kita pakai TEXT atau VARCHAR besar.
	// Jangan lupa set autoIncrement:false karena ini ID dari WebAuthn, bukan AI database.
	ID           uuid.UUID `gorm:"type:char(36);primaryKey;"`
	CredentialID string    `gorm:"type:varchar(512);uniqueIndex"`
	// Relasi ke User
	UserID uuid.UUID `gorm:"type:char(36);index"`
	User   User      `gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`

	// PublicKey disimpan sebagai binary (BLOB/BYTEA)
	PublicKey []byte `gorm:"type:blob"`

	AttestationType string `gorm:"size:255"`

	// Transport biasanya array, tapi di DB disimpan string (perlu marshalling manual kalau mau rapi)
	// Tapi untuk simple storage, string cukup.
	Transport string `gorm:"type:text"`

	SignCount    uint32 `gorm:"default:0"`
	CloneWarning bool   `gorm:"default:false"`

	BackupEligible bool `gorm:"default:false"` // Apakah device support backup?
	BackupState    bool `gorm:"default:false"` // Apakah saat ini sedang di-backup?
}

func (w *WebAuthnCredential) BeforeCreate(tx *gorm.DB) (err error) {
	if w.ID == uuid.Nil {
		w.ID = uuid.New()
	}
	return
}

// Pastikan struct User kamu mengimplementasikan interface webauthn.User
// Tambahkan method-method ini di file model/user.go atau model/webauthn.go

func (u *User) WebAuthnID() []byte {
	return []byte(u.ID.String())
}

func (u *User) WebAuthnName() string {
	return u.Email
}

func (u *User) WebAuthnDisplayName() string {
	return u.DisplayName // atau u.Username
}

func (u *User) WebAuthnIcon() string {
	return "" // Opsional
}

func (u *User) WebAuthnCredentials() []webauthn.Credential {
	return u.WebAuthnCreds // <--- JANGAN return kosong lagi
}
