# Database-per-tenant SaaS architecture

Untuk instalasi, pembuatan tenant, API platform, custom domain, migrasi, dan troubleshooting, gunakan [Panduan Operasional Multi-Tenant](./MULTI_TENANT_OPERATIONS.md).

## Decision

Codeverta ERP runs as one API, one frontend, one worker release, and one deployment. `platform_db` contains only SaaS control-plane data. Every ERP customer receives a separate MariaDB database and database user. `tenant_id` columns may remain temporarily for compatibility, but they are no longer the isolation boundary.

```text
DNS/TLS -> HAProxy -> shared Gin API -> hostname resolver -> tenant pool -> tenant database
                          |                                      |
                          +-> platform admin -> platform_db       +-> tenant object prefix
```

The initial implementation is opt-in with `TENANCY_MODE=database-per-tenant`. Legacy mode remains available during migration. In database-per-tenant mode, missing tenant context fails closed: ERP code cannot fall back to the global connection.

The base Compose file intentionally remains in legacy mode for backward compatibility. Start a prepared multi-tenant environment with both files only after setting the required secrets:

```text
docker compose -f docker-compose.yml -f docker-compose.multitenant.yml up -d
```

## Runtime request flow

1. HAProxy preserves the original `Host` and routes `/api` to the shared API.
2. The resolver normalizes the host, rejects malformed host values, and looks up an exact, verified `tenant_domains.domain` in `platform_db`.
3. The registry cache returns safe tenant metadata only. Credentials never enter request context.
4. Tenant status is enforced before authentication. Unknown and terminated tenants look identical to clients.
5. A concurrency-safe manager lazily creates one GORM/`database/sql` pool per active tenant. Idle pools are evicted.
6. Authentication searches the selected tenant database. JWT `tenant_id` must equal the hostname-resolved tenant ID.
7. Handlers continue to call `model.GetDB(c)`, which now reads the typed tenant scope first and panics rather than falling back when strict tenancy is enabled.

Recommended middleware order:

```text
Recover -> Request ID -> trusted proxy/real IP -> access log -> tenant resolver
-> tenant status/read-only guard -> authentication -> JWT/host binding
-> authorization -> per-tenant/user/IP rate limit -> handler
```

Only configured reverse proxies should be trusted by Gin. The API deliberately resolves `Request.Host`, not `X-Tenant-ID`, query parameters, or an untrusted JWT claim.

## Platform schema

The concrete GORM models live in `apps/backend/internal/tenancy/types.go` and migrate to:

- `platform_tenants`: UUID, name, unique slug, primary domain, encrypted database credential, database placement, status, plan, schema version, and provisioning failure.
- `tenant_domains`: many verified domains per tenant, primary flag, verification token, and verification timestamp.

Control-plane tables for platform administrators and plan entitlements are implemented separately. Production still needs durable provisioning/migration runs, usage rollups, and backup manifests. Platform administrator identity must not be stored in a tenant `users` table. Access to customer data requires a separately audited, time-limited support session; being a platform administrator alone grants no ERP data access.

Database passwords are AES-256-GCM encrypted with `TENANT_CREDENTIAL_KEY`. Store that master key in a secret manager or Docker secret, rotate it with a key-versioned re-encryption job, and never log decrypted credentials. For larger deployments, replace encrypted passwords with a secret-manager reference.

## Pool sizing and scale

Each pool supports configurable maximum open/idle connections, connection lifetime, idle lifetime, and whole-pool idle eviction. Creation is serialized per manager, preventing duplicate pools when simultaneous first requests arrive. Defaults are conservative: 20 open, 5 idle, 30-minute lifetime, 5-minute connection idle time, 15-minute tenant pool idle TTL.

At 10–100 tenants, one MariaDB server and in-process registry cache are sufficient. At 500–1,000 tenants, lower per-pool idle counts, aggressively evict idle pools, use a shared Redis registry cache/invalidation channel, and shard tenants across database hosts. At 10,000 tenants, place pools behind bounded admission, use cluster placement from the registry, shard workers/schedulers, and operate migrations/backups as resumable queues. A database proxy can help connection pressure, but it does not replace tenant-specific credentials.

## Provisioning lifecycle

`internal/platform/provisioning.Service` owns the reusable workflow for both HTTP and CLI:

```text
validate request -> create registry row(provisioning) -> generate credential
-> create database/user/grant -> open tenant pool -> migrate -> bootstrap admin
-> mark active
```

Failures are persisted as `failed` with a diagnostic in the platform database; database errors are never returned verbatim by public APIs. Names are strictly validated before being interpolated into MariaDB DDL. Provisioning operations should be recorded with an idempotency key. Retrying a failed run must inspect existing database/user/schema state rather than blindly creating a second tenant.

Platform routes are exposed only on `PLATFORM_ADMIN_HOST`, protected by separate `platform_admins`/session tables, `PLATFORM_JWT_SECRET`, issuer, and audience:

```text
POST /api/platform/tenants
PATCH /api/platform/tenants/:slug/status
POST /api/platform/tenants/:slug/migrate
GET  /api/platform/tenants/:slug/health
```

Create the first control-plane administrator independently from ERP users:

```text
erp platform create-admin --email platform-admin@example.com --password '...'
```

Custom-domain endpoints issue a DNS TXT challenge and verify it server-side before the hostname becomes resolvable.

The platform endpoint and `erp tenant create` command call the same provisioning service. Tenant ERP routes must never register on the platform-admin host.

## Migration runner

`model.MigrateTenantSchema(db)` now applies ERP migrations to one selected database and does not seed `platform_db`. A migration runner should enumerate active/read-only/suspended tenants, process them with bounded concurrency, store start/version/result per tenant, and continue after failures. Commands:

```text
erp tenant list
erp tenant status [slug]
erp tenant create <slug> --domain ... --admin ... --plan starter
erp tenant migrate <slug>
erp tenant migrate --all
```

Schema changes must be backward compatible for rolling deployment: expand first, deploy compatible code, backfill, then contract in a later release. Never run every database migration simultaneously.

## Jobs, scheduler, cache, files, and realtime

- Every queued job uses the `tenancy.JobEnvelope` and includes an immutable tenant UUID. The worker resolves the registry record and database before invoking a handler. A missing/unknown tenant fails the job; there is no default ERP database.
- Asynq over the existing Redis deployment is the recommended first queue: it is Go-native, supports retries, scheduling, uniqueness, and operational inspection. Heavy tenants can later receive queue partitions without changing job payloads.
- Schedules enqueue tenant jobs in staggered windows with bounded concurrency and plan-aware rate limits. Do not perform work inside the scheduler loop.
- Cache/lock/session/rate-limit keys must be built with `tenancy.CacheKey`, producing `tenant:{uuid}:...`.
- S3/MinIO objects must be built with `tenancy.ObjectKey`, producing `tenants/{uuid}/...`. Downloads authorize the tenant before issuing a short-lived signed URL. Buckets must remain private.
- WebSocket authentication applies the same hostname/JWT binding. Rooms are `tenant:{tenantID}:user:{userID}`; broadcasters require a tenant scope and cannot publish to an unscoped room.

## Custom domains and TLS

Platform subdomains use wildcard DNS `*.erp.example.com` and a wildcard certificate (DNS-01 is preferred). Custom domains require a verification challenge, typically a DNS TXT record containing the registry verification token. Only after verification is `verified_at` set and routing allowed. Certificate automation can use Traefik/Caddy or an ACME controller; HAProxy may consume certificates produced by that controller. Domain changes invalidate local and Redis registry caches immediately.

The reverse proxy does not need one backend per tenant. It routes all `/api` paths to the shared API and all other paths to the shared frontend. The backend registry is authoritative for tenant existence.

## Backup, restore, export, and placement

Backups are per tenant and contain an encrypted database dump, metadata (tenant ID, schema/app version, checksums), and an object manifest. Restore defaults to a new database and requires explicit confirmation plus tenant-ID/schema validation before a destructive overwrite. Export packages the same artifacts without platform secrets. Registry `cluster_id`, database host, and port permit a large tenant to move to another server; perform a final write freeze, delta copy, health check, atomic registry switch, cache invalidation, and rollback window.

## Observability

Request logs should include request ID, tenant ID/slug, user ID, route template, status, and duration. Never log credentials, raw JWTs, or SQL parameters containing personal data. Traces may carry tenant ID as a controlled attribute. Avoid tenant labels on high-volume Prometheus series at large scale; publish global/plan/cluster metrics and put per-tenant usage in rollup tables or logs.

Track pool opens/evictions, database latency/error class, registry cache hits, provisioning/migration results, queue age/failures, storage bytes, active users, and rate-limit rejections. Health checks should distinguish platform DB, registry, Redis, storage, and a sampled/bounded tenant database check.

## Threat controls

- Host spoofing: accept only syntactically valid, exact verified registry domains; configure trusted proxies and allowed public hosts.
- Tenant/JWT spoofing and replay: bind signed tenant ID to resolved host, use short access tokens, rotating refresh sessions (`session_id`), token version/revocation, issuer/audience checks, and key rotation.
- Cross-tenant SQL: tenant DB comes only from typed request/job scope; strict mode disables global fallback; repositories accept scoped DB/transaction handles.
- SQL injection: parameterized business queries; provisioning interpolates only validated identifiers.
- Cache/object/job leakage: mandatory namespace builders and authorization before signed URLs or broadcasts.
- Credential leakage: envelope encryption or secret references, redacted structured errors/logs, least-privilege per-database users.
- Custom-domain takeover: DNS verification, periodic ownership revalidation, and certificate issuance only after verification.
- Platform compromise: separate identities, MFA, network restrictions, immutable audit log, just-in-time support grants, and no implicit ERP access.

## Verification gate

Required integration tests use two real MariaDB databases and assert different data with identical primary keys. The current automated foundation covers encrypted credentials, exact verified hostname resolution, concurrent single-pool creation, physical two-database isolation, read-only mutation blocking, JWT/tenant binding, cache/object namespaces, and mandatory tenant job payloads. CI should add container-backed tests for provisioning DDL, migrations across two tenants with one failure, worker isolation, signed-file authorization, and restore safeguards.

## Incremental rollout

1. Deploy the new code with legacy mode unchanged.
2. Create and back up `platform_db`; import tenant/domain metadata and encrypted credentials.
3. Clone one internal tenant to a separate database, migrate it, and exercise hostname/JWT isolation tests.
4. Enable strict mode in staging. Audit remaining direct global DB uses module by module and convert repository construction to request-scoped factories.
5. Migrate production tenants in batches with reconciliation and rollback checkpoints.
6. Remove header/query tenant selection, then retire shared business tables only after all tenants are verified.

The non-negotiable invariant is: platform metadata may use `platform_db`; every ERP read, write, transaction, job, cache entry, file, and realtime channel must have one resolved tenant and may never fall back to another database.
