# Desain CRM (Customer Relationship Management)

Dokumen ini berisi rancangan lengkap sistem CRM: daftar fitur, alur bisnis (business flow), dan desain database (ERD + skema SQL).

---

## 1. Daftar Fitur CRM

### A. Manajemen Lead & Prospek
- Lead capture (form web, landing page, import CSV, API dari iklan/social media)
- Lead scoring (otomatis berdasarkan aktivitas & profil)
- Lead source tracking (asal lead: organik, iklan, referral, event, cold call)
- Auto-assignment lead ke sales rep (round robin / berdasarkan wilayah/produk)
- Lead status: New, Contacted, Qualified, Unqualified, Converted

### B. Manajemen Kontak & Perusahaan (Account)
- Data kontak (individu) dan akun (perusahaan)
- Riwayat interaksi per kontak/akun
- Hierarki perusahaan (parent-child company)
- Tagging & segmentasi (industri, ukuran perusahaan, wilayah)

### C. Manajemen Peluang / Deal (Opportunity)
- Sales pipeline dengan tahapan yang bisa dikustomisasi (Prospecting → Qualification → Proposal → Negotiation → Closed Won/Lost)
- Nilai deal, probabilitas menang, estimasi tanggal closing
- Drag-and-drop kanban pipeline view
- Forecast penjualan (revenue forecast per periode/rep)
- Alasan kalah (lost reason) untuk analisis

### D. Manajemen Aktivitas & Tugas
- Log aktivitas: telepon, email, meeting, catatan
- Task & reminder dengan due date
- Kalender terintegrasi
- Notifikasi follow-up otomatis

### E. Otomasi & Workflow
- Auto-assignment lead/deal
- Email/notifikasi otomatis saat status berubah
- Reminder follow-up otomatis jika deal tidak ada aktivitas dalam X hari
- Template email

### F. Penjualan (Sales Ops)
- Quotation / penawaran harga
- Sales order
- Invoice (atau integrasi ke sistem akunting/ERP)
- Katalog produk & price list

### G. Layanan Pelanggan (Customer Service)
- Tiket support (create, assign, prioritas, SLA)
- Riwayat komunikasi per tiket
- Knowledge base (opsional)
- Customer satisfaction survey (opsional)

### H. Pemasaran (Marketing, opsional tapi umum di CRM modern)
- Kampanye email/blast
- Segmentasi audiens untuk campaign
- Tracking hasil campaign (open rate, klik, konversi ke lead)

### I. Laporan & Dashboard
- Sales funnel/conversion rate
- Revenue forecast & win rate
- Aktivitas sales per rep
- Customer retention & churn
- Dashboard yang bisa dikustomisasi per role

### J. Administrasi & Keamanan
- Manajemen user & role/permission (Admin, Sales Manager, Sales Rep, Support Agent)
- Audit log / activity trail
- Multi-team / multi-divisi
- Manajemen dokumen & lampiran file per record

### K. Integrasi
- Email (Gmail/Outlook)
- Telepon/VoIP & WhatsApp Business
- Kalender (Google Calendar)
- Integrasi akunting/ERP untuk invoice
- API/webhook untuk integrasi pihak ketiga

---

## 2. Alur Bisnis (Business Flow)

**Tahap 1 — Akuisisi Lead**
Lead masuk dari berbagai sumber (website, iklan, referral, event, cold call) → dicatat sebagai record **Lead** dengan status `New`.

**Tahap 2 — Kualifikasi**
Sales/marketing melakukan kualifikasi (MQL → SQL) menggunakan lead scoring. Lead di-assign ke sales rep tertentu (manual atau otomatis).

**Tahap 3 — Follow-up**
Sales rep melakukan follow-up (call, email, meeting), semua tercatat sebagai **Activity** yang terhubung ke lead tersebut.

**Tahap 4 — Konversi**
Jika lead layak lanjut, lead dikonversi menjadi **Contact** + **Account** (jika belum ada), dan dibuatkan **Opportunity/Deal** baru.

**Tahap 5 — Sales Pipeline**
Opportunity berjalan melalui tahapan pipeline (Prospecting → Qualification → Proposal → Negotiation) sambil terus dicatat aktivitasnya. Setiap tahap punya probabilitas menang default.

**Tahap 6 — Closing**
Deal berakhir sebagai **Closed Won** atau **Closed Lost**. Jika kalah, dicatat lost reason untuk analisis.

**Tahap 7 — Order & Invoice**
Jika menang, dibuatkan **Quotation** → **Sales Order** → **Invoice**. Data ini bisa terintegrasi ke sistem akunting.

**Tahap 8 — Pelanggan Aktif**
Account berubah status menjadi **Customer** aktif, masuk ke manajemen akun pelanggan jangka panjang.

**Tahap 9 — Pasca Jual**
Customer dapat mengajukan **Support Ticket**, menerima program retensi (renewal reminder, upsell/cross-sell campaign).

**Tahap 10 — Analitik**
Semua data dari tahap 1–9 diagregasi ke **Dashboard & Laporan** untuk evaluasi performa sales, marketing, dan customer service — hasilnya menjadi feedback untuk strategi berikutnya.

---

## 3. Desain Database

### 3.1 Daftar Tabel & Relasi Utama

| Tabel | Fungsi | Relasi Kunci |
|---|---|---|
| `users` | Akun internal (sales, admin, support) | `role_id` → `roles` |
| `roles` | Role & permission | — |
| `leads` | Data prospek sebelum konversi | `assigned_to` → `users`, `converted_account_id` → `accounts` |
| `accounts` | Data perusahaan/pelanggan | `owner_id` → `users` |
| `contacts` | Data kontak individu | `account_id` → `accounts`, `owner_id` → `users` |
| `pipeline_stages` | Master tahapan pipeline | — |
| `opportunities` | Deal/peluang penjualan | `account_id`, `contact_id`, `stage_id`, `owner_id` |
| `activities` | Log call/email/meeting/task | polymorphic ke `leads`/`contacts`/`opportunities` |
| `products` | Katalog produk/layanan | — |
| `quotations` | Penawaran harga | `opportunity_id` → `opportunities` |
| `quotation_items` | Item dalam quotation | `quotation_id`, `product_id` |
| `sales_orders` | Order setelah deal menang | `opportunity_id`, `quotation_id` |
| `invoices` | Tagihan | `sales_order_id` |
| `tickets` | Tiket support | `account_id`, `contact_id`, `assigned_to` |
| `ticket_comments` | Percakapan dalam tiket | `ticket_id`, `user_id` |
| `campaigns` | Kampanye marketing | `created_by` → `users` |
| `campaign_members` | Peserta campaign | `campaign_id`, `lead_id`/`contact_id` |
| `notes` | Catatan bebas | polymorphic |
| `attachments` | Lampiran file | polymorphic |
| `tags` / `taggables` | Label/segmentasi | polymorphic |
| `audit_logs` | Jejak perubahan data | `user_id` |
| `notifications` | Notifikasi in-app | `user_id` |

> Kolom `related_to_type` + `related_to_id` di atas adalah pola **polymorphic relation**: satu tabel (misal `activities`) bisa terhubung ke beberapa jenis tabel lain (`leads`, `contacts`, `opportunities`, `tickets`) tanpa perlu foreign key terpisah untuk masing-masing.

### 3.2 Skema SQL Lengkap

```sql
-- =========================
-- USER & AKSES
-- =========================
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,      -- Admin, Sales Manager, Sales Rep, Support Agent
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    role_id INT REFERENCES roles(id),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    avatar_url VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- =========================
-- LEAD
-- =========================
CREATE TABLE leads (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(30),
    company_name VARCHAR(150),
    source VARCHAR(50),                    -- website, iklan, referral, event, cold_call
    status VARCHAR(30) DEFAULT 'new',       -- new, contacted, qualified, unqualified, converted
    score INT DEFAULT 0,
    assigned_to INT REFERENCES users(id),
    converted_account_id INT,               -- diisi setelah convert
    converted_contact_id INT,
    converted_opportunity_id INT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT now(),
    converted_at TIMESTAMP
);

-- =========================
-- ACCOUNT & CONTACT
-- =========================
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    industry VARCHAR(100),
    website VARCHAR(150),
    phone VARCHAR(30),
    address TEXT,
    parent_account_id INT REFERENCES accounts(id),  -- hierarki perusahaan
    owner_id INT REFERENCES users(id),
    status VARCHAR(30) DEFAULT 'prospect',  -- prospect, customer, churned
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE contacts (
    id SERIAL PRIMARY KEY,
    account_id INT REFERENCES accounts(id),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    email VARCHAR(150),
    phone VARCHAR(30),
    position VARCHAR(100),
    owner_id INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT now()
);

-- =========================
-- SALES PIPELINE & OPPORTUNITY
-- =========================
CREATE TABLE pipeline_stages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,             -- Prospecting, Qualification, Proposal, Negotiation, Closed Won, Closed Lost
    sort_order INT NOT NULL,
    default_probability NUMERIC(5,2) DEFAULT 0
);

CREATE TABLE opportunities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    account_id INT REFERENCES accounts(id),
    contact_id INT REFERENCES contacts(id),
    stage_id INT REFERENCES pipeline_stages(id),
    amount NUMERIC(15,2),
    probability NUMERIC(5,2),
    expected_close_date DATE,
    owner_id INT REFERENCES users(id),
    source VARCHAR(50),
    status VARCHAR(20) DEFAULT 'open',     -- open, won, lost
    lost_reason VARCHAR(150),
    created_at TIMESTAMP DEFAULT now(),
    closed_at TIMESTAMP
);

-- =========================
-- AKTIVITAS (polymorphic)
-- =========================
CREATE TABLE activities (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL,             -- call, email, meeting, task
    subject VARCHAR(150),
    description TEXT,
    related_to_type VARCHAR(30) NOT NULL,  -- lead, contact, opportunity, ticket
    related_to_id INT NOT NULL,
    owner_id INT REFERENCES users(id),
    due_date TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',  -- pending, completed, cancelled
    created_at TIMESTAMP DEFAULT now()
);

-- =========================
-- PRODUK, QUOTATION, ORDER, INVOICE
-- =========================
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    sku VARCHAR(50) UNIQUE,
    price NUMERIC(15,2) NOT NULL,
    description TEXT
);

CREATE TABLE quotations (
    id SERIAL PRIMARY KEY,
    opportunity_id INT REFERENCES opportunities(id),
    quote_number VARCHAR(50) UNIQUE,
    total_amount NUMERIC(15,2),
    status VARCHAR(20) DEFAULT 'draft',    -- draft, sent, accepted, rejected
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE quotation_items (
    id SERIAL PRIMARY KEY,
    quotation_id INT REFERENCES quotations(id),
    product_id INT REFERENCES products(id),
    quantity INT NOT NULL,
    unit_price NUMERIC(15,2) NOT NULL,
    subtotal NUMERIC(15,2) NOT NULL
);

CREATE TABLE sales_orders (
    id SERIAL PRIMARY KEY,
    opportunity_id INT REFERENCES opportunities(id),
    quotation_id INT REFERENCES quotations(id),
    order_number VARCHAR(50) UNIQUE,
    total_amount NUMERIC(15,2),
    status VARCHAR(20) DEFAULT 'processing',
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    sales_order_id INT REFERENCES sales_orders(id),
    invoice_number VARCHAR(50) UNIQUE,
    amount NUMERIC(15,2),
    due_date DATE,
    status VARCHAR(20) DEFAULT 'unpaid',   -- unpaid, paid, overdue
    created_at TIMESTAMP DEFAULT now()
);

-- =========================
-- CUSTOMER SERVICE
-- =========================
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    subject VARCHAR(150) NOT NULL,
    description TEXT,
    account_id INT REFERENCES accounts(id),
    contact_id INT REFERENCES contacts(id),
    assigned_to INT REFERENCES users(id),
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    status VARCHAR(20) DEFAULT 'open',     -- open, in_progress, resolved, closed
    created_at TIMESTAMP DEFAULT now(),
    resolved_at TIMESTAMP
);

CREATE TABLE ticket_comments (
    id SERIAL PRIMARY KEY,
    ticket_id INT REFERENCES tickets(id),
    user_id INT REFERENCES users(id),
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

-- =========================
-- MARKETING
-- =========================
CREATE TABLE campaigns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(50),                      -- email, event, social_ads
    start_date DATE,
    end_date DATE,
    budget NUMERIC(15,2),
    status VARCHAR(20) DEFAULT 'planned',
    created_by INT REFERENCES users(id)
);

CREATE TABLE campaign_members (
    id SERIAL PRIMARY KEY,
    campaign_id INT REFERENCES campaigns(id),
    lead_id INT REFERENCES leads(id),
    contact_id INT REFERENCES contacts(id),
    status VARCHAR(30) DEFAULT 'sent'      -- sent, opened, clicked, converted
);

-- =========================
-- UTILITAS (notes, attachments, tags, audit, notification)
-- =========================
CREATE TABLE notes (
    id SERIAL PRIMARY KEY,
    related_to_type VARCHAR(30) NOT NULL,
    related_to_id INT NOT NULL,
    content TEXT NOT NULL,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE attachments (
    id SERIAL PRIMARY KEY,
    related_to_type VARCHAR(30) NOT NULL,
    related_to_id INT NOT NULL,
    file_url VARCHAR(255) NOT NULL,
    file_name VARCHAR(150),
    uploaded_by INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE taggables (
    tag_id INT REFERENCES tags(id),
    related_to_type VARCHAR(30) NOT NULL,
    related_to_id INT NOT NULL,
    PRIMARY KEY (tag_id, related_to_type, related_to_id)
);

CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    action VARCHAR(50) NOT NULL,           -- create, update, delete
    table_name VARCHAR(50) NOT NULL,
    record_id INT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    message VARCHAR(255) NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT now()
);
```

### 3.3 Catatan Desain

- **Polymorphic relation** (`related_to_type` + `related_to_id`) dipakai di `activities`, `notes`, `attachments`, `taggables` supaya satu fitur (misal komentar/lampiran) bisa dipasang ke banyak jenis entitas tanpa membuat tabel terpisah untuk tiap kombinasi.
- **`pipeline_stages`** dibuat sebagai tabel master (bukan enum) agar tahapan pipeline bisa dikustomisasi per perusahaan tanpa mengubah kode aplikasi.
- Untuk skala besar, tabel `audit_logs` dan `activities` sebaiknya di-partition per bulan/tahun karena volumenya tumbuh cepat.
- Index yang penting untuk performa: `leads.assigned_to`, `opportunities.stage_id`, `opportunities.owner_id`, `activities.related_to_type + related_to_id`, `tickets.status`.
- Jika butuh integrasi akunting (misal invoice resmi/pajak), tabel `invoices` sebaiknya hanya jadi cerminan (mirror) dari sistem akunting, bukan sumber utama data keuangan.

---

## 4. Rekomendasi Prioritas Implementasi (MVP → Lanjutan)

**MVP (fase 1):** users/roles, leads, accounts, contacts, opportunities, pipeline_stages, activities, dashboard dasar.

**Fase 2:** quotations, sales_orders, invoices, tickets, notifications.

**Fase 3:** campaigns, automation/workflow, integrasi email/WhatsApp/kalender, laporan lanjutan & forecasting.
