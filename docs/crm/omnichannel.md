Untuk integrasi WhatsApp, Instagram, dan X, konsepnya adalah **omnichannel messaging**: semua pesan dari ketiga channel itu masuk ke satu "unified inbox" di dalam CRM, bukan dikelola terpisah-pisah. Saya gambarkan dulu arsitektur alurnya:## Detail per channel

**WhatsApp Business (Cloud API)**
- Kirim/terima teks, gambar, dokumen, lokasi
- **Session window 24 jam**: balasan bebas hanya bisa dalam 24 jam sejak pesan terakhir dari customer. Di luar itu, wajib pakai **template message** yang sudah di-approve Meta
- Interactive message (quick reply button, list menu)
- Broadcast/blast ke banyak kontak sekaligus — tetap butuh template & opt-in customer
- Status pesan: terkirim / diterima / dibaca (via webhook callback)
- Bisa multi-agent dalam satu nomor WA Business

**Instagram (Meta Graph API — Instagram Messaging)**
- DM masuk/keluar, plus fitur khas Instagram: **reply ke komentar jadi DM**, **story mention/reply**
- Sama seperti WA, ada window 24 jam untuk balas bebas (ada pengecualian "human agent tag" untuk kasus tertentu)
- Perlu akun Instagram Business/Creator yang terhubung ke Facebook Page
- Ice breaker & quick reply saat DM pertama kali dibuka

**X (Twitter API v2)**
- DM masuk/keluar — butuh akses tier berbayar (tier gratis sangat terbatas untuk produksi)
- Monitoring **mention & keyword** (social listening) — tweet yang menyebut brand otomatis masuk ke CRM sebagai "mention" record
- Reply ke tweet publik langsung dari CRM (opsional)
- Tidak ada session window seperti WA/IG, tapi tetap ada rate limit ketat per endpoint

## Tambahan skema database

```sql
-- Akun channel yang terhubung ke CRM (bisa lebih dari satu nomor/akun per channel)
CREATE TABLE channel_accounts (
    id SERIAL PRIMARY KEY,
    channel_type VARCHAR(20) NOT NULL,      -- whatsapp, instagram, x
    account_name VARCHAR(150),
    external_account_id VARCHAR(100),       -- phone number ID / IG business ID / X user ID
    access_token_ref VARCHAR(255),          -- referensi ke secret vault, bukan token mentah
    webhook_verify_token VARCHAR(150),
    status VARCHAR(20) DEFAULT 'connected', -- connected, disconnected, error
    connected_by INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT now()
);

-- Percakapan (satu thread per contact per channel)
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    channel_account_id INT REFERENCES channel_accounts(id),
    contact_id INT REFERENCES contacts(id),
    lead_id INT REFERENCES leads(id),
    external_thread_id VARCHAR(150),
    status VARCHAR(20) DEFAULT 'open',      -- open, pending, closed
    assigned_to INT REFERENCES users(id),
    last_message_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT now()
);

-- Pesan individual dalam sebuah percakapan
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id INT REFERENCES conversations(id),
    direction VARCHAR(10) NOT NULL,         -- inbound, outbound
    sender_type VARCHAR(20),                -- customer, agent, system
    message_type VARCHAR(20) DEFAULT 'text',-- text, image, document, comment_reply, story_reply
    content TEXT,
    external_message_id VARCHAR(150),
    status VARCHAR(20) DEFAULT 'sent',      -- sent, delivered, read, failed
    created_at TIMESTAMP DEFAULT now()
);

-- Template pesan (wajib untuk WhatsApp di luar window 24 jam)
CREATE TABLE message_templates (
    id SERIAL PRIMARY KEY,
    channel_type VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    approval_status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    created_at TIMESTAMP DEFAULT now()
);

-- Mention/komentar publik dari X & Instagram (social listening)
CREATE TABLE social_mentions (
    id SERIAL PRIMARY KEY,
    channel_account_id INT REFERENCES channel_accounts(id),
    external_post_id VARCHAR(150),
    mention_type VARCHAR(20),               -- mention, comment, story_mention
    content TEXT,
    contact_id INT REFERENCES contacts(id),
    status VARCHAR(20) DEFAULT 'new',       -- new, in_review, converted, ignored
    created_at TIMESTAMP DEFAULT now()
);
```

**Relasi:** `channel_accounts` 1—N `conversations` → 1—N `messages`. `contacts`/`leads` bisa punya banyak `conversations` lintas channel, sehingga histori chat WA + DM IG + mention X dari orang yang sama tetap terlihat dalam satu profil kontak.

## Catatan teknis & kepatuhan penting

- **Verifikasi webhook**: setiap payload masuk harus divalidasi signature-nya (X-Hub-Signature untuk Meta, OAuth signature untuk X) agar tidak menerima data palsu.
- **Opt-in/consent**: khusus WhatsApp broadcast, customer harus pernah memulai percakapan atau memberi consent eksplisit — kalau tidak, nomor bisa kena banned oleh Meta.
- **Rate limit & retry queue**: pesan keluar sebaiknya lewat antrean (queue) dengan retry, karena ketiga API punya rate limit yang bisa memblokir pengiriman massal.
- **Auto-create lead**: pesan pertama dari nomor/username baru bisa otomatis membuat record `leads` baru — mengaitkan channel messaging langsung ke funnel penjualan yang sudah dirancang sebelumnya.

Mau saya tambahkan bagian ini ke file `Desain-CRM-Lengkap.md` yang sudah dibuat sebelumnya, jadi satu dokumen utuh?