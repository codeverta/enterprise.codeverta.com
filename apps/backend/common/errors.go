package common

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/go-playground/validator/v10"
)

// Helper untuk mengubah error validator menjadi Map
func FormatValidationError(err error) map[string]string {
	errors := make(map[string]string)

	// Cek apakah error berasal dari validator
	if validationErrors, ok := err.(validator.ValidationErrors); ok {
		for _, fieldErr := range validationErrors {
			// fieldErr.Namespace() biasanya "CreateOrderRequest.Participants[0].PhoneNumber"
			// Kita perlu parsing agar sesuai dengan format form frontend: "participants.0.phone_number"

			// Contoh struktur fieldErr.Namespace(): CreateOrderRequest.Participants[0].PhoneNumber
			// Kita ingin ambil: Participants[0].PhoneNumber

			structNamespace := fieldErr.Namespace()
			// Potong struct terluar (CreateOrderRequest)
			_, after, found := strings.Cut(structNamespace, ".")
			if found {
				// after = Participants[0].PhoneNumber
				// Lowercase huruf depan agar mirip JSON: participants[0].phoneNumber
				// Namun react-hook-form butuh format: participants.0.phone_number

				// Cara termudah: Gunakan JSON tag name jika memungkinkan,
				// Tapi untuk case ini, kita mapping manual field yg sering error

				// fieldName := fieldErr.Field() // Misal: PhoneNumber
				param := fieldErr.Param() // Misal: 10 (untuk min=10)

				// Custom message berdasarkan tag
				msg := ""
				switch fieldErr.Tag() {
				case "required":
					msg = "Wajib diisi"
				case "email":
					msg = "Format email salah"
				case "min":
					msg = fmt.Sprintf("Minimal %s karakter", param)
				case "max":
					msg = fmt.Sprintf("Maksimal %s karakter", param)
				case "oneof":
					msg = fmt.Sprintf("Harus salah satu dari: %s", param)
				default:
					msg = fmt.Sprintf("Validasi gagal: %s", fieldErr.Tag())
				}

				// Mapping nama field Go ke JSON path Frontend
				// Teknik simplenya: kita kembalikan key yang bisa diparsing frontend
				// Kita ambil index array dari structNamespace

				// Logic parsing index sederhana (bisa disesuaikan regex):
				// Input: CreateOrderRequest.Participants[4].PhoneNumber
				// Output Key: participants.4.phone_number

				jsonKey := toSnakeCase(after) // Perlu fungsi helper camelToSnake
				jsonKey = strings.ReplaceAll(jsonKey, "[", ".")
				jsonKey = strings.ReplaceAll(jsonKey, "]", "")

				errors[jsonKey] = msg
			}
		}
	} else {
		errors["global"] = err.Error()
	}
	return errors
}

// Helper camelCase ke snake_case (banyak library tersedia, ini contoh simpel)
func toSnakeCase(str string) string {
	var matchFirstCap = regexp.MustCompile("(.)([A-Z][a-z]+)")
	var matchAllCap = regexp.MustCompile("([a-z0-9])([A-Z])")

	snake := matchFirstCap.ReplaceAllString(str, "${1}_${2}")
	snake = matchAllCap.ReplaceAllString(snake, "${1}_${2}")
	return strings.ToLower(snake)
}
