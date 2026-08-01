package model

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"os"
)

func getKeys() ([]byte, []byte) {
	eKey := os.Getenv("DB_ENCRYPTION_KEY")
	hKey := os.Getenv("DB_HMAC_KEY")

	if len(eKey) != 32 {
		// Log untuk debug (Hapus saat produksi)
		fmt.Printf("Error: Key length is %d\n", len(eKey))
		panic("DB_ENCRYPTION_KEY must be 32 bytes")
	}
	return []byte(eKey), []byte(hKey)
}

func Encrypt(plaintext string) (string, error) {
	encryptionKey, _ := getKeys()
	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func Decrypt(cryptoText string) (string, error) {
	encryptionKey, _ := getKeys()
	data, err := base64.StdEncoding.DecodeString(cryptoText)
	if err != nil || len(data) < 12 {
		return "", errors.New("invalid ciphertext")
	}
	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonceSize := gcm.NonceSize()
	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

func generateBlindIndex(input string) string {
	_, hmacKey := getKeys()

	h := hmac.New(sha256.New, hmacKey)
	h.Write([]byte(input))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}
