UPDATE email_templates SET tencent_template_id=67629, template_status="PAYMENT_SUCCESS" WHERE id="e866cb02-eef9-477f-8f43-33a47bed33b8";
UPDATE email_templates SET tencent_template_id=67629, template_status="RACEPACK_REMINDER" WHERE id="85915545-18f5-4740-b879-60af80d5f2d3";
UPDATE email_templates SET template_status="VERIFIED" WHERE tencent_template_id=67231;

UPDATE orders SET registration_status="PENDING" where id="5e107ef8-f430-44b4-bdc6-c304b9e66356"

UPDATE orders SET registration_status="PENDING" where id="178577a2-a4c2-4402-9001-c05becacae44";


UPDATE system_settings SET participant_quota=2000;
UPDATE email_templates SET template_status=APPROVED WHERE id="";
UPDATE email_templates SET template_status="EMAIL_REJECTION_TEMPLATE" WHERE id="";
UPDATE email_templates SET template_status="VERIFIED" WHERE id="bd9dcb3c-f2ef-4b10-ac6f-28cd62eef9d0";

SEEDER

INSERT INTO early_bird_configs (start_date, end_date, price, is_active) VALUES ('2026-01-01 00:00:00', '2026-01-10 23:59:59', 500000, 1);

INSERT INTO promo_codes (code, discount_amount, quota, valid_until) VALUES ('LARI2026', 50000, 100, '2026-02-01 00:00:00');

MariaDB [malabar_trailrun]> UPDATE registrations SET registration_status="PENDING" WHERE id="bd9dcb3c-f2ef-4b10-ac6f-28cd62eef9d0";
MariaDB [malabar_trailrun]> UPDATE registrations SET is_verified=0 WHERE id="bd9dcb3c-f2ef-4b10-ac6f-28cd62eef9d0";



CREATE INDEX


-- Index untuk Pagination (Sangat Penting!)
CREATE INDEX idx_orders_pagination ON orders(created_at DESC, id DESC);

-- Index untuk Filtering Status (Opsional tapi disarankan)
CREATE INDEX idx_orders_status ON orders(status);

-- Index untuk Search PIC (Opsional)
CREATE INDEX idx_orders_pic_email ON orders(pic_email);


UPDATE SYSTEM SETTINGS  BIAR GK NULL
UPDATE system_settings SET participant_used = 0 WHERE participant_used IS NULL;
UPDATE system_settings SET email_used = 0 WHERE email_used IS NULL;
UPDATE payments SET status = "PENDING" WHERE status="PAID" AND order_id="xxx";

SYNC PAYMENT 
mysql> update orders set status="PENDING" where id="5e107ef8-f430-44b4-bdc6-c304b9e66356";
Query OK, 0 rows affected (0.04 sec)
Rows matched: 1  Changed: 0  Warnings: 0

mysql> update payments set status="PENDING" where order_id="5e107ef8-f430-44b4-bdc6-c304b9e66356";
Query OK, 1 row affected (0.07 sec)
Rows matched: 1  Changed: 1  Warnings: 0



UPDATE system_settings SET email_quota = 500


func (r *dashboardRepository) SyncLegacyData() error {
	// Query untuk mengambil agregasi dari tabel order utama
	// Kita kelompokkan berdasarkan tanggal
	query := `
		INSERT INTO order_daily_stats (date, total_orders, total_revenue, cnt_pending, cnt_paid, cnt_expired, updated_at)
		SELECT 
			DATE(created_at) as date,
			COUNT(*) as total_orders,
			SUM(CASE WHEN status = 'PAID' THEN final_amount ELSE 0 END) as total_revenue,
			SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as cnt_pending,
			SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as cnt_paid,
			SUM(CASE WHEN status = 'EXPIRED' THEN 1 ELSE 0 END) as cnt_expired,
			NOW()
		FROM orders
		WHERE deleted_at IS NULL
		GROUP BY DATE(created_at)
		ON DUPLICATE KEY UPDATE
			total_orders = VALUES(total_orders),
			total_revenue = VALUES(total_revenue),
			cnt_pending = VALUES(cnt_pending),
			cnt_paid = VALUES(cnt_paid),
			cnt_expired = VALUES(cnt_expired),
			updated_at = NOW();
	`
	return r.db.Exec(query).Error
};


for file in *.gpx; do                                                                 
  echo "Compressing $file → $file.br"
  brotli -f -q 11 "$file" -o "$file.br"
done

echo "Done."


UPDATE participant_daily_stats pds
SET total_participants = (
    SELECT COUNT(*) 
    FROM participants p 
    WHERE DATE(p.created_at) = pds.date 
    AND p.is_paid = 1 
    AND p.deleted_at IS NULL
);

UPDATE participant_daily_stats pds
JOIN (
    SELECT dt, JSON_OBJECTAGG(val, cnt) as js FROM (
        SELECT DATE(created_at) as dt, COALESCE(NULLIF(gender, ''), 'UNKNOWN') as val, COUNT(*) as cnt
        FROM participants WHERE is_paid = 1 AND deleted_at IS NULL
        GROUP BY dt, val
    ) s1 GROUP BY dt
) src ON pds.date = src.dt
SET pds.gender_breakdown = src.js;

UPDATE participant_daily_stats pds
JOIN (
    SELECT dt, JSON_OBJECTAGG(val, cnt) as js FROM (
        SELECT DATE(created_at) as dt, COALESCE(NULLIF(category, ''), 'UNKNOWN') as val, COUNT(*) as cnt
        FROM participants WHERE is_paid = 1 AND deleted_at IS NULL
        GROUP BY dt, val
    ) s1 GROUP BY dt
) src ON pds.date = src.dt
SET pds.category_breakdown = src.js;


Untuk mempelajari *backend engineering* kelas industri (Industrial Scale)—di mana isunya bukan lagi "bagaimana cara bikin fitur", tapi "bagaimana supaya tidak meledak saat dipakai jutaan orang"—kamu harus keluar dari tutorial coding biasa (Udemy/Youtube dasar) dan masuk ke ranah **Computer Science & System Design**.

Berikut adalah **Roadmap Belajar** untuk mencapai level tersebut, diurutkan dari yang paling fundamental hingga *advanced*:

### 1. The "Holy Grail" (Buku Wajib Baca)

Jika kamu hanya ingin membaca satu buku seumur hidup untuk topik ini, bacalah ini:

* **Designing Data-Intensive Applications (DDIA)** oleh *Martin Kleppmann*.
* **Kenapa:** Ini adalah "kitab suci" backend engineer di Big Tech (Google, Facebook, Uber, Traveloka, Gojek).
* **Isinya:** Buku ini menjelaskan secara dalam apa itu ACID, Isolation Levels, Distributed Transactions, Sharding, Replication, dan masalah *race condition* yang kita bahas tadi. Bahasanya berat tapi sangat membuka mata.



### 2. Database Internals (Memahami Mesin di Bawah Kap)

Kamu perlu paham bagaimana database bekerja, bukan cuma cara pakainya.

* **Buku:** *High Performance MySQL* (atau *PostgreSQL Internals* jika pindah ke Postgres).
* **Topik yang harus dicari:**
* **Isolation Levels:** Bedanya `Read Committed`, `Repeatable Read`, dan `Serializable`.
* **Locking Mechanisms:** Row-level lock vs Table lock, Gap locking (ini sering bikin deadlock).
* **Indexing:** B-Tree vs Hash Index (kenapa query lambat).
* **MVCC (Multi-Version Concurrency Control):** Bagaimana database menangani banyak user baca/tulis tanpa saling tunggu (ini alasan `CheckPrice` kamu sebaiknya tanpa lock).



### 3. Distributed Systems (Ilmu Skala Besar/Bank)

Untuk memahami bagaimana bank atau e-commerce menangani transaksi antar-sistem (tanpa deadlock dan data hilang).

* **Course (Gratis):** **MIT 6.824: Distributed Systems** (Cari di YouTube).
* Ini kuliah S2 di MIT yang materinya dibuka gratis. Sangat susah (pakai Go-lang juga lab-nya!), tapi kalau kamu lulus memahaminya, kamu sudah level *Top Tier Engineer*.


* **Pola Desain:** Pelajari pola **Saga Pattern** dan **Two-Phase Commit (2PC)**. Ini adalah jawaban teknis dari pertanyaanmu "kok bank bisa memantulkan dana otomatis".

### 4. Spesifik Go (Concurrency)

Karena kamu pakai Go, kamu harus master di cara Go menangani *concurrency*.

* **Buku:** *Concurrency in Go* oleh *Katherine Cox-Buday*.
* **Topik:**
* Goroutines & Channels (Philosophy: *"Do not communicate by sharing memory; instead, share memory by communicating"*).
* Mutex vs Channel (Kapan pakai `sync.Mutex`, kapan pakai Channel).
* Context Package (Cara handle timeout dan cancellation, sangat penting untuk mencegah server hang).



### 5. Studi Kasus Nyata (Engineering Blogs)

Perusahaan besar sering membagikan *post-mortem* (analisis kejadian error) mereka. Ini tempat belajar terbaik dari kesalahan orang lain.

* **Uber Engineering Blog:** Sering bahas tentang locking dan database skala raksasa.
* **Discord Engineering Blog:** Mereka migrasi miliaran pesan dari MongoDB ke Cassandra ke ScyllaDB. Belajar banyak soal performa di sini.
* **Netflix Tech Blog:** Rajanya *Resilience Engineering* (bagaimana sistem tetap jalan meski sebagian server mati).

### Rangkuman Jalur Belajar Kamu (Next Steps):

1. **Level 1 (Sekarang):** Paham membuat API CRUD, paham Go basic syntax, paham SQL basic (`JOIN`, `WHERE`).
2. **Level 2 (Transaction & Consistency):** Pelajari **Database Isolation Levels** (Dirty Read, Phantom Read). Coba simulasi Deadlock sengaja di laptopmu. (Baca: Dokumentasi MySQL/MariaDB bab "InnoDB Locking").
3. **Level 3 (Architecture):** Baca buku **DDIA**. Fokus ke Bab "Transactions" dan "Consistency".
4. **Level 4 (High Availability):** Belajar Redis (Caching), Message Queue (RabbitMQ/Kafka) untuk memproses transaksi di background (Asynchronous) agar tidak memberatkan user saat klik tombol.

Pertanyaan-pertanyaan kamu tentang *Locking*, *Timezone*, dan *ACID* tadi sudah menunjukkan kamu sedang melangkah dari Level 1 ke Level 2. *Keep going!*


INSERT INTO payment_methods (id, code, name, type, logo, admin_fee, is_percentage, handling_fee, is_active, created_at, updated_at) 
VALUES
(UUID(), 'QRIS', 'QRIS (GoPay, OVO, Dana, dll)', 'QR', '/assets/qris.png', 0.0072, TRUE, 10000, TRUE, NOW(), NOW()),
(UUID(), 'BNI', 'BNI Virtual Account', 'VA', '/assets/bni.png', 5000, FALSE, 10000, TRUE, NOW(), NOW()),
(UUID(), 'BRI', 'BRI Virtual Account', 'VA', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/BANK_BRI_logo.svg/2560px-BANK_BRI_logo.svg.png', 5000, FALSE, 10000, TRUE, NOW(), NOW()),
(UUID(), 'MANDIRI', 'Mandiri Virtual Account', 'VA', '/assets/mandiri.png', 5000, FALSE, 10000, TRUE, NOW(), NOW()),
(UUID(), 'PERMATA', 'Permata Virtual Account', 'VA', '/assets/permata.png', 5000, FALSE, 10000, TRUE, NOW(), NOW()),
(UUID(), 'CIMB', 'CIMB Niaga Virtual Account', 'VA', '/assets/cimb.png', 5000, FALSE, 10000, TRUE, NOW(), NOW()),
(UUID(), 'BJB', 'BJB Virtual Account', 'VA', '/assets/bjb.webp', 5000, FALSE, 10000, TRUE, NOW(), NOW());

ALTER TABLE payment_methods 
MODIFY COLUMN admin_fee DECIMAL(10,4);


cd apps/backend

# Reset password admin
go run cmd/cli/main.go reset-password \
  --email superadmin@codeverta.com \
  --password password123

# Lihat daftar user + role
go run cmd/cli/main.go list-users

# Buat admin baru
go run cmd/cli/main.go create-admin \
  --email admin2@codeverta.com \
  --password rahasia123 \
  --name "Admin Dua" \
  --role 99

# Ubah role user (promote ke superadmin)
go run cmd/cli/main.go set-role \
  --email admin@codeverta.com \
  --role 100
