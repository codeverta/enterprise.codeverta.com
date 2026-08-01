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

Some inherited integration tests open local sockets and therefore require a runner that permits loopback listeners.

## Core API groups

- `/api/auth`, `/api/user`, `/api/users`, `/api/tenants`
- `/api/core/dashboard`
- `/api/orders`
- `/api/subscription-plans`, `/api/subscriptions`
- `/api/promo-codes`, `/api/finance`, `/api/settings`
- `/api/audit-logs`, `/api/system`, `/api/email`, `/api/templates`

See [`docs/CORE_EXTRACTION.md`](docs/CORE_EXTRACTION.md) for the boundary and extension rules.
