Kalau di ERPNext, **return tidak mengubah Sales Order**, tetapi membuat dokumen retur yang mengacu ke transaksi sebelumnya. Ini penting supaya histori penjualan tetap utuh.

Misalkan perusahaan kosmetik menjual:

* 10 pcs Lipstick
* Harga Rp100.000/pcs

---

# Flow normal

```text
Quotation (opsional)
        │
        ▼
Sales Order
        │
        ▼
Delivery Note
        │
        ▼
Sales Invoice
        │
        ▼
Payment Entry
```

---

# Customer retur barang

Misalnya customer mengembalikan 2 pcs karena rusak.

Flow di ERPNext:

```text
Sales Invoice
        │
        ▼
Create → Return
        │
        ▼
Sales Invoice Return
```

atau jika stok sudah dikirim:

```text
Delivery Note
        │
        ▼
Create → Return
        │
        ▼
Delivery Note Return
```

---

## Return stok

Kalau barang benar-benar kembali ke gudang:

```text
Delivery Note

↓

Delivery Note Return
```

Efeknya:

* stok gudang bertambah
* stok customer berkurang

Misal:

```
Jual:
-10 Lipstick

Return:
+2 Lipstick

Sisa keluar:
8 Lipstick
```

---

## Return uang

Kalau uang juga dikembalikan:

```
Sales Invoice

↓

Sales Invoice Return
```

Nilainya menjadi negatif.

Misalnya

```
Invoice awal

10 × 100.000
= 1.000.000
```

Return

```
2 × 100.000

= -200.000
```

Sehingga penjualan bersih menjadi

```
800.000
```

Di akuntansi juga akan mengurangi pendapatan dan piutang (atau mencatat kredit kepada customer, tergantung apakah sudah dibayar).

---

# Kalau customer minta tukar barang

Misalnya:

> Lipstick warna A rusak, ingin diganti warna B.

Biasanya flow-nya:

```
Delivery Note Return
        │
Barang lama masuk gudang
        │
        ▼
Delivery Note baru
        │
Barang pengganti keluar
```

Jadi ada:

* satu transaksi barang masuk
* satu transaksi barang keluar

Bukan mengedit transaksi lama.

---

# Kalau refund sebagian

Misalnya:

```
10 pcs dikirim

↓

2 pcs rusak

↓

Refund 2 pcs
```

Maka:

* Delivery Note Return = 2 pcs
* Sales Invoice Return = 2 pcs

Sisa penjualan tetap 8 pcs.

---

# Kalau barang tidak dikembalikan

Misalnya:

* kosmetik bocor
* customer kirim foto
* perusahaan memutuskan tidak perlu dikirim balik

Maka biasanya:

```
Sales Invoice Return
```

atau Credit Note untuk mengurangi tagihan/refund, **tanpa** membuat Delivery Note Return karena stok tidak kembali ke gudang.

---

## Ringkasan flow return di ERPNext

| Kondisi                              | Dokumen yang digunakan                           |
| ------------------------------------ | ------------------------------------------------ |
| Barang dikembalikan ke gudang        | Delivery Note Return                             |
| Uang dikembalikan                    | Sales Invoice Return (Credit Note)               |
| Barang ditukar                       | Delivery Note Return → Delivery Note baru        |
| Refund sebagian                      | Return dengan jumlah sebagian (partial return)   |
| Barang tidak kembali (rusak/dibuang) | Sales Invoice Return saja (stok tidak bertambah) |

Jadi, prinsip di ERPNext adalah **tidak mengubah transaksi yang sudah selesai**. Sebagai gantinya, dibuat dokumen retur yang mereferensikan dokumen asli agar stok, akuntansi, dan audit trail tetap konsisten.
