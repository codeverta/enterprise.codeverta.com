import { ZapOff } from "lucide-react";
import { Button } from "@/components/ui/button"; // Asumsi Anda menggunakan Button shadcn/ui
import { Link } from "react-router"; // Gunakan Link sesuai router Anda (misalnya react-router-dom)

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-center p-4">
      {/* Icon Lucide React */}
      <ZapOff className="w-16 h-16 text-red-500 dark:text-red-400 mb-6" />

      {/* Teks Utama */}
      <h1 className="text-9xl font-extrabold text-gray-800 dark:text-gray-100 tracking-wider">
        404
      </h1>

      {/* Sub-judul */}
      <p className="text-2xl font-semibold text-gray-600 dark:text-gray-300 mb-4">
        Halaman Tidak Ditemukan
      </p>

      {/* Deskripsi */}
      <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md">
        Ups! Sepertinya Anda tersesat. Kami tidak dapat menemukan halaman yang
        Anda cari.
      </p>

      {/* Tombol Aksi (shadcn/ui Button) */}
      <Link to="/">
        <Button
          variant="default"
          size="lg"
          className="shadow-lg hover:shadow-xl transition-shadow"
        >
          Kembali ke Beranda
        </Button>
      </Link>
    </div>
  );
}


export default NotFound;