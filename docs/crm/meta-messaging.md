# Meta Messaging untuk CRM

CRM menyediakan satu inbox untuk WhatsApp Cloud API, Instagram Messaging, dan Facebook Messenger.

## Konfigurasi server

Isi credential di `apps/backend/.env` berdasarkan contoh di `apps/backend/.env.example`:

```dotenv
META_GRAPH_API_VERSION=v24.0
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=

# Token umum sebagai fallback. Token per kanal di bawah lebih disarankan.
META_ACCESS_TOKEN=
META_WHATSAPP_ACCESS_TOKEN=
META_FACEBOOK_PAGE_ACCESS_TOKEN=
META_INSTAGRAM_ACCESS_TOKEN=

META_WHATSAPP_PHONE_NUMBER_ID=
META_FACEBOOK_PAGE_ID=
META_INSTAGRAM_ACCOUNT_ID=
```

Credential juga dapat disimpan melalui **CRM → Integrations → Meta Messaging**. Jika disimpan melalui UI, nilainya dienkripsi menggunakan `DB_ENCRYPTION_KEY` dan tidak dikirim kembali ke browser.

## Webhook Meta

Gunakan callback URL yang ditampilkan di halaman Integrations:

```text
https://<domain-api>/api/crm/webhooks/meta_messaging?tenant_id=<TENANT_UUID>
```

Gunakan nilai `META_WEBHOOK_VERIFY_TOKEN` sebagai verify token. Aktifkan event pesan untuk WhatsApp dan field messaging yang diperlukan untuk Facebook Page/Instagram pada Meta App Dashboard. Endpoint memvalidasi header `X-Hub-Signature-256` menggunakan `META_APP_SECRET`, menolak signature yang tidak valid, dan menangani retry webhook secara idempotent.

Callback production harus berupa URL HTTPS publik. URL `localhost` tidak dapat dipanggil langsung oleh Meta; gunakan tunnel HTTPS saat pengembangan lokal.

## Alur data

1. Meta mengirim pesan atau delivery status ke webhook.
2. Backend mencari atau membuat conversation tenant-scoped.
3. Pesan disimpan di `crm_messages`; retry dengan external message ID yang sama diabaikan.
4. Inbox CRM memuat pesan dan memperbarui tampilan setiap 10 detik.
5. Balasan dikirim server-side melalui Graph API dan disimpan sebagai outbound message.

Pesan media saat ini dicatat sebagai tipe dan media ID/URL. Pengunduhan media privat dari Graph API dapat ditambahkan kemudian jika file perlu disalin ke penyimpanan internal.
