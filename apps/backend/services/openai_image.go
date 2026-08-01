package services

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

const maxOpenAIImageResponseBytes = 32 * 1024 * 1024

type OpenAIImageError struct {
	StatusCode int
	Code       string
	Message    string
	RequestID  string
	Err        error
}

func (e *OpenAIImageError) Error() string {
	if e == nil {
		return ""
	}
	if e.Message != "" {
		return e.Message
	}
	if e.Err != nil {
		return e.Err.Error()
	}
	return "OpenAI image generation failed"
}

func (e *OpenAIImageError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}

type openAIImageGenerationResponse struct {
	Data []struct {
		Base64JSON string `json:"b64_json"`
	} `json:"data"`
	Error struct {
		Message string `json:"message"`
		Type    string `json:"type"`
		Code    string `json:"code"`
	} `json:"error"`
}

func GenerateOpenAIImage(ctx context.Context, prompt string) ([]byte, string, error) {
	if err := ValidateOpenAIImageConfig(); err != nil {
		return nil, "", &OpenAIImageError{
			StatusCode: http.StatusServiceUnavailable,
			Code:       "openai_not_configured",
			Message:    "OPENAI_API_KEY belum dikonfigurasi",
			Err:        err,
		}
	}
	apiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))

	payload, err := json.Marshal(map[string]interface{}{
		"model":   openAIImageModel(),
		"prompt":  prompt,
		"n":       1,
		"size":    openAIImageSize(),
		"quality": openAIImageQuality(),
	})
	if err != nil {
		return nil, "", err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, openAIImageEndpoint(), bytes.NewReader(payload))
	if err != nil {
		return nil, "", err
	}
	request.Header.Set("Authorization", "Bearer "+apiKey)
	request.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: openAIImageTimeout()}
	response, err := client.Do(request)
	if err != nil {
		statusCode := http.StatusBadGateway
		code := "openai_unavailable"
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
			statusCode = http.StatusGatewayTimeout
			code = "openai_timeout"
		}
		return nil, "", &OpenAIImageError{
			StatusCode: statusCode,
			Code:       code,
			Message:    "OpenAI tidak dapat menyelesaikan gambar",
			Err:        err,
		}
	}
	defer response.Body.Close()

	requestID := strings.TrimSpace(response.Header.Get("x-request-id"))
	body, err := io.ReadAll(io.LimitReader(response.Body, maxOpenAIImageResponseBytes+1))
	if err != nil {
		return nil, requestID, &OpenAIImageError{
			StatusCode: http.StatusBadGateway,
			Code:       "openai_response_unreadable",
			Message:    "Respons OpenAI tidak dapat dibaca",
			RequestID:  requestID,
			Err:        err,
		}
	}
	if len(body) > maxOpenAIImageResponseBytes {
		return nil, requestID, &OpenAIImageError{
			StatusCode: http.StatusBadGateway,
			Code:       "openai_response_too_large",
			Message:    "Respons gambar OpenAI melebihi batas ukuran",
			RequestID:  requestID,
		}
	}

	var result openAIImageGenerationResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, requestID, &OpenAIImageError{
			StatusCode: http.StatusBadGateway,
			Code:       "openai_response_invalid",
			Message:    "Respons OpenAI tidak valid",
			RequestID:  requestID,
			Err:        err,
		}
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		code := strings.TrimSpace(result.Error.Code)
		if code == "" {
			code = strings.TrimSpace(result.Error.Type)
		}
		if code == "" {
			code = "openai_request_failed"
		}
		return nil, requestID, &OpenAIImageError{
			StatusCode: response.StatusCode,
			Code:       code,
			Message:    strings.TrimSpace(result.Error.Message),
			RequestID:  requestID,
		}
	}
	if len(result.Data) == 0 || strings.TrimSpace(result.Data[0].Base64JSON) == "" {
		return nil, requestID, &OpenAIImageError{
			StatusCode: http.StatusBadGateway,
			Code:       "openai_image_missing",
			Message:    "OpenAI tidak mengembalikan data gambar",
			RequestID:  requestID,
		}
	}

	imageBytes, err := base64.StdEncoding.DecodeString(result.Data[0].Base64JSON)
	if err != nil {
		return nil, requestID, &OpenAIImageError{
			StatusCode: http.StatusBadGateway,
			Code:       "openai_image_invalid",
			Message:    "Data gambar OpenAI tidak valid",
			RequestID:  requestID,
			Err:        err,
		}
	}
	if len(imageBytes) == 0 {
		return nil, requestID, &OpenAIImageError{
			StatusCode: http.StatusBadGateway,
			Code:       "openai_image_empty",
			Message:    "OpenAI mengembalikan gambar kosong",
			RequestID:  requestID,
		}
	}
	return imageBytes, requestID, nil
}

func ValidateOpenAIImageConfig() error {
	if strings.TrimSpace(os.Getenv("OPENAI_API_KEY")) == "" {
		return errors.New("OPENAI_API_KEY belum dikonfigurasi")
	}
	return nil
}

func openAIImageEndpoint() string {
	if endpoint := strings.TrimSpace(os.Getenv("OPENAI_IMAGE_API_URL")); endpoint != "" {
		return endpoint
	}
	return "https://api.openai.com/v1/images/generations"
}

func openAIImageModel() string {
	if model := strings.TrimSpace(os.Getenv("OPENAI_IMAGE_MODEL")); model != "" {
		return model
	}
	return "gpt-image-2"
}

func openAIImageSize() string {
	if size := strings.TrimSpace(os.Getenv("OPENAI_IMAGE_SIZE")); size != "" {
		return size
	}
	return "1536x1024"
}

func openAIImageQuality() string {
	switch quality := strings.ToLower(strings.TrimSpace(os.Getenv("OPENAI_IMAGE_QUALITY"))); quality {
	case "low", "medium", "high", "auto":
		return quality
	default:
		return "medium"
	}
}

func openAIImageTimeout() time.Duration {
	seconds, err := strconv.Atoi(strings.TrimSpace(os.Getenv("OPENAI_IMAGE_TIMEOUT_SECONDS")))
	if err != nil || seconds < 30 || seconds > 300 {
		seconds = 150
	}
	return time.Duration(seconds) * time.Second
}

func IsOpenAIImageError(err error) (*OpenAIImageError, bool) {
	var imageErr *OpenAIImageError
	ok := errors.As(err, &imageErr)
	return imageErr, ok
}

func FormatOpenAIImageRequestID(requestID string) string {
	if strings.TrimSpace(requestID) == "" {
		return ""
	}
	return fmt.Sprintf("OpenAI request id: %s", requestID)
}
