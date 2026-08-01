import React from 'react'
import PaymentFooter from './PaymentFooter'
import { CheckCircle } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'

function PaymentPaid({
    paymentData,
    onViewSubscriptions,
}) {
  return (
    <div className="min-h-[90vh] bg-gray-50 flex flex-col items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-t-4 border-green-500 animate-in zoom-in-95 duration-300">
        <div className="mx-auto bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Pembayaran Berhasil!
        </h2>
        <p className="text-gray-600 mb-6 text-sm">
          Terima kasih, pembayaran subscription berhasil.
          <br />
          Langganan kamu sudah aktif dan siap digunakan.
        </p>
        <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-100">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            Total Dibayar
          </p>
          <p className="text-xl font-bold text-gray-900">
            {formatCurrency(
              paymentData?.total_amount ||
                ((paymentData?.final_amount || 0) +
                  (paymentData?.handling_fee || 0) +
                  (paymentData?.admin_fee || 0))
            )}
          </p>
        </div>
        <button
          onClick={onViewSubscriptions}
          className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition w-full shadow-lg shadow-green-200"
        >
          Lihat Langganan Saya
        </button>
      </div>
      <PaymentFooter />
    </div>
  );
}

export default PaymentPaid
