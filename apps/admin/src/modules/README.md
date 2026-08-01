# Admin modules

Semua entry halaman admin baru berada di `src/modules/<domain>`. Folder
`pages/dashboard` masih dipertahankan sementara sebagai sumber kompatibilitas
untuk portal non-admin dan import lama, tetapi tidak lagi diregistrasikan sebagai
route admin. Route `/dashboard/*` yang lama mengarahkan admin ke route `/desk/*`.

Pemetaan halaman core lama:

- Organization: Users, Tenants
- Selling: Orders, Subscriptions, Promotions
- Accounting: Core Finance
- Communication: Email Templates, Email Broadcast
- Administration: Audit Log
- Settings: System Configuration
