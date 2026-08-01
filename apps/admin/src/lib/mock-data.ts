// src/lib/mock-data.js

// --- Infrastruktur -> Sumber Daya Air ---

export const dataTampunganAir = [
  { id: "WDK01", nama: "Waduk Gajah Mungkur", jenis: "Bendungan", kecamatan: "Wuryantoro", luas: 88000000, volume: 730000000, tahun: 1982 },
  { id: "WDK02", nama: "Embung Manjung", jenis: "Embung", kecamatan: "Sawit", luas: 15000, volume: 60000, tahun: 2018 },
  { id: "WDK03", nama: "Bendung Colo", jenis: "Bendung", kecamatan: "Nguter", luas: 5000, volume: 20000, tahun: 1992 },
];

export const dataIrigasi = [
    { id: "IRG01", nama: "Daerah Irigasi Bengawan Solo", kabupaten: "Sragen", luas_potensial: 60000, luas_fungsional: 58000, kondisi: "Baik" },
    { id: "IRG02", nama: "Daerah Irigasi Klambu", kabupaten: "Grobogan", luas_potensial: 35000, luas_fungsional: 32000, kondisi: "Perlu Perbaikan" },
];

export const dataDayaRusakAir = [
    { id: "DRA01", nama_bangunan: "Tanggul Sungai Serayu", jenis: "Tanggul Sungai", lokasi: "Kab. Banyumas", panjang_km: 15.5, kondisi: "Baik", tahun_dibangun: 2015 },
    { id: "DRA02", nama_bangunan: "Sabo Dam Merapi", jenis: "Sabo Dam", lokasi: "Kab. Sleman", volume_tampung_m3: 50000, kondisi: "Perawatan Rutin", tahun_dibangun: 2012 },
    { id: "DRA03", nama_bangunan: "Krib Sungai Lusi", jenis: "Krib", lokasi: "Kab. Grobogan", jumlah_unit: 25, kondisi: "Baik", tahun_dibangun: 2019 },
];

export const dataAirBaku = [
    { id: "AB01", nama_sumber: "Mata Air Cokro", jenis: "Mata Air", lokasi: "Kab. Klaten", debit_liter_detik: 1500, pemanfaatan: "PDAM Surakarta", status: "Operasional" },
    { id: "AB02", nama_sumber: "Intake Sungai Progo", jenis: "Intake Sungai", lokasi: "Kab. Kulon Progo", debit_liter_detik: 2000, pemanfaatan: "Irigasi & Air Baku", status: "Operasional" },
];

// --- Infrastruktur -> Bina Marga ---

export const dataJalan = [
    { id: "JLN01", nama_ruas: "Jl. Slamet Riyadi", lokasi: "Kota Surakarta", panjang_km: 5.6, lebar_m: 20, jenis_permukaan: "Aspal", kondisi: "Baik" },
    { id: "JLN02", nama_ruas: "Ruas Solo-Purwodadi", lokasi: "Kab. Boyolali", panjang_km: 25.0, lebar_m: 7, jenis_permukaan: "Beton", kondisi: "Sedang" },
];

// Data Jembatan diperbaiki agar lebih relevan
export const dataJembatan = [
    { id: "JMB01", nama_jembatan: "Jembatan Jurug B", lokasi: "Kota Surakarta", panjang_m: 250, lebar_m: 9, jenis_konstruksi: "Rangka Baja", kondisi: "Baik", tahun_dibangun: 1985 },
    { id: "JMB02", nama_jembatan: "Jembatan Bacem", lokasi: "Kab. Sukoharjo", panjang_m: 180, lebar_m: 7, jenis_konstruksi: "Beton Prategang", kondisi: "Perlu Perbaikan", tahun_dibangun: 1990 },
];

// --- Infrastruktur -> Cipta Karya ---

export const dataSpam = [
    { id: "SPM01", nama_spam: "SPAM Regional Kartamantul", lokasi: "Yogyakarta", kapasitas_lps: 2000, jumlah_sambungan: 150000, status: "Operasional Penuh" },
    { id: "SPM02", nama_spam: "SPAM IKK Wonogiri", lokasi: "Kab. Wonogiri", kapasitas_lps: 100, jumlah_sambungan: 8000, status: "Operasional" },
];

export const dataSanitasi = [
    { id: "SN01", nama_program: "IPAL Komunal Semanggi", jenis: "IPAL", lokasi: "Kota Surakarta", kapasitas_kk: 500, status: "Aktif", tahun: 2019 },
    { id: "SN02", nama_program: "TPA Putri Cempo", jenis: "TPA", lokasi: "Kota Surakarta", luas_ha: 17, status: "Perluasan", tahun: 1997 },
];

export const dataDrainase = [
    { id: "DRN01", nama_jaringan: "Drainase Perkotaan Jl. Sudirman", lokasi: "Jakarta Pusat", panjang_km: 5.2, tipe: "Saluran Tertutup", kondisi: "Baik" },
    { id: "DRN02", nama_jaringan: "Kali Anyar Drainage System", lokasi: "Kota Surakarta", panjang_km: 12, tipe: "Saluran Terbuka", kondisi: "Normalisasi" },
];

export const dataCagarBudaya = [
    { id: "CB01", nama_bangunan: "Benteng Vastenburg", lokasi: "Kota Surakarta", jenis_pemugaran: "Revitalisasi Fasad", tahun_selesai: 2017, status: "Selesai" },
    { id: "CB02", nama_bangunan: "Lawang Sewu", lokasi: "Kota Semarang", jenis_pemugaran: "Restorasi Total", tahun_selesai: 2011, status: "Selesai" },
];

// --- Infrastruktur -> Perumahan (Konteks Papua) ---

export const dataKawasanKumuh = [
    { id: "KMH01", nama_kawasan: "Kawasan Dok IX", lokasi: "Kota Jayapura", luas_ha: 15.7, jumlah_kk: 1200, status_penanganan: "Tahap 2" },
    { id: "KMH02", nama_kawasan: "Kawasan Pasar Wosi", lokasi: "Kab. Manokwari", luas_ha: 8.2, jumlah_kk: 750, status_penanganan: "Selesai" },
];

export const dataRTLH = [
    { id: "RTLH01", kabupaten_kota: "Kab. Jayawijaya", jumlah_unit_ditangani: 500, tahun_anggaran: 2023, sumber_dana: "APBN" },
    { id: "RTLH02", kabupaten_kota: "Kab. Merauke", jumlah_unit_ditangani: 350, tahun_anggaran: 2023, sumber_dana: "APBD + APBN" },
];

export const dataBacklog = [
    { id: "BCK01", kabupaten_kota: "Kota Jayapura", jumlah_backlog: 15000, kategori: "MBR (Masyarakat Berpenghasilan Rendah)", tahun_data: 2024 },
    { id: "BCK02", kabupaten_kota: "Kab. Mimika", jumlah_backlog: 12500, kategori: "ASN & MBR", tahun_data: 2024 },
];

// --- Transportasi -> Perhubungan ---

export const dataTransportasiDarat = [
    { id: "TRM01", nama: "Terminal Tirtonadi", tipe: "Tipe A", lokasi: "Kota Surakarta", status: "Operasional", revitalisasi_terakhir: 2017 },
    { id: "TRM02", nama: "Terminal Giwangan", tipe: "Tipe A", lokasi: "Kota Yogyakarta", status: "Operasional", revitalisasi_terakhir: 2015 },
];

export const dataTransportasiUdara = [
    { id: "BDR01", nama: "Bandara Sentani", kode_iata: "DJJ", lokasi: "Kab. Jayapura", status_landasan: "Baik", tipe: "Internasional" },
    { id: "BDR02", nama: "Bandara Wamena", kode_iata: "WMX", lokasi: "Kab. Jayawijaya", status_landasan: "Perbaikan", tipe: "Domestik Kargo" },
];

export const dataTransportasiLaut = [
    { id: "PLB01", nama: "Pelabuhan Jayapura", lokasi: "Kota Jayapura", jenis: "Pelabuhan Penumpang & Barang", kedalaman_alur_lws: 12 },
    { id: "PLB02", nama: "Pelabuhan Merauke", lokasi: "Kab. Merauke", jenis: "Pelabuhan Barang", kedalaman_alur_lws: 8 },
];

// --- Energi & Telekomunikasi ---

export const dataListrik = [
    { id: "LST01", nama_rencana: "Pembangunan PLTA Memberamo", jenis: "Pembangkit", kapasitas_mw: 1500, status: "Studi Kelayakan", target_selesai: 2035 },
    { id: "LST02", nama_rencana: "Transmisi 150kV Jayapura-Wamena", jenis: "Transmisi", panjang_km: 250, status: "Perencanaan", target_selesai: 2028 },
];

export const dataElektrifikasi = [
    { id: "ELK01", kabupaten: "Puncak Jaya", rasio_elektrifikasi_sekarang: 0.35, target_rasio: 0.90, program_utama: "PLTS Komunal & LTSHE" },
    { id: "ELK02", kabupaten: "Yahukimo", rasio_elektrifikasi_sekarang: 0.42, target_rasio: 0.95, program_utama: "PLTMH & LTSHE" },
];

export const dataInternet = [
    { id: "NET01", program: "Palapa Ring Timur", lokasi: "Papua & Maluku", teknologi: "Fiber Optik", status: "Operasional" },
    { id: "NET02", program: "Akses Internet Desa (BAKTI)", lokasi: "3T di Papua", teknologi: "VSAT", status: "Berjalan" },
];

export const dataBTS = [
    { id: "BTS01", kabupaten: "Asmat", jumlah_bts_4g: 50, operator_dominan: "Telkomsel", status_konektivitas: "Cukup" },
    { id: "BTS02", kabupaten: "Pegunungan Bintang", jumlah_bts_4g: 25, operator_dominan: "Telkomsel", status_konektivitas: "Terbatas" },
];

// Mock Data untuk Jaringan Irigasi
export const irrigationData = [
    {
        id: 1,
        nomorDaerah: "DI.001",
        namaDaerah: "Irigasi Maju Jaya",
        kecamatan: "Sukamaju",
        luas: 1200,
        indeksPertanaman: 250,
        produksi: 6.5,
        tahun: 2022,
    },
    {
        id: 2,
        nomorDaerah: "DI.002",
        namaDaerah: "Irigasi Sumber Makmur",
        kecamatan: "Karangrejo",
        luas: 850,
        indeksPertanaman: 280,
        produksi: 7.1,
        tahun: 2021,
    },
    {
        id: 3,
        nomorDaerah: "DI.003",
        namaDaerah: "Irigasi Tani Sejahtera",
        kecamatan: "Sukamaju",
        luas: 1500,
        indeksPertanaman: 260,
        produksi: 6.8,
        tahun: 2023,
    },
    {
        id: 4,
        nomorDaerah: "DI.004",
        namaDaerah: "Irigasi Air Bersih",
        kecamatan: "Wonokromo",
        luas: 700,
        indeksPertanaman: 300,
        produksi: 7.5,
        tahun: 2022,
    },
    {
        id: 5,
        nomorDaerah: "DI.005",
        namaDaerah: "Irigasi Cipta Karya",
        kecamatan: "Gondang",
        luas: 950,
        indeksPertanaman: 240,
        produksi: 6.2,
        tahun: 2023,
    },
    {
        id: 6,
        nomorDaerah: "DI.006",
        namaDaerah: "Irigasi Tirto Mulyo",
        kecamatan: "Karangrejo",
        luas: 1100,
        indeksPertanaman: 270,
        produksi: 6.9,
        tahun: 2020,
    },
    {
        id: 7,
        nomorDaerah: "DI.007",
        namaDaerah: "Irigasi Wening",
        kecamatan: "Sukamaju",
        luas: 1350,
        indeksPertanaman: 255,
        produksi: 6.6,
        tahun: 2021,
    },
    {
        id: 8,
        nomorDaerah: "DI.008",
        namaDaerah: "Irigasi Subur Abadi",
        kecamatan: "Wonokromo",
        luas: 650,
        indeksPertanaman: 310,
        produksi: 7.8,
        tahun: 2023,
    },
];