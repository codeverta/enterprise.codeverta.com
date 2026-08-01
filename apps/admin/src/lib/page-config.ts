// src/config/pageConfig.js

// Mengimpor semua mock data yang relevan dari satu file
import {
  dataTampunganAir,
  dataIrigasi,
  dataDayaRusakAir,
  dataAirBaku,
  dataJalan,
  dataJembatan,
  dataSpam,
  dataSanitasi,
  dataDrainase,
  dataCagarBudaya,
  dataKawasanKumuh,
  dataRTLH,
  dataBacklog,
  dataTransportasiDarat,
  dataTransportasiUdara,
  dataTransportasiLaut,
  dataListrik,
  dataElektrifikasi,
  dataInternet,
  dataBTS,
} from "../lib/mock-data";

export const pageConfig = {
  // --- Sumber Daya Air ---
  "/sda/tampungan-air": {
    title: "Bangunan Tampungan Air",
    description: "Data terpusat untuk Bendungan, Bendung, dan Embung di seluruh wilayah.",
    tableTitle: "Data Dasar Tampungan Air",
    data: dataTampunganAir,
    columns: [
      { header: "Nama Bangunan", accessor: "nama" },
      { header: "Jenis", accessor: "jenis" },
      { header: "Lokasi (Kecamatan)", accessor: "kecamatan" },
      { header: "Luas (m²)", accessor: "luas", isNumeric: true },
      { header: "Volume (m³)", accessor: "volume", isNumeric: true },
      { header: "Tahun", accessor: "tahun", isCentered: true },
    ],
  },
};