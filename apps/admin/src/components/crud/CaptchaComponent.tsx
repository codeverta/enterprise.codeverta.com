// src/components/CaptchaComponent.jsx
import React, {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import api from "@/lib/api";

// Gunakan forwardRef untuk memungkinkan parent component memanggil fungsi di dalam component ini
const CaptchaComponent = forwardRef((props, ref) => {
  const [captchaUrl, setCaptchaUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Fungsi untuk merefresh captcha
  const refreshCaptcha = async () => {
    setIsLoading(true);
    try {
      // Panggil API yang sudah kita buat di Laravel
      const response = await api.get("/captcha/refresh");
      // Ganti URL dari response dengan base URL API kita
      const fullUrl = `${api.defaults.baseURL.replace("/api", "")}${
        response.data.captcha_url
      }`;
      setCaptchaUrl(fullUrl);
    } catch (error) {
      console.error("Failed to refresh captcha:", error);
      // Anda bisa menampilkan pesan error di sini
    } finally {
      setIsLoading(false);
    }
  };

  // Panggil refreshCaptcha saat komponen pertama kali dimuat
  useEffect(() => {
    refreshCaptcha();
  }, []);

  // Expose fungsi refreshCaptcha ke parent component melalui ref
  useImperativeHandle(ref, () => ({
    refresh: () => {
      refreshCaptcha();
    },
  }));

  return (
    <div className="mt-4">
      <label
        htmlFor="captcha"
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        Verifikasi (Captcha)
      </label>
      <div className="flex items-center space-x-2">
        <div className="bg-gray-200 rounded-md p-2 h-12 flex items-center justify-center">
          {isLoading ? (
            <span className="text-gray-500">Loading...</span>
          ) : (
            captchaUrl && (
              <img src={captchaUrl} alt="Captcha" className="rounded-md" />
            )
          )}
        </div>
        <button
          type="button"
          onClick={refreshCaptcha}
          className="p-2 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
          title="Refresh Captcha"
        >
          {/* SVG Icon untuk refresh */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h5M20 20v-5h-5M4 4l1.5 1.5A9 9 0 0120.5 15M20 20l-1.5-1.5A9 9 0 003.5 9"
            />
          </svg>
        </button>
      </div>
      {/* Input field ini akan di-handle oleh parent form */}
      <input
        type="text"
        id="captcha"
        name="captcha"
        onChange={props.onChange} // Terima onChange dari props
        value={props.value} // Terima value dari props
        className="mt-2 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        placeholder="Masukkan teks di atas"
        required
      />
    </div>
  );
});

export default CaptchaComponent;
