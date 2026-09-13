# Panduan Operasional Multi-Tenant SaaS

Dokumen ini adalah panduan pemasangan, pembuatan tenant, operasi harian, pengembangan, dan troubleshooting arsitektur **satu aplikasi, satu deployment, satu database per tenant** di Codeverta ERP.

Dokumen desain dan alasan teknis tersedia di [Database-per-Tenant SaaS Architecture](./DATABASE_PER_TENANT_ARCHITECTURE.md).

## 1. Ringkasan implementasi

Dalam mode `database-per-tenant`:

- `platform_db` hanya menyimpan registry tenant, domain, administrator platform, sesi platform, plan, dan entitlement.
- Setiap tenant memperoleh database MariaDB dan user database sendiri.
- Tenant dipilih dari hostname request, bukan dari query string atau header tenant buatan client.
- Database tenant dibuka secara lazy dan disimpan dalam connection pool.
- Context request membawa identitas tenant dan koneksi database yang sudah benar.
- JWT user ERP harus memiliki `tenant_id` yang sama dengan tenant hasil resolusi hostname.
- Platform admin memiliki akun, JWT, host, dan endpoint terpisah dari user ERP.
- Tenant `read_only`, `suspended`, `provisioning`, dan `terminated` dibatasi oleh middleware.
- Job, cache key, object key, dan WebSocket memiliki namespace tenant.

Mode lama masih menjadi default. Mode baru hanya aktif jika:

```dotenv
TENANCY_MODE=database-per-tenant
```

Ini memungkinkan migrasi bertahap tanpa langsung merusak deployment lama.

## 2. Komponen yang ditambahkan

| Komponen | Lokasi | Fungsi |
|---|---|---|
| Tenant registry dan domain | `apps/backend/internal/tenancy/registry.go` | Resolve hostname, cache registry, verifikasi custom domain |
| Model platform tenant | `apps/backend/internal/tenancy/types.go` | `platform_tenants` dan `tenant_domains` |
| Enkripsi credential | `apps/backend/internal/tenancy/crypto.go` | AES-256-GCM untuk password database tenant |
| Typed tenant context | `apps/backend/internal/tenancy/context.go` | Tenant dan DB aktif tanpa raw string context key |
| Tenant DB pool manager | `apps/backend/internal/tenancy/manager.go` | Lazy pool, singleflight, health check, close, idle eviction |
| Tenant middleware | `apps/backend/internal/tenancy/middleware.go` | Resolve host, status guard, DB scope, standardized error |
| Namespace helper | `apps/backend/internal/tenancy/namespace.go` | Cache, object storage, job envelope, tenant job runner |
| Platform authentication | `apps/backend/internal/platform/adminauth/` | Admin platform terpisah dan JWT 15 menit |
| Provisioning service | `apps/backend/internal/platform/provisioning/` | Membuat DB, user DB, schema, dan admin tenant |
| Entitlement service | `apps/backend/internal/platform/entitlement/` | Feature/limit per plan secara terpusat |
| Platform HTTP API | `apps/backend/internal/platform/httpapi/` | CRUD operasional tenant, health, migrasi, domain |
| Tenant CLI | `apps/backend/cmd/erp/main.go` | Create, list, status, dan migrate tenant |
| Tenant schema migration | `apps/backend/model/main.go` | Memisahkan migrasi platform dan migrasi ERP tenant |
| Tenant bootstrap | `apps/backend/model/tenant_bootstrap.go` | Membuat identitas tenant kompatibilitas dan admin awal |
| Router strict mode | `apps/backend/router/api-router.go` | Memisahkan platform host dan tenant host |
| Compose overlay | `docker-compose.multitenant.yml` | Mengaktifkan mode database-per-tenant pada stack yang sama |
| Reverse proxy | `haproxy/haproxy.cfg` | Satu frontend dan satu API untuk semua hostname |

Image backend sekarang juga berisi dua executable:

```text
/app/backend-app  # server API
/app/erp          # CLI platform dan tenant
```

## 3. Tabel pada platform database

`platform_db` bukan database bisnis ERP. Tabel platform yang saat ini dibuat otomatis adalah:

### `platform_tenants`

Menyimpan:

- UUID dan slug tenant;
- nama dan primary domain;
- driver, nama, host, port, serta user database tenant;
- password database yang sudah dienkripsi;
- status, plan, cluster, schema version, dan provisioning error.

Password tenant tidak ikut dikeluarkan lewat JSON API.

### `tenant_domains`

Menyimpan semua domain milik tenant, status primary, token verifikasi, dan waktu verifikasi. Resolver hanya menerima domain yang `verified_at`-nya terisi.

### `platform_admins` dan `platform_admin_sessions`

Menyimpan akun dan sesi administrator control plane. Akun ini bukan user ERP dan tidak otomatis dapat membaca database customer.

### `platform_plans` dan `platform_plan_entitlements`

Menjadi sumber feature flag dan limit berdasarkan plan. Pemakaian dilakukan melalui service `Has` dan `Limit`, bukan kondisi plan yang tersebar di business logic.

## 4. Persiapan secret

Buat `.env` di root repository dari `.env.example`, lalu isi nilai khusus Compose multi-tenant:

```dotenv
PLATFORM_DB_PASSWORD=ganti-dengan-password-platform-yang-kuat
MYSQL_ROOT_PASSWORD=ganti-dengan-password-root-mariadb
TENANT_CREDENTIAL_KEY=ganti-dengan-key-base64
PLATFORM_JWT_SECRET=ganti-dengan-secret-platform-terpisah
TENANT_PLATFORM_DOMAIN_SUFFIX=erp.example.com
PLATFORM_ADMIN_HOST=admin.example.com
```

Generate key dan secret secara terpisah:

```bash
openssl rand -base64 32
openssl rand -base64 64
```

Masukkan hasil pertama ke `TENANT_CREDENTIAL_KEY` dan hasil kedua ke `PLATFORM_JWT_SECRET`.

Di `apps/backend/.env`, aktifkan dan sesuaikan bagian berikut:

```dotenv
TENANCY_MODE=database-per-tenant
SQL_DSN=platform:PASSWORD_PLATFORM@tcp(mysql:3306)/platform_db?charset=utf8mb4&parseTime=True&loc=Local
TENANT_DB_ADMIN_DSN=root:PASSWORD_ROOT@tcp(mysql:3306)/?charset=utf8mb4&parseTime=True&loc=Local
TENANT_CREDENTIAL_KEY=KEY_BASE64_32_BYTE
TENANT_PLATFORM_DOMAIN_SUFFIX=erp.example.com
PLATFORM_ADMIN_HOST=admin.example.com
PLATFORM_JWT_SECRET=SECRET_PLATFORM_MINIMAL_64_KARAKTER
TENANT_DB_HOST=mysql
TENANT_DB_PORT=3306
```

`JWT_SECRET` yang sudah dipakai autentikasi user ERP tetap diperlukan dan harus berbeda dari `PLATFORM_JWT_SECRET`.

Aturan keamanan:

- jangan commit file `.env`;
- jangan mengganti `TENANT_CREDENTIAL_KEY` tanpa re-enkripsi credential yang tersimpan;
- gunakan secret manager atau Docker secret di production;
- batasi `TENANT_DB_ADMIN_DSN` hanya untuk API/control-plane dan CLI provisioning;
- setiap database tenant menggunakan user database yang berbeda dan hanya memperoleh grant ke database miliknya.

## 5. Menjalankan stack multi-tenant

Build dan jalankan base Compose bersama overlay multi-tenant:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.multitenant.yml \
  up -d --build
```

Pada volume MariaDB yang benar-benar baru, image MariaDB membuat `platform_db` dan user `platform` dari environment Compose.

Pada volume lama, environment `MYSQL_DATABASE` tidak dijalankan ulang. Buat database dan user platform satu kali menggunakan kredensial yang sama dengan `SQL_DSN`:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.multitenant.yml \
  exec mysql mariadb -uroot -p
```

Kemudian jalankan di prompt MariaDB:

```sql
CREATE DATABASE IF NOT EXISTS platform_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'platform'@'%' IDENTIFIED BY 'PASSWORD_PLATFORM';
ALTER USER 'platform'@'%' IDENTIFIED BY 'PASSWORD_PLATFORM';
GRANT ALL PRIVILEGES ON platform_db.* TO 'platform'@'%';
FLUSH PRIVILEGES;
```

Ganti `PASSWORD_PLATFORM` dengan nilai yang sama seperti `PLATFORM_DB_PASSWORD`. Jangan menyalin password produksi ke log atau chat.

Saat API pertama kali hidup, tabel control-plane dimigrasikan otomatis. Tabel bisnis ERP tidak dibuat di `platform_db`.

## 6. Membuat administrator platform pertama

Jalankan dari container backend:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.multitenant.yml \
  exec backend-go ./erp platform create-admin \
  --email platform-admin@example.com \
  --password 'PASSWORD-ADMIN-PLATFORM-MIN-12-KARAKTER'
```

Syarat password saat ini minimal 12 karakter. Gunakan password manager dan nilai yang lebih panjang di production.

Platform admin hanya dapat menggunakan API platform melalui hostname yang sama persis dengan `PLATFORM_ADMIN_HOST`.

## 7. Cara menambah tenant melalui CLI

Ini adalah cara yang paling sederhana:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.multitenant.yml \
  exec backend-go ./erp tenant create alpha \
  --name "PT Alpha" \
  --domain alpha.erp.example.com \
  --plan starter \
  --admin admin@alpha.example.com
```

Urutan argumen di atas didukung: slug diletakkan tepat setelah `create`, kemudian flag.

Jika `--admin-password` tidak diberikan, CLI menghasilkan password aman dan menampilkannya satu kali:

```text
tenant alpha is active at alpha.erp.example.com
initial admin: admin@alpha.example.com
initial password: <generated-password>
change this password immediately after first login
```

Simpan password itu secara aman dan ubah setelah login pertama. Untuk menentukan password awal sendiri:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.multitenant.yml \
  exec backend-go ./erp tenant create beta \
  --name "PT Beta" \
  --domain beta.erp.example.com \
  --plan business \
  --admin admin@beta.example.com \
  --admin-password 'PASSWORD-AWAL-MIN-12-KARAKTER'
```

### Aturan input tenant

- slug harus lowercase, diawali huruf, terdiri dari huruf/angka/tanda hubung, dan panjangnya 3–40 karakter;
- slug harus unik;
- domain harus hostname tanpa protocol dan path, misalnya `alpha.erp.example.com`;
- `name`, `domain`, dan email admin wajib diisi;
- domain `slug.TENANT_PLATFORM_DOMAIN_SUFFIX` otomatis dipercaya karena berada di wildcard domain platform;
- custom domain harus diverifikasi sebelum dapat digunakan.

### Apa yang terjadi saat create

Provisioning menjalankan alur berikut dari satu service yang sama untuk CLI dan API:

```text
validasi input
  -> registry status provisioning
  -> generate user/password database
  -> enkripsi password di platform_db
  -> create database erp_<slug>
  -> create user database khusus tenant
  -> grant hanya ke database tenant
  -> migrasi schema ERP
  -> buat tenant compatibility row dan admin ERP awal
  -> status active
```

Jika gagal setelah registry dibuat, status berubah menjadi `failed` dan error provisioning disimpan untuk diagnosis. Tenant gagal tidak otomatis dianggap aktif.

## 8. Melihat tenant dan status

Daftar semua tenant:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.multitenant.yml \
  exec backend-go ./erp tenant list
```

Status satu tenant:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.multitenant.yml \
  exec backend-go ./erp tenant status alpha
```

Contoh output:

```text
slug=alpha status=active plan=starter domain=alpha.erp.example.com schema=0
```

## 9. Membuat tenant melalui Platform API

Semua endpoint berikut hanya menerima request pada `PLATFORM_ADMIN_HOST`.

### Login platform admin

```bash
curl -sS http://localhost/api/platform/auth/login \
  -H 'Host: admin.example.com' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "platform-admin@example.com",
    "password": "PASSWORD-ADMIN-PLATFORM"
  }'
```

Response berisi `data.access_token`. Token berlaku 15 menit dan harus dipakai sebagai Bearer token.

### Provision tenant

```bash
curl -sS http://localhost/api/platform/tenants \
  -H 'Host: admin.example.com' \
  -H 'Authorization: Bearer ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "PT Alpha",
    "slug": "alpha",
    "domain": "alpha.erp.example.com",
    "plan": "starter",
    "admin_email": "admin@alpha.example.com"
  }'
```

Response `201` menyertakan tenant dan `initial_admin.temporary_password`. API menghasilkan password tersebut dan tidak menerima password admin dari payload publik.

### Endpoint platform yang tersedia

| Method | Endpoint | Fungsi |
|---|---|---|
| `POST` | `/api/platform/auth/login` | Login administrator platform |
| `GET` | `/api/platform/tenants` | Daftar tenant dan domain |
| `POST` | `/api/platform/tenants` | Provision tenant baru |
| `PATCH` | `/api/platform/tenants/:slug/status` | Ubah status tenant |
| `GET` | `/api/platform/tenants/:slug/health` | Ping database tenant |
| `POST` | `/api/platform/tenants/:slug/migrate` | Migrasi satu database tenant |
| `POST` | `/api/platform/tenants/:slug/domains` | Mulai verifikasi custom domain |
| `POST` | `/api/platform/tenants/:slug/domains/:domain/verify` | Periksa TXT dan aktifkan domain |

Selain endpoint login, semuanya memerlukan Bearer token platform.

Error API menggunakan format konsisten:

```json
{
  "error": {
    "code": "TENANT_NOT_FOUND",
    "message": "Tenant not found",
    "request_id": "..."
  }
}
```

Detail SQL, hostname database, credential, dan stack trace tidak dikirim sebagai error publik.

## 10. Menguji tenant secara lokal

Untuk pengujian dengan HAProxy lokal, tambahkan hostname development ke `/etc/hosts`:

```text
127.0.0.1 admin.erp.local
127.0.0.1 alpha.erp.local
127.0.0.1 beta.erp.local
```

Set environment menjadi:

```dotenv
TENANT_PLATFORM_DOMAIN_SUFFIX=erp.local
PLATFORM_ADMIN_HOST=admin.erp.local
```

Kemudian tenant dibuat dengan `alpha.erp.local`. Buka:

```text
http://alpha.erp.local/desk
```

Untuk menguji backend langsung tanpa DNS:

```bash
curl -i http://localhost:8084/api/my-profile \
  -H 'Host: alpha.erp.local' \
  -H 'Authorization: Bearer TENANT_ACCESS_TOKEN'
```

Tanpa `Host` yang terdaftar dan terverifikasi, request akan memperoleh `TENANT_NOT_FOUND`.

## 11. Status tenant

Status yang dapat diatur melalui API adalah:

| Status | Perilaku |
|---|---|
| `active` | Read dan write diperbolehkan |
| `trial` | Sama seperti active; limit plan dapat diterapkan melalui entitlement service |
| `read_only` | GET/HEAD diperbolehkan; mutasi ditolak kecuali route autentikasi yang diperlukan |
| `suspended` | Request tenant ditolak; pool tenant ditutup |
| `terminated` | Tenant disamarkan sebagai tidak ditemukan; pool ditutup |

`provisioning` dan `failed` adalah status internal provisioning.

Contoh membuat tenant read-only:

```bash
curl -sS -X PATCH http://localhost/api/platform/tenants/alpha/status \
  -H 'Host: admin.example.com' \
  -H 'Authorization: Bearer ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"status":"read_only"}'
```

Sebelum status menjadi `active`, `trial`, atau `read_only`, control plane memastikan database tenant sehat.

## 12. Custom domain

Misalnya tenant Alpha ingin memakai `erp.ptalpha.com`.

### 12.1 Arahkan traffic

Buat CNAME atau A/AAAA record agar `erp.ptalpha.com` menuju load balancer Codeverta. Pastikan certificate TLS tersedia, tetapi jangan aktifkan akses tenant hanya berdasarkan DNS routing.

### 12.2 Minta challenge

```bash
curl -sS -X POST http://localhost/api/platform/tenants/alpha/domains \
  -H 'Host: admin.example.com' \
  -H 'Authorization: Bearer ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"domain":"erp.ptalpha.com"}'
```

Response memberikan record seperti:

```json
{
  "data": {
    "domain": "erp.ptalpha.com",
    "record_type": "TXT",
    "record_name": "_codeverta-verify.erp.ptalpha.com",
    "record_value": "codeverta-verification=..."
  }
}
```

Tambahkan TXT tersebut di DNS customer.

### 12.3 Verifikasi

```bash
curl -sS -X POST \
  http://localhost/api/platform/tenants/alpha/domains/erp.ptalpha.com/verify \
  -H 'Host: admin.example.com' \
  -H 'Authorization: Bearer ACCESS_TOKEN'
```

Resolver Go melakukan DNS TXT lookup. Domain baru dapat me-resolve tenant setelah nilai cocok dan `verified_at` terisi. Pending primary custom domain juga dapat meminta ulang token tanpa membuat row domain duplikat.

## 13. DNS, HAProxy, dan TLS production

DNS platform:

```text
*.erp.example.com  A/AAAA atau CNAME -> load balancer
admin.example.com  A/AAAA atau CNAME -> load balancer
```

Semua hostname tetap mengarah ke frontend dan backend yang sama. Tidak perlu container baru per tenant.

HAProxy saat ini meneruskan semua path `/api` ke `backend-go:8084` dan path lain ke frontend. Original `Host` dipertahankan untuk tenant resolver.

Konfigurasi repository saat ini hanya bind HTTP port 80. Untuk production, terminasi TLS harus ditambahkan pada load balancer/CDN atau HAProxy, misalnya sertifikat wildcard hasil ACME DNS-01. Custom domain memerlukan otomatisasi sertifikat per domain setelah ownership terverifikasi.

Jangan mengaktifkan `X-Tenant-ID` sebagai sumber tenant. Jika memakai CDN/proxy berlapis, batasi daftar trusted proxy agar client tidak dapat memalsukan real IP dan header internal.

## 14. Migrasi schema tenant

Migrasi satu tenant:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.multitenant.yml \
  exec backend-go ./erp tenant migrate alpha
```

Migrasi semua tenant:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.multitenant.yml \
  exec backend-go ./erp tenant migrate --all
```

Runner saat ini:

- melewati tenant `provisioning`, `failed`, dan `terminated`;
- melanjutkan tenant lain jika satu tenant gagal;
- menulis `OK`, `SKIP`, atau `FAILED` per tenant;
- keluar dengan exit code `2` jika ada kegagalan.

Migrasi schema sekarang menggunakan registry `MigrateTenantSchema`/GORM `AutoMigrate`. Untuk perubahan berisiko, gunakan pola expand → deploy/backfill → contract dan backup terlebih dahulu.

## 15. Connection pool tenant

Pool tidak dibuat pada setiap request. Pool pertama dibuat secara lazy dan concurrent request untuk tenant yang sama disatukan dengan `singleflight`, sehingga tidak ada duplicate pool race.

Environment yang tersedia:

```dotenv
TENANT_REGISTRY_CACHE_TTL=5m
TENANT_DB_MAX_OPEN_CONNS=20
TENANT_DB_MAX_IDLE_CONNS=5
TENANT_DB_CONN_MAX_LIFETIME=30m
TENANT_DB_CONN_MAX_IDLE_TIME=5m
TENANT_DB_IDLE_POOL_TTL=15m
```

Pool yang tidak digunakan selama `TENANT_DB_IDLE_POOL_TTL` ditutup. Saat tenant di-suspend atau terminate, pool-nya juga ditutup.

Jangan langsung menaikkan `MAX_OPEN_CONNS` untuk ribuan tenant. Hitung batas MariaDB berdasarkan jumlah pool aktif, bukan total tenant terdaftar.

## 16. Panduan developer: query dan transaction

Di strict mode, query bisnis tidak boleh menggunakan global `model.DB`. Handler lama yang sudah memakai helper ini tetap kompatibel:

```go
db := model.GetDB(c)
```

`model.GetDB(c)` mengambil DB dari tenant middleware. Jika scope hilang pada strict mode, fungsi gagal tertutup dan tidak fallback ke `platform_db`.

Pada service/repository baru, gunakan context:

```go
db, err := tenancy.DBFromContext(ctx)
if err != nil {
    return err
}

return db.WithContext(ctx).Find(&rows).Error
```

Transaction tenant-aware:

```go
err := tenancy.WithTransaction(ctx, func(txCtx context.Context, tx *gorm.DB) error {
    return repository.Save(txCtx, tx, document)
})
```

Jangan:

- membuat fallback ke global DB;
- menerima `tenant_id` dari body/query sebagai pemilih database;
- membuka koneksi baru per request;
- menyimpan DB password di tenant request context;
- menjalankan transaction yang memperoleh DB tenant kedua di tengah callback.

## 17. Authentication tenant

Login pada `alpha.erp.example.com` hanya mencari user di database Alpha. Token ERP menyertakan tenant ID dan middleware mencocokkannya dengan tenant hasil hostname.

Contoh serangan yang ditolak:

```text
Host: beta.erp.example.com
JWT tenant_id: <UUID Alpha>
```

Response adalah `403 FORBIDDEN`. Tenant tidak pernah dipilih dari claim JWT saja.

Platform JWT berbeda dari ERP JWT:

- issuer platform: `codeverta-platform`;
- audience platform: `platform-admin`;
- secret platform terpisah;
- session platform dicek di database dan dapat direvoke;
- platform admin tidak otomatis menjadi user ERP.

## 18. Job, cache, file, dan WebSocket

### Background job

Job baru harus dibuat dengan `tenancy.NewJob`, sehingga payload envelope selalu memiliki tenant ID:

```json
{
  "tenant_id": "tenant-uuid",
  "type": "generate_invoice_pdf",
  "payload": {"invoice_id":"..."}
}
```

Worker menjalankannya melalui `tenancy.JobRunner`. Runner resolve tenant, memastikan status active/trial, membuka DB tenant yang benar, lalu memasang scope ke context handler.

### Redis/cache

Gunakan `tenancy.CacheKey(ctx, ...)`:

```text
tenant:<uuid>:product:123
```

Jangan membuat key global seperti `product:123` untuk data tenant.

### Object storage

Gunakan `tenancy.ObjectKey(ctx, category, filename)`:

```text
tenants/<uuid>/products/image.jpg
```

Bucket harus private. Download handler tetap wajib mencocokkan tenant aktif sebelum membuat signed URL.

### WebSocket

Koneksi WebSocket memeriksa tenant ID token terhadap hostname. Room dan broadcast disekat menurut tenant, misalnya:

```text
tenant:<tenantID>:user:<userID>
```

## 19. Plan dan entitlement

Gunakan service terpusat, bukan `if plan == "business"` di banyak module:

```go
enabled, err := entitlements.Has(ctx, "payroll")
limit, limited, err := entitlements.Limit(ctx, "users")
```

Service membaca plan dari typed tenant context dan cache grant per plan. Perubahan plan/grant harus meng-invalidasi cache plan.

Saat ini tabel dan service entitlement sudah tersedia, tetapi seed katalog plan dan enforcement pada seluruh module bisnis belum lengkap. Jangan menganggap string `starter` atau `business` otomatis membatasi fitur sebelum grant dan guard module dipasang.

## 20. Logging dan error

Log request tenant sebaiknya selalu memiliki:

```text
request_id, tenant_id, tenant_slug, user_id, route, status, duration
```

Jangan log:

- password database hasil decrypt;
- `TENANT_CREDENTIAL_KEY`;
- raw JWT;
- password admin sementara;
- query parameter sensitif atau data personal penuh.

Error tenant yang tersedia meliputi:

```text
TENANT_NOT_FOUND
TENANT_SUSPENDED
TENANT_READ_ONLY
TENANT_PROVISIONING
TENANT_DATABASE_UNAVAILABLE
DOMAIN_NOT_VERIFIED
UNAUTHORIZED
FORBIDDEN
```

## 21. Troubleshooting

### `TENANT_NOT_FOUND`

Periksa:

1. `Host` request sama persis dengan domain registry;
2. domain ada di `tenant_domains`;
3. `verified_at` tidak kosong;
4. tenant bukan `terminated` atau `failed`;
5. tidak ada protocol/path di nilai domain;
6. cache sudah ter-invalidasi setelah perubahan.

### `TENANT_DATABASE_UNAVAILABLE`

Periksa:

1. MariaDB hidup dan dapat dijangkau dari container backend;
2. `database_host` biasanya harus `mysql` jika backend berjalan di Compose;
3. user database masih memiliki grant hanya ke database tenant;
4. `TENANT_CREDENTIAL_KEY` sama dengan key saat tenant dibuat;
5. database tenant tidak dihapus atau dipindah tanpa update registry.

Gunakan endpoint:

```text
GET /api/platform/tenants/:slug/health
```

### `PLATFORM_JWT_SECRET must contain at least 64 characters`

Isi secret platform yang terpisah dan panjang. Jangan memakai placeholder dari `.env.example`.

### Platform API selalu `404`

Pastikan `Host` request sama dengan `PLATFORM_ADMIN_HOST`. Ini perilaku keamanan yang disengaja.

### Tenant berhenti di `failed`

Lihat `provisioning_error` melalui daftar tenant/log server. Provisioning saat ini tidak memiliki command resume otomatis. Jangan menjalankan SQL destruktif sebelum memastikan apakah DB dan user sudah sempat dibuat. Perbaiki akar masalah, backup artefak yang ada, lalu lakukan recovery terkontrol.

### Platform DB tidak muncul pada instalasi lama

MariaDB hanya menerapkan `MYSQL_DATABASE` ketika volume pertama dibuat. Gunakan langkah manual pada bagian “Menjalankan stack multi-tenant”; jangan menghapus volume produksi untuk memaksa inisialisasi.

### JWT Alpha dipakai pada hostname Beta

Request harus ditolak `403`. Jika tidak, pastikan strict mode aktif dan route berada di tenant route group yang memakai tenant resolver dan auth binding.

## 22. Test yang relevan

Jalankan test terarah dari `apps/backend`:

```bash
JWT_SECRET=dummy_secret_for_test_12345678901234567890123456789012345678901234567890 \
go test ./internal/tenancy

JWT_SECRET=dummy_secret_for_test_12345678901234567890123456789012345678901234567890 \
go test ./internal/platform/adminauth ./internal/platform/provisioning \
  ./internal/platform/entitlement ./internal/platform/httpapi

JWT_SECRET=dummy_secret_for_test_12345678901234567890123456789012345678901234567890 \
go test ./middleware -run 'TestTenant|TestAudit'
```

Coverage fondasi saat ini meliputi:

- credential encryption;
- exact verified hostname resolution;
- pending custom primary domain;
- single pool saat request pertama bersamaan;
- isolasi dua database fisik;
- read-only mutation guard;
- JWT/hostname tenant binding;
- namespace cache/object;
- tenant-required background job;
- platform admin host/JWT;
- provisioning state dan entitlement lookup.

Integration test production/CI selanjutnya harus menggunakan dua MariaDB nyata, bukan hanya SQLite test, dan memasukkan kegagalan migrasi salah satu tenant.

## 23. Checklist go-live

Sebelum mengaktifkan mode ini di production:

- [ ] Backup database lama dan file storage.
- [ ] Buat `platform_db` dan user platform least-privilege.
- [ ] Simpan credential key dan JWT secret di secret manager.
- [ ] Buat platform admin dan aktifkan MFA di lapisan access gateway bila tersedia.
- [ ] Siapkan wildcard DNS dan TLS.
- [ ] Provision minimal tenant staging Alpha dan Beta.
- [ ] Pastikan data ber-ID sama di Alpha/Beta tetap berbeda dan tidak bocor.
- [ ] Uji JWT Alpha pada hostname Beta dan pastikan `403`.
- [ ] Uji unknown hostname dan pastikan `404`.
- [ ] Uji suspend/read-only.
- [ ] Audit semua direct global DB access pada module yang akan diaktifkan.
- [ ] Migrasikan job scheduler/worker ke `JobEnvelope` dan `JobRunner`.
- [ ] Migrasikan semua upload/download ke object namespace tenant.
- [ ] Siapkan backup/restore per tenant.
- [ ] Tambahkan observability pool, registry, migration, queue, dan storage.
- [ ] Siapkan rollback deployment dan registry cache invalidation.

## 24. Batas implementasi saat ini

Fondasi isolation request/database sudah tersedia, tetapi beberapa pekerjaan lanjutan masih wajib sebelum klaim production-ready penuh:

1. **Backup, restore, dan export CLI per tenant belum diimplementasikan.**
2. **Migration run history, resume, locking, dan bounded concurrency belum diimplementasikan.** CLI `--all` saat ini berjalan sequential dan tetap melanjutkan setelah error.
3. **Provisioning retry/idempotency key dan cleanup orchestration belum lengkap.** Status gagal tersimpan, tetapi resume otomatis belum ada.
4. **Default module data belum seluruhnya di-seed.** Provisioning saat ini membuat schema, row tenant kompatibilitas, dan admin ERP awal.
5. **Password sementara belum dipaksa berubah oleh policy server.** Pesan `must_change_password` saat ini merupakan instruksi operasional.
6. **Email aktivasi admin awal belum dikirim otomatis.**
7. **Queue/scheduler existing belum seluruhnya dipindahkan ke tenant job runner.** Helper fondasi sudah tersedia.
8. **Storage handler existing belum seluruhnya memakai `ObjectKey`.** Helper fondasi sudah tersedia.
9. **Xendit dan dispatcher webhook lama sengaja tidak didaftarkan pada strict mode** sampai terdapat mapping account/provider ke tenant yang aman.
10. **Plan belum otomatis menegakkan semua limit.** Model dan service entitlement tersedia, tetapi guard tiap fitur harus dipasang bertahap.
11. **TLS production tidak dikonfigurasi oleh HAProxy repository saat ini.** TLS harus diterminasi oleh load balancer/CDN atau konfigurasi HAProxy production.
12. **Audit seluruh global DB call belum boleh dianggap selesai untuk semua module legacy.** Strict request scope mencegah fallback utama, tetapi setiap worker, callback pihak ketiga, dan maintenance command tetap harus diaudit sebelum diaktifkan.

Karena data antar-perusahaan adalah batas keamanan kritis, jangan mengaktifkan route/job legacy yang belum tenant-aware hanya agar fitur terlihat berjalan. Lebih aman route tersebut gagal tertutup sampai mapping tenant-nya jelas.

## 25. Urutan rollout dari sistem lama

1. Deploy code baru tetapi tetap gunakan legacy mode.
2. Buat dan backup `platform_db`.
3. Catat registry tenant dan domain dengan credential terenkripsi.
4. Clone satu tenant internal ke database fisik terpisah.
5. Jalankan migrasi dan isolation test di staging.
6. Audit module yang dipakai tenant staging dari handler sampai job/storage.
7. Aktifkan `TENANCY_MODE=database-per-tenant` di staging.
8. Migrasikan tenant production secara batch kecil dengan rekonsiliasi data.
9. Aktifkan strict mode production setelah checklist isolasi lulus.
10. Hapus ketergantungan pada shared business database hanya setelah semua tenant tervalidasi.

Invariant akhir yang harus selalu dijaga:

```text
platform_db hanya untuk control plane.
Setiap read, write, transaction, job, cache, file, dan realtime ERP
harus mempunyai tepat satu tenant yang sudah di-resolve dan diverifikasi.
```
