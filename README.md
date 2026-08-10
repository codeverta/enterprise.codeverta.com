# Codeverta ERP Core

Fondasi multi-tenant untuk `erp.codeverta.com`, diekstrak dari codebase LMS tanpa mengaktifkan fitur course, lesson, quiz, certificate, community, chat, readiness test, atau parent/student workflow.

## Core features

- Authentication: JWT/refresh token, password reset, WebAuthn, login throttling
- Multi-tenancy: tenant resolver dan tenant-scoped database access
- Users, roles, activation, impersonation, and profiles
- Notifications and realtime activity WebSocket
- Generic orders with extensible references and metadata
- Subscription plans, subscriptions, Xendit payments, promo codes
- Wallet, finance, withdrawals, and platform fee configuration
- Audit logs, login attempts, settings, file storage, email templates/broadcast
- Security middleware: CORS, rate limit, body/upload limits, audit trail

## Structure

```text
apps/
  admin/       React 19 + Vite admin dashboard
  backend/     Go + Gin + GORM REST API
haproxy/       Routing for erp.codeverta.com and erp-api.codeverta.com
docker-compose.yml
```

The backend keeps module implementations from the source tree for incremental migration, but only routes registered by `router/api-router.go` are active. Core database migration intentionally does not register LMS models. New ERP domains should be added as isolated modules and reference the generic `orders` table through `reference_type` and `reference_id`.

## Local setup

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/admin/.env.example apps/admin/.env
pnpm install
pnpm dev:backend
pnpm dev:admin
```

Required secrets must be replaced before running outside local development. Generate `JWT_SECRET` with at least 64 random characters.

## Verification

```bash
pnpm --filter admin-page build
cd apps/backend
JWT_SECRET=<64-plus-characters> go test ./...
go build ./...
```

## Desktop app (Tauri)

Tauri membungkus dashboard React yang sama dengan WebView bawaan sistem, sehingga installer jauh lebih ringan daripada desktop shell yang membawa Chromium sendiri.

Panduan lengkap tersedia di [`docs/TAURI_DESKTOP.md`](docs/TAURI_DESKTOP.md), termasuk prasyarat macOS/Windows/Linux, konfigurasi environment, build installer, signing, keamanan, dan troubleshooting.

```bash
# Development (jalankan backend secara terpisah)
pnpm dev:backend
pnpm dev:desktop

# Binary release untuk platform yang sedang digunakan
pnpm build:desktop

# Paket distribusi native (jalankan pada OS target)
pnpm build:desktop:macos
pnpm build:desktop:windows
pnpm build:desktop:linux
```

Build desktop memakai konfigurasi API Vite yang sama. Salin `apps/admin/.env.example` ke `apps/admin/.env` dan atur `VITE_BASE_API_URL` sebelum build. Paket Windows, macOS, dan Linux harus dibuat pada OS target masing-masing. Lihat panduan desktop untuk penjelasan dan checklist rilis.

Some inherited integration tests open local sockets and therefore require a runner that permits loopback listeners.

## Core API groups

- `/api/auth`, `/api/user`, `/api/users`, `/api/tenants`
- `/api/core/dashboard`
- `/api/orders`
- `/api/subscription-plans`, `/api/subscriptions`
- `/api/promo-codes`, `/api/finance`, `/api/settings`
- `/api/audit-logs`, `/api/system`, `/api/email`, `/api/templates`

See [`docs/CORE_EXTRACTION.md`](docs/CORE_EXTRACTION.md) for the boundary and extension rules.
# enterprise.codeverta.com
