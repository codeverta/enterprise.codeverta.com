import React from 'react'
import { AlertCircle } from "lucide-react";
import PaymentFooter from './-PaymentFooter';

function PaymentError({
    paymentStatus,
    errorMsg,
    }: {
    paymentStatus: "EXPIRED" | "ERROR";
    errorMsg?: string;
}) {
  return (
        <div className="min-h-[90vh] bg-gray-50 flex flex-col items-center justify-center">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-t-4 border-red-500">
            <div className="mx-auto bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mb-6">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {paymentStatus === "EXPIRED" ? "Waktu Habis" : "Terjadi Kesalahan"}
            </h2>
            <p className="text-gray-600 mb-6 text-sm">
              {errorMsg || "Mohon maaf, terjadi kesalahan saat memuat data."} Jika masalah ini terus berlanjut, silakan hubungi kontak tim kami untuk bantuan lebih lanjut di pojok kanan bawah halaman ini.
            </p>
            <button
              onClick={() => (window.location.href = "/")}
              className="bg-gray-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-900 transition w-full"
            >
              Kembali ke Beranda
            </button>
          </div>
          <PaymentFooter />
        </div>
      )
}

export default PaymentError
