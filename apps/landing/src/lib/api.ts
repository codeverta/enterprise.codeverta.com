import axios from '@codeverta/axios';
import { BASE_API_URL } from './utils'; // Asumsi BASE_API_URL sudah terdefinisi
import { toast } from 'sonner'; // Asumsi Anda menggunakan Sonner untuk notifikasi

// --- 1. Konfigurasi Instance Axios ---

// Instance utama API (menggunakan interceptor)
const api = axios.create({
    baseURL: `${BASE_API_URL}/api`,
    headers: {
        'Accept': 'application/json',
        'X-Tenant-ID': import.meta.env.VITE_X_TENANT_ID || 'belum-di-set',
    },
    // Sesuaikan konfigurasi lain sesuai kebutuhan backend Anda
    withCredentials: false, 
    withXSRFToken: false, 
});

// Instance khusus untuk Refresh Token (TIDAK boleh menggunakan interceptor yang sama)
const refreshApi = axios.create({
    baseURL: `${BASE_API_URL}/api`,
    headers: {
        'Content-Type': 'application/json',
    },
});


// --- 2. Mekanisme Refresh Token Global ---

let isRefreshing = false;
let failedQueue = [];

// Fungsi untuk memproses semua permintaan yang gagal
const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            // Ulangi permintaan yang gagal dengan token baru
            prom.resolve(token); 
        }
    });
    failedQueue = [];
};

// Fungsi Logout global
const logOut = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user'); // Jika Anda menyimpan data user
    toast.error("Sesi berakhir. Silakan login kembali.");
};


// --- 3. Interceptor Permintaan (Request Interceptor) ---

api.interceptors.request.use(config => {
    // Anda perlu mengganti `authToken` dengan `accessToken` dari respons login sebelumnya
    const accessToken = localStorage.getItem('accessToken'); 
    
    if (accessToken) {
        // Asumsi server Anda hanya membutuhkan JWT tanpa bagian split yang Anda gunakan
        // Jika server Anda MENGGUNAKAN format `id|token`, gunakan `authToken` seperti sebelumnya,
        // TAPI sebaiknya pisahkan penyimpanan di sisi klien menjadi accessToken dan refreshToken
        config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
}, error => {
    return Promise.reject(error);
});


// --- 4. Interceptor Respons (Response Interceptor) ---

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        
        // Cek jika status 401 (Unauthorized) DAN permintaan belum dicoba ulang
        if (error.response?.status === 401 && !originalRequest._retry) {
            
            const refreshToken = localStorage.getItem('refreshToken');

            // Jika tidak ada Refresh Token, atau token 401 di luar proses refresh, langsung logout
            if (!refreshToken) {
                logOut();
                return Promise.reject(error);
            }

            // Jika proses refresh sedang berjalan, masukkan permintaan ke antrian
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                .then(token => {
                    // Coba lagi dengan token baru
                    originalRequest.headers['Authorization'] = `Bearer ${token}`;
                    return api(originalRequest);
                })
                .catch(err => {
                    return Promise.reject(err);
                });
            }

            // --- Memulai Proses Refresh Token ---
            originalRequest._retry = true; // Tandai permintaan ini sudah dicoba
            isRefreshing = true;

            try {
                // Panggil endpoint refresh token menggunakan instance KHUSUS (refreshApi)
                const response = await refreshApi.post('/auth/refresh-token', { 
                    refresh_token: refreshToken 
                });

                const newAccessToken = response.data.data.access_token;
                const newRefreshToken = response.data.data.refresh_token;

                // Simpan token baru
                localStorage.setItem('accessToken', newAccessToken);
                localStorage.setItem('refreshToken', newRefreshToken);
                
                // Set header Authorization untuk permintaan yang gagal
                originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;

                // Proses semua permintaan yang ada di antrian
                processQueue(null, newAccessToken);
                
                // Ulangi permintaan awal yang gagal
                return api(originalRequest);

            } catch (refreshError) {
                // Jika refresh token juga gagal (expired, invalid, dll.)
                processQueue(refreshError, null);
                logOut();
                return Promise.reject(refreshError);

            } finally {
                isRefreshing = false;
            }
        }
        
        // Kasus 401 lainnya (seperti kredensial salah saat login) atau error lain
        return Promise.reject(error);
    }
);

export default api;