# Guide registrasi Meta Messaging untuk CRM

Dokumen ini menjelaskan cara mendapatkan dan mengisi seluruh variabel `.env` untuk inbox WhatsApp Cloud API, Instagram Messaging, dan Facebook Messenger.

Integrasi menggunakan satu callback backend:

```text
/api/crm/webhooks/meta_messaging?tenant_id=<TENANT_UUID>
```

> Untuk production, callback harus HTTPS dan dapat diakses publik. Meta tidak dapat memanggil `localhost` secara langsung.

## Jawaban singkat: jika hanya DM Instagram

Anda hanya perlu mengisi lima variable berikut:

```dotenv
META_GRAPH_API_VERSION=v26.0
META_APP_SECRET=<app-secret-dari-meta-app>
META_WEBHOOK_VERIFY_TOKEN=<buat-sendiri>
META_INSTAGRAM_ACCESS_TOKEN=<generate-token-di-instagram-api-setup>
META_INSTAGRAM_ACCOUNT_ID=<user_id-dari-endpoint-me>
```

Biarkan variable WhatsApp dan Facebook kosong. Dengan **Instagram API with Instagram Login**, Anda tidak perlu membuat atau menghubungkan Facebook Page. Akun Instagram harus Professional (Business atau Creator) dan public.

Urutan tercepatnya:

1. Masuk ke [Meta App Dashboard](https://developers.facebook.com/apps/).
2. Klik **Create App → Other → Business**.
3. Di halaman aplikasi, cari produk **Instagram** lalu klik **Set up**.
4. Buka menu **Instagram → API setup with Instagram business login**.
5. Tambahkan akun Instagram Professional, lalu klik **Generate token** di samping akun tersebut.
6. Salin token ke `META_INSTAGRAM_ACCESS_TOKEN`.
7. Ambil `META_INSTAGRAM_ACCOUNT_ID` melalui endpoint `/me` seperti dijelaskan pada bagian Instagram di bawah.
8. Buka **App settings → Basic → App Secret → Show**, lalu salin ke `META_APP_SECRET`.
9. Buat verify token sendiri, isi ke `.env`, lalu gunakan nilai yang sama saat mengonfigurasi webhook.

## 1. Siapkan backend

Salin file contoh ke file environment backend, lalu isi nilainya:

```bash
cd /Users/rabihutomo/code/erp.codeverta.com/apps/backend
cp .env.example .env
```

> Jangan commit `.env`. Simpan secret di secret manager pada production.

### Secret lokal yang harus dibuat sendiri

| Variable | Cara membuat | Keterangan |
| --- | --- | --- |
| `JWT_SECRET` | `openssl rand -base64 64` | Minimal 64 karakter; signing access token. |
| `SESSION_SECRET` | `openssl rand -base64 64` | Signing/enkripsi session backend. |
| `DB_ENCRYPTION_KEY` | `openssl rand -hex 16` | Harus tepat 32 karakter/byte; mengenkripsi credential CRM yang disimpan dari UI. Jangan ganti setelah credential tersimpan tanpa proses re-enkripsi. |
| `DB_HMAC_KEY` | `openssl rand -base64 32` | Secret untuk blind index/HMAC data sensitif. Simpan stabil dan jangan dicetak ke log. |
| `META_WEBHOOK_VERIFY_TOKEN` | `openssl rand -hex 24` | String buatan sendiri. Nilai yang sama diisi pada Meta Webhook Verify Token. |

> Jika `DB_ENCRYPTION_KEY` belum ada, halaman **CRM → Integrations → Meta Messaging** tidak dapat menyimpan access token melalui UI. Penggunaan `.env` tetap dapat dipakai sebagai fallback server.

## 2. Buat Meta App

1. Buka [Meta for Developers](https://developers.facebook.com/apps/) lalu pilih **Create App**.
2. Pilih **Other → Next → Business**, kemudian masukkan nama aplikasi serta email developer.
3. Di **App settings → Basic**, salin **App Secret** setelah menekan **Show**. Nilai ini menjadi `META_APP_SECRET`.
4. Jika hanya membutuhkan DM Instagram, tambahkan produk **Instagram** saja dengan menekan **Set up**.

## 3. Daftar WhatsApp Cloud API

1. Buka produk **WhatsApp → API Setup** pada Meta App Dashboard.
2. Hubungkan atau buat **Meta Business Account**.
3. Untuk pengujian, gunakan temporary access token yang tersedia di API Setup. Untuk production, buat **System User** di [Business Settings](https://business.facebook.com/settings/), berikan aset WhatsApp dan permission messaging, lalu buat token permanen/long-lived.
4. Salin nilai **Phone number ID** dari panel API Setup ke `META_WHATSAPP_PHONE_NUMBER_ID`.
5. Isi token WhatsApp ke `META_WHATSAPP_ACCESS_TOKEN`.

`META_ACCESS_TOKEN` boleh diisi sebagai fallback, tetapi token per channel lebih aman karena scope asetnya jelas.

Permission yang biasanya diperlukan untuk Cloud API adalah permission WhatsApp Business yang ditampilkan pada konfigurasi aplikasi dan Business Manager. Gunakan scope yang diminta oleh versi API/jenis akun yang sedang aktif; Meta dapat mengubah nama atau review permission.

## 4. Daftar Facebook Messenger

1. Buat atau pilih **Facebook Page** yang akan menerima pesan.
2. Pada produk **Messenger**, hubungkan Page tersebut ke aplikasi.
3. Dapatkan **Page access token** melalui [Graph API Explorer](https://developers.facebook.com/tools/explorer/) atau Business Manager. Token harus memiliki permission untuk membaca dan mengirim pesan Page.
4. Isi token ke `META_FACEBOOK_PAGE_ACCESS_TOKEN`.
5. Ambil ID Page. Cara praktis melalui Graph API Explorer:

   ```text
   GET /me/accounts?fields=id,name,access_token
   ```

   Nilai `id` Page diisi ke `META_FACEBOOK_PAGE_ID`. Jangan masukkan App ID.

6. Pada **Messenger → Settings → Webhooks**, subscribe Page ke aplikasi dan aktifkan event pesan, delivery, read, dan postback yang dibutuhkan.

Contoh endpoint Graph untuk subscribe Page (jalankan dengan Page token yang sesuai):

```text
POST /<META_FACEBOOK_PAGE_ID>/subscribed_apps?subscribed_fields=messages,messaging_postbacks,message_deliveries,message_reads
```

## 5. Daftar Instagram Messaging

1. Di aplikasi Instagram, buka **Settings and activity → Account type and tools → Switch to professional account**. Pilih Business atau Creator dan pastikan profil public.
2. Masuk ke [Meta App Dashboard](https://developers.facebook.com/apps/), buka aplikasi Business Anda, lalu pilih **Instagram → API setup with Instagram business login**.
3. Pada bagian **Generate access tokens**, klik **Add account**, login menggunakan akun Instagram Professional, dan izinkan akses.
4. Setelah akun tercantum, klik **Generate token** di samping akun tersebut. Login kembali jika diminta, lalu salin token. Token yang dibuat dari App Dashboard bersifat long-lived dan menurut dokumentasi Meta saat ini berlaku 60 hari.
5. Isi token tersebut ke `META_INSTAGRAM_ACCESS_TOKEN`.
6. Ambil Instagram Professional Account ID dengan request berikut. Ganti token tanpa tanda `<` dan `>`:

   ```bash
   curl "https://graph.instagram.com/v26.0/me?fields=user_id,username&access_token=<META_INSTAGRAM_ACCESS_TOKEN>"
   ```

   Responsnya akan berisi `user_id` dan `username`. Salin nilai `user_id` ke `META_INSTAGRAM_ACCOUNT_ID`; jangan memakai username atau App-scoped `id`.

7. Di halaman **Instagram → API setup with Instagram business login**, cari bagian **Configure webhooks** lalu klik **Configure**.
8. Masukkan callback URL CRM dan nilai `META_WEBHOOK_VERIFY_TOKEN`, lalu klik **Save**.
9. Klik **Manage** dan pastikan minimal field `messages` aktif. Untuk inbox yang lebih lengkap aktifkan juga `messaging_postbacks`, `messaging_reactions`, `messaging_seen`, `messaging_optins`, dan `messaging_referrals` jika tersedia.

Permission yang diperlukan untuk DM Instagram pada alur ini adalah `instagram_business_basic` dan `instagram_business_manage_messages`. Standard Access cukup untuk akun yang Anda miliki/kelola atau sudah ditambahkan sebagai tester. Jika aplikasi akan dipakai oleh akun pelanggan lain, hubungkan verified business portfolio dan ajukan Advanced Access melalui **App Review → Requests**.

Rujukan resmi: [Create an Instagram app](https://developers.facebook.com/documentation/instagram-platform/create-an-instagram-app), [Generate Instagram token dan User ID](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/get-started), dan [Send Instagram messages](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api).

## 6. Isi semua variabel Meta

| Variable | Wajib | Sumber/nilai |
| --- | --- | --- |
| `META_GRAPH_API_VERSION` | Ya | Versi Graph API yang masih didukung Meta. Dokumentasi Instagram terbaru saat panduan ini diperbarui menggunakan `v26.0`. |
| `META_APP_SECRET` | Ya | **Meta App → App settings → Basic → App Secret → Show**. Dipakai untuk memvalidasi `X-Hub-Signature-256`. |
| `META_WEBHOOK_VERIFY_TOKEN` | Ya | String acak buatan sendiri. Tidak berasal dari Meta; harus sama pada backend dan form webhook Meta. |
| `META_ACCESS_TOKEN` | Opsional | Token fallback umum. Dipakai hanya jika token channel-specific kosong. |
| `META_WHATSAPP_ACCESS_TOKEN` | Untuk WhatsApp | System User token atau token API Setup dengan akses ke WhatsApp Business Account. |
| `META_FACEBOOK_PAGE_ACCESS_TOKEN` | Untuk Facebook | Long-lived Page access token untuk Page yang terhubung. |
| `META_INSTAGRAM_ACCESS_TOKEN` | Untuk Instagram | **Meta App → Instagram → API setup with Instagram business login → Generate token**. |
| `META_WHATSAPP_PHONE_NUMBER_ID` | Untuk WhatsApp | **WhatsApp → API Setup → Phone number ID**. Ini bukan nomor telepon pelanggan. |
| `META_FACEBOOK_PAGE_ID` | Untuk Facebook | ID Page dari `/me/accounts`, bukan App ID dan bukan User ID. |
| `META_INSTAGRAM_ACCOUNT_ID` | Untuk Instagram | Nilai `user_id` dari `GET https://graph.instagram.com/v26.0/me?fields=user_id,username`. |

Contoh konfigurasi:

```dotenv
META_GRAPH_API_VERSION=v26.0
META_APP_SECRET=...
META_WEBHOOK_VERIFY_TOKEN=...

META_ACCESS_TOKEN=
META_WHATSAPP_ACCESS_TOKEN=...
META_FACEBOOK_PAGE_ACCESS_TOKEN=...
META_INSTAGRAM_ACCESS_TOKEN=...

META_WHATSAPP_PHONE_NUMBER_ID=123456789012345
META_FACEBOOK_PAGE_ID=123456789012345
META_INSTAGRAM_ACCOUNT_ID=17840000000000000
```

Backend tidak mengirim nilai secret kembali ke browser. Alternatifnya, credential dapat dimasukkan pada halaman **CRM → Integrations → Meta Messaging**; nilainya disimpan terenkripsi menggunakan `DB_ENCRYPTION_KEY`.

## 7. Daftarkan webhook

1. Pastikan backend berjalan dan URL publik HTTPS sudah tersedia.
2. Di CRM buka **Integrations** dan salin callback URL. Bentuk lengkapnya:

   ```text
   https://api.example.com/api/crm/webhooks/meta_messaging?tenant_id=<TENANT_UUID>
   ```

3. Pada Meta App Dashboard, masukkan URL tersebut pada webhook object yang sesuai.
4. Isi `META_WEBHOOK_VERIFY_TOKEN` pada kolom **Verify Token**.
5. Klik **Verify and Save**.
6. Aktifkan subscription pesan untuk WhatsApp, Facebook Page, dan Instagram yang terhubung.

`tenant_id` harus tenant UUID yang sah di ERP. Tenant dapat dilihat dari user/session admin atau nilai `VITE_X_TENANT_ID` pada frontend; jangan memakai nama tenant.

## 8. Verifikasi lokal

Gunakan tunnel HTTPS seperti ngrok atau Cloudflare Tunnel yang meneruskan ke port backend `8084`. Setelah URL tunnel dimasukkan di Meta, uji challenge webhook:

```bash
curl "https://<tunnel-domain>/api/crm/webhooks/meta_messaging?tenant_id=<TENANT_UUID>&hub.mode=subscribe&hub.verify_token=<META_WEBHOOK_VERIFY_TOKEN>&hub.challenge=crm-test"
```

Respons yang benar adalah teks `crm-test`. Jika mendapat `403`, periksa verify token, integration aktif, tenant ID, dan apakah backend membaca file `.env` yang benar.

Setelah webhook aktif, kirim pesan ke nomor WhatsApp/Page/Instagram yang terhubung. Percakapan akan muncul di **CRM → Inbox Chat**. Balasan teks dikirim dari backend melalui Graph API; media masuk saat ini disimpan sebagai tipe dan media ID/URL.

## 9. Troubleshooting

| Gejala | Pemeriksaan |
| --- | --- |
| `Meta Messaging belum dikonfigurasi` | Pastikan integration enabled atau semua secret minimal (`META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, dan salah satu access token) terisi. Restart backend setelah mengubah `.env`. |
| Challenge webhook gagal | URL harus publik HTTPS, `tenant_id` valid, dan verify token harus persis sama tanpa spasi. |
| `invalid webhook signature` | `META_APP_SECRET` harus berasal dari App yang mengirim webhook; jangan memakai Page Secret atau access token. |
| Pesan masuk tidak muncul | Periksa object/field subscription di Meta, Page/Instagram sudah subscribe ke App, dan ID account sesuai aset yang menerima pesan. |
| Balasan `permission`/`(#10)` | Token tidak memiliki permission atau aset yang benar. Buat token baru dari System User/Page dan pastikan aset ditambahkan ke user tersebut. |
| WhatsApp membalas gagal di luar 24 jam | WhatsApp mengharuskan template message untuk percakapan di luar customer service window. Implementasi inbox saat ini mengirim pesan teks session reply. |
| Token tersimpan UI gagal | Isi `DB_ENCRYPTION_KEY` tepat 32 byte dan jangan mengubahnya setelah credential terenkripsi tersimpan. |

## 10. Keamanan

- Jangan menaruh access token atau App Secret di `apps/admin/.env` dengan prefix `VITE_`; variabel tersebut akan masuk bundle browser.
- Jangan commit `.env`, log token, atau menyalin token ke issue/chat.
- Gunakan token berbeda untuk development dan production.
- Jika token pernah bocor, revoke dari Meta Business Settings lalu buat token baru.
- Gunakan HTTPS, batasi akses server, dan rotasi credential secara berkala.

## 11. Variabel `.env` backend lainnya

Variabel berikut bukan credential channel Meta, tetapi dipakai oleh aplikasi ERP dan harus diisi sesuai deployment:

| Variable | Cara mendapatkan/mengisi |
| --- | --- |
| `PORT` | Port HTTP backend, default `8084`. Sesuaikan dengan reverse proxy/container. |
| `GIN_MODE` | `debug` untuk lokal, `release` untuk production. |
| `SQL_DSN` | DSN dari administrator MySQL/MariaDB. Jangan memakai password contoh. |
| `REDIS_CONN_STRING` | URL Redis dari instance deployment, misalnya `redis://redis:6379/0`. |
| `TENCENTCLOUD_SECRET_ID` / `TENCENTCLOUD_SECRET_KEY` | Buat API key di Tencent Cloud CAM dan beri akses minimum ke COS/SES yang digunakan. |
| `DISCORD_WEBHOOK_URL` | Discord Server → channel → **Edit Channel → Integrations → Webhooks → New Webhook**. Opsional untuk notifikasi. |
| `DISPATCHER_WEBHOOK_SECRET` | Buat random secret sendiri untuk endpoint dispatcher internal. |
| `XENDIT_SECRET_KEY` | Xendit Dashboard → **Developers → API Keys**. Simpan secret key hanya di backend. |
| `XENDIT_WEBHOOK_TOKEN` | Token callback/webhook Xendit yang dikonfigurasi di dashboard dan harus sama dengan backend. |
| `STORE_FRONTEND_URL` | URL publik landing/checkout, misalnya `https://app.example.com`; dipakai untuk redirect pembayaran. |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | Google Cloud Console → **APIs & Services → Credentials → OAuth 2.0 Client ID**. |
| `GOOGLE_OAUTH_REDIRECT_URL` | Tambahkan URL ini ke **Authorized redirect URIs**, misalnya `https://api.example.com/api/auth/google/callback`. |
| `GOOGLE_OAUTH_FRONTEND_URL` | URL frontend yang menerima hasil login OAuth, misalnya `https://app.example.com`. |

## 12. Variabel `.env` admin/frontend

Isi `apps/admin/.env` untuk build frontend admin:

| Variable | Cara mendapatkan/mengisi |
| --- | --- |
| `VITE_BASE_API_URL` | Base URL backend, misalnya `http://localhost:8084` atau `https://api.example.com`. Jangan tambahkan `/api` jika konfigurasi Axios sudah menambahkannya. |
| `VITE_X_TENANT_ID` | UUID tenant ERP yang digunakan saat development. Ini bukan secret. |
| `VITE_COS_CDN_BASE_URL` | URL CDN publik Tencent COS, jika file/media memakai COS. |
| `VITE_SENTRY_DSN` | Sentry Project → **Settings → Client Keys (DSN)**. Opsional untuk error monitoring. |

Variabel yang memiliki prefix `VITE_` masuk ke bundle browser. Jangan pernah menaruh `META_*`, `XENDIT_SECRET_KEY`, OAuth secret, atau credential database di file frontend.
