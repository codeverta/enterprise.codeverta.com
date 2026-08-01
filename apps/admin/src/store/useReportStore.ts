import { create } from 'zustand';
import api from '../lib/api'; // Pastikan path ke file api Anda benar

const useReportStore = create((set) => ({
  /**
   * State: Menyimpan jumlah laporan dengan status 'baru'.
   * Diinisialisasi dengan 0.
   */
  newReportsCount: 0,

  /**
   * Action: Mengambil data jumlah laporan baru dari API.
   * Fungsi ini akan dipanggil dari Sidebar dan setiap kali ada perubahan status.
   */
  fetchNewReportsCount: async () => {
    try {
      const response = await api.get("/public-reports", {
        params: {
          report_status: 'baru',
          'filter[period]': 'last_30_days',
        },
      });
      // 'response.data.total' adalah kunci dari API Anda yang berisi jumlah total.
      set({ newReportsCount: response.data.total || 0 });
    } catch (error) {
      console.error("Gagal mengambil jumlah laporan baru:", error);
      // Jika gagal, set jumlah ke 0 untuk menghindari error di UI.
      set({ newReportsCount: 0 });
    }
  },
}));

export default useReportStore;