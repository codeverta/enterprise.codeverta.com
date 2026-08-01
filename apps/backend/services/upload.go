package services

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/chai2010/webp"
	"github.com/disintegration/imaging"
	"github.com/google/uuid"
	"github.com/tencentyun/cos-go-sdk-v5"

	// Register decoder tambahan via side-effect import
	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/tiff"
	_ "golang.org/x/image/webp"

	// HEIC decoder
	"github.com/adrium/goheif"
)

// supportedMIMEs memetakan MIME type ke nama format (untuk error message yang lebih jelas)
var supportedMIMEs = map[string]string{
	"image/jpeg": "JPEG",
	"image/png":  "PNG",
	"image/webp": "WebP",
	"image/heic": "HEIC",
	"image/heif": "HEIF",
	"image/bmp":  "BMP",
	"image/tiff": "TIFF",
	"image/gif":  "GIF",
}

var supportedMediaMIMEs = map[string]map[string]bool{
	"video": {
		"video/mp4":       true,
		"video/webm":      true,
		"video/quicktime": true,
		"video/x-m4v":     true,
	},
	"audiobook": {
		"audio/mpeg":      true,
		"audio/mp4":       true,
		"audio/aac":       true,
		"audio/wav":       true,
		"audio/x-wav":     true,
		"audio/ogg":       true,
		"audio/webm":      true,
		"audio/flac":      true,
		"audio/x-m4a":     true,
		"application/ogg": true,
	},
	"ebook": {
		"application/pdf":      true,
		"application/epub+zip": true,
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
		"application/msword": true,
	},
	"worksheet": {
		"application/pdf": true,
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
		"application/msword": true,
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": true,
		"application/vnd.ms-excel": true,
		"text/csv":                 true,
		"application/zip":          true,
	},
}

// decodeImage mencoba decode gambar dari berbagai format.
// Urutan prioritas:
//  1. Deteksi HEIC via magic bytes → gunakan goheif
//  2. Fallback ke image.Decode dari stdlib (sudah include PNG, JPEG, GIF)
//     dengan decoder tambahan yang di-register via blank import (WebP, BMP, TIFF)
func decodeImage(data []byte) (image.Image, error) {
	// Deteksi HEIC/HEIF via magic bytes (ftyp box di offset 4)
	// Format: 4 bytes size + "ftyp" + brand (heic/heif/mif1/msf1)
	if isHEIC(data) {
		img, err := goheif.Decode(bytes.NewReader(data))
		if err != nil {
			return nil, fmt.Errorf("gagal decode HEIC: %w", err)
		}
		return img, nil
	}

	// Decode format lain (JPEG, PNG, WebP, GIF, BMP, TIFF)
	// image.Decode otomatis detect format via registered decoders
	img, format, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("gagal decode gambar (format: %s): %w", format, err)
	}
	return img, nil
}

// isHEIC mendeteksi HEIC/HEIF via "ftyp" box signature
func isHEIC(data []byte) bool {
	if len(data) < 12 {
		return false
	}
	// ftyp box: bytes 4-7 harus "ftyp"
	if string(data[4:8]) != "ftyp" {
		return false
	}
	// Major brand di bytes 8-11
	brand := strings.ToLower(string(data[8:12]))
	heicBrands := map[string]bool{
		"heic": true,
		"heif": true,
		"heis": true,
		"heix": true,
		"hevc": true,
		"mif1": true,
		"msf1": true,
	}
	return heicBrands[brand]
}

// detectContentType mendeteksi MIME type file dengan prioritas:
// 1. HEIC (magic bytes manual, karena http.DetectContentType tidak support)
// 2. http.DetectContentType untuk format standar
func detectContentType(data []byte) string {
	if isHEIC(data) {
		return "image/heic"
	}
	return http.DetectContentType(data)
}

func ProcessAndUploadImage(file multipart.File, fileHeader *multipart.FileHeader) (string, error) {
	fileBytes, err := readAll(file)
	if err != nil {
		return "", fmt.Errorf("gagal membaca file: %w", err)
	}
	return ProcessAndUploadImageBytes(fileBytes)
}

func ProcessAndUploadImageBytes(fileBytes []byte) (string, error) {
	// 1. Validasi Env
	if err := ValidateImageUploadConfig(); err != nil {
		return "", err
	}
	secretID := strings.TrimSpace(os.Getenv("COS_SECRET_ID"))
	secretKey := strings.TrimSpace(os.Getenv("COS_SECRET_KEY"))
	rawBucketURL := strings.TrimSpace(os.Getenv("COS_BUCKET_URL"))

	// 3. Validasi tipe file via magic bytes (lebih andal dari ekstensi)
	contentType := detectContentType(fileBytes)
	if _, ok := supportedMIMEs[contentType]; !ok {
		return "", fmt.Errorf("tipe file tidak didukung: %s (hanya menerima JPEG, PNG, WebP, HEIC, BMP, TIFF, GIF)", contentType)
	}

	// 4. Decode gambar (support semua format termasuk HEIC & WebP)
	img, err := decodeImage(fileBytes)
	if err != nil {
		return "", fmt.Errorf("failed to process image: %w", err)
	}

	// Wrap ke imaging.Image untuk operasi resize
	nrgbaImg := imaging.Clone(img)

	// 5. Resize jika terlalu besar (preserve aspect ratio)
	if nrgbaImg.Bounds().Dx() > 2000 {
		nrgbaImg = imaging.Resize(nrgbaImg, 2000, 0, imaging.Lanczos)
	}

	// 6. Kompresi dinamis ke WebP
	var buf bytes.Buffer
	quality := float32(80)
	for {
		buf.Reset()
		err = webp.Encode(&buf, nrgbaImg, &webp.Options{Lossless: false, Quality: quality})
		if err != nil {
			return "", fmt.Errorf("gagal encode ke WebP: %w", err)
		}
		if buf.Len() <= 200*1024 || quality <= 30 {
			break
		}
		quality -= 10
	}

	// 7. Upload ke COS
	u, _ := url.Parse(rawBucketURL)
	client := cos.NewClient(&cos.BaseURL{BucketURL: u}, &http.Client{
		Transport: &cos.AuthorizationTransport{
			SecretID:  secretID,
			SecretKey: secretKey,
		},
	})

	fileName := fmt.Sprintf("lms/%s.webp", uuid.New().String())
	opt := &cos.ObjectPutOptions{
		ObjectPutHeaderOptions: &cos.ObjectPutHeaderOptions{
			ContentType: "image/webp",
		},
	}

	_, err = client.Object.Put(context.Background(), fileName, bytes.NewReader(buf.Bytes()), opt)
	if err != nil {
		return "", fmt.Errorf("gagal upload ke COS: %w", err)
	}
	return fileName, nil
}

func ValidateImageUploadConfig() error {
	secretID := strings.TrimSpace(os.Getenv("COS_SECRET_ID"))
	secretKey := strings.TrimSpace(os.Getenv("COS_SECRET_KEY"))
	rawBucketURL := strings.TrimSpace(os.Getenv("COS_BUCKET_URL"))
	if secretID == "" || secretKey == "" || rawBucketURL == "" {
		return fmt.Errorf("konfigurasi COS tidak lengkap")
	}
	bucketURL, err := url.Parse(rawBucketURL)
	if err != nil || bucketURL.Scheme == "" || bucketURL.Host == "" {
		return fmt.Errorf("COS_BUCKET_URL tidak valid")
	}
	return nil
}

func ProcessAndUploadMedia(file multipart.File, fileHeader *multipart.FileHeader, mediaType string) (string, error) {
	mediaType = strings.ToLower(strings.TrimSpace(mediaType))
	if mediaType == "image" {
		return ProcessAndUploadImage(file, fileHeader)
	}

	allowed, ok := supportedMediaMIMEs[mediaType]
	if !ok {
		return "", fmt.Errorf("tipe media tidak didukung: %s", mediaType)
	}

	contentType, err := detectMultipartContentType(file, fileHeader)
	if err != nil {
		return "", err
	}
	if !allowed[contentType] {
		return "", fmt.Errorf("tipe file %s tidak cocok untuk media %s", contentType, mediaType)
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return "", fmt.Errorf("gagal reset file upload: %w", err)
	}

	secretID := os.Getenv("COS_SECRET_ID")
	secretKey := os.Getenv("COS_SECRET_KEY")
	rawBucketURL := os.Getenv("COS_BUCKET_URL")
	if secretID == "" || secretKey == "" || rawBucketURL == "" {
		return "", fmt.Errorf("konfigurasi COS tidak lengkap")
	}

	bucketURL, _ := url.Parse(rawBucketURL)
	client := cos.NewClient(&cos.BaseURL{BucketURL: bucketURL}, &http.Client{
		Transport: &cos.AuthorizationTransport{
			SecretID:  secretID,
			SecretKey: secretKey,
		},
	})

	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	if ext == "" {
		ext = extensionFromContentType(contentType)
	}
	objectKey := fmt.Sprintf("lms/%s/%s%s", mediaType, uuid.New().String(), ext)
	opt := &cos.ObjectPutOptions{
		ObjectPutHeaderOptions: &cos.ObjectPutHeaderOptions{
			ContentType: contentType,
		},
	}
	_, err = client.Object.Put(context.Background(), objectKey, file, opt)
	if err != nil {
		return "", fmt.Errorf("gagal upload media ke COS: %w", err)
	}
	return objectKey, nil
}

func detectMultipartContentType(file multipart.File, fileHeader *multipart.FileHeader) (string, error) {
	headerContentType := strings.ToLower(strings.TrimSpace(fileHeader.Header.Get("Content-Type")))
	buffer := make([]byte, 512)
	n, err := file.Read(buffer)
	if err != nil && err != io.EOF {
		return "", fmt.Errorf("gagal membaca file upload: %w", err)
	}
	if _, seekErr := file.Seek(0, io.SeekStart); seekErr != nil {
		return "", fmt.Errorf("gagal reset file upload: %w", seekErr)
	}
	detected := strings.ToLower(http.DetectContentType(buffer[:n]))
	if headerContentType != "" && headerContentType != "application/octet-stream" {
		return headerContentType, nil
	}
	return detected, nil
}

func extensionFromContentType(contentType string) string {
	switch contentType {
	case "video/mp4":
		return ".mp4"
	case "video/webm":
		return ".webm"
	case "video/quicktime":
		return ".mov"
	case "audio/mpeg":
		return ".mp3"
	case "audio/mp4", "audio/x-m4a":
		return ".m4a"
	case "audio/wav", "audio/x-wav":
		return ".wav"
	case "audio/ogg", "application/ogg":
		return ".ogg"
	case "application/pdf":
		return ".pdf"
	case "application/epub+zip":
		return ".epub"
	case "application/zip":
		return ".zip"
	case "text/csv":
		return ".csv"
	default:
		return ""
	}
}

// readAll membaca semua byte dari multipart.File
func readAll(f multipart.File) ([]byte, error) {
	var buf bytes.Buffer
	_, err := buf.ReadFrom(f)
	return buf.Bytes(), err
}

// DeleteImageFromCOS menghapus file dari Tencent COS
func DeleteImageFromCOS(fileURL string) error {
	secretID := os.Getenv("COS_SECRET_ID")
	secretKey := os.Getenv("COS_SECRET_KEY")
	rawBucketURL := os.Getenv("COS_BUCKET_URL")

	if secretID == "" || secretKey == "" || rawBucketURL == "" {
		return fmt.Errorf("konfigurasi tencent cos tidak lengkap di file .env")
	}

	// 1. Ekstrak Object Key
	objectKey := fileURL
	if strings.HasPrefix(fileURL, "http") {
		parsedURL, err := url.Parse(fileURL)
		if err != nil || parsedURL.Path == "" {
			return fmt.Errorf("object key tidak valid dari URL: %v", err)
		}
		objectKey = strings.TrimPrefix(parsedURL.Path, "/")
	}

	if objectKey == "" {
		return fmt.Errorf("object key tidak valid")
	}

	// 2. Setup COS Client
	bucketURL, _ := url.Parse(rawBucketURL)
	client := cos.NewClient(&cos.BaseURL{BucketURL: bucketURL}, &http.Client{
		Transport: &cos.AuthorizationTransport{
			SecretID:  secretID,
			SecretKey: secretKey,
		},
	})

	// 3. Proses Delete
	_, err := client.Object.Delete(context.Background(), objectKey)
	if err != nil {
		return fmt.Errorf("failed to delete from tencent cos: %w", err)
	}
	return nil
}
