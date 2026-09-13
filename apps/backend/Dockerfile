# --- Stage 1: Builder ---
FROM golang:1.25-alpine AS builder

WORKDIR /build

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=1 GOOS=linux go build -ldflags "-s -w" -o backend-app .
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags "-s -w" -o erp ./cmd/erp

# --- Stage 2: Production ---
FROM surnet/alpine-wkhtmltopdf:3.19.0-0.12.6-small

RUN apk add --no-cache ca-certificates tzdata

# Pastikan WORKDIR konsisten dengan docker-compose volume
WORKDIR /app

COPY --from=builder /build/backend-app .
COPY --from=builder /build/erp .
# Copy invoice template HTML
COPY --from=builder /build/html ./html
# Opsi aman: Copy .env saat build jika mounting volume bermasalah
# COPY --from=builder /build/.env . 

RUN chmod +x ./backend-app ./erp

EXPOSE 8084

ENTRYPOINT []

# Paksa jalankan dari path /app
CMD ["sh", "-c", "cd /app && ./backend-app"]
