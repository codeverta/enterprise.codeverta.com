package validator

import (
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
)

// ValidateRequest validates JSON binding and returns formatted error messages
func ValidateRequest(c *gin.Context, req interface{}) ([]string, error) {
	if err := c.ShouldBindJSON(req); err != nil {
		// Check if it's validation errors
		if errs, ok := err.(validator.ValidationErrors); ok {
			return FormatValidationErrors(errs), nil
		}
		// Return other binding errors (e.g., JSON syntax errors)
		return []string{err.Error()}, err
	}
	return nil, nil
}

// FormatValidationErrors converts validator errors to user-friendly messages
func FormatValidationErrors(errs validator.ValidationErrors) []string {
	messages := make([]string, 0)

	for _, e := range errs {
		field := e.Field()
		switch e.Tag() {
		case "required":
			messages = append(messages, fmt.Sprintf("%s is required", field))
		case "email":
			messages = append(messages, fmt.Sprintf("%s must be a valid email", field))
		case "min":
			messages = append(messages, fmt.Sprintf("%s must be at least %s characters", field, e.Param()))
		case "max":
			messages = append(messages, fmt.Sprintf("%s must be at most %s characters", field, e.Param()))
		case "len":
			messages = append(messages, fmt.Sprintf("%s must be exactly %s characters", field, e.Param()))
		case "numeric":
			messages = append(messages, fmt.Sprintf("%s must contain only numbers", field))
		case "alpha":
			messages = append(messages, fmt.Sprintf("%s must contain only letters", field))
		default:
			messages = append(messages, fmt.Sprintf("%s is invalid", field))
		}
	}

	return messages
}

// ValidateDateFormat validates and parses date string
func ValidateDateFormat(dateStr string) (time.Time, error) {
	return time.Parse("2006-01-02", dateStr)
}

// ValidateAndParseDate validates date format and returns parsed time or error message
func ValidateAndParseDate(dateStr string) (time.Time, string) {
	date, err := ValidateDateFormat(dateStr)
	if err != nil {
		return time.Time{}, "Invalid date format. Use YYYY-MM-DD"
	}
	return date, ""
}