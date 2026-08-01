import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams, useNavigate } from "react-router";
import dayjs from "dayjs";
import {
  AlertCircle,
  Copy,
  Loader2,
  ShoppingBag,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  ArrowLeft,
  Tag,
  CreditCard,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import PaymentFooter from "@/pages/payments/PaymentFooter";
import PaymentError from "@/pages/payments/PaymentError";
import PaymentExpired from "@/pages/payments/PaymentExpired";
import PaymentPaid from "@/pages/payments/PaymentPaid";

const getResponseData = (r) => r.data?.data || r.data || [];
const normalizePaymentStatus = (status) => String(status || "").toUpperCase();

export default function CourseCheckoutPage() {
  const { id: courseId } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  useEffect(() => {
    dayjs.locale(language);
  }, [language]);

  const [searchParams, setSearchParams] = useSearchParams();
  const paymentId = searchParams.get("payment_id") || "";
  const pollingRef = useRef(null);

  const [initLoading, setInitLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [course, setCourse] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [confirmationData, setConfirmationData] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("IDLE");
  const [errorMsg, setErrorMsg] = useState("");
  const [showDetail, setShowDetail] = useState(true);

  useEffect(() => {
    fetchInitialData();
  }, [courseId]);

  useEffect(() => {
    if (!paymentData?.transaction_id || ["PAID", "EXPIRED", "FAILED"].includes(paymentStatus)) return;

    const checkStatus = async () => {
      if (document.hidden || !paymentId) return;
      try {
        const response = await api.get(`/lms/subscription-payments/${paymentId}`);
        const payload = response.data?.data || response.data;
        const payment = payload.payment || payload;
        const nextStatus = normalizePaymentStatus(payment.status);
        setPaymentData(payload.payment_data || paymentData);
        if (nextStatus && nextStatus !== paymentStatus) {
          setPaymentStatus(nextStatus);
        }
        if (nextStatus === "PAID") {
          setPaymentStatus("PAID");
          clearInterval(pollingRef.current);
          toast.success("Pembayaran berhasil, kursus dapat diakses.");
        } else if (["EXPIRED", "FAILED"].includes(nextStatus)) {
          clearInterval(pollingRef.current);
        }
      } catch {
        // quiet
      }
    };

    checkStatus();
    pollingRef.current = setInterval(checkStatus, 5000);
    return () => clearInterval(pollingRef.current);
  }, [paymentData?.transaction_id, paymentId, paymentStatus]);

  const fetchInitialData = async () => {
    setInitLoading(true);
    try {
      if (paymentId) {
        await loadPayment(paymentId);
      } else {
        const courseRes = await api.get(`/lms/courses/${courseId}`);
        const courseData = getResponseData(courseRes);
        setCourse(courseData);
        if (courseData.price > 0) {
          await fetchPaymentMethods(courseData.price);
        } else {
          toast.error("Kursus ini gratis atau belum memiliki harga.");
          navigate(`/dashboard/courses/${courseId}`);
        }
      }
    } catch (err) {
      setPaymentStatus("ERROR");
      setErrorMsg(err.response?.data?.message || "Gagal memuat data pembayaran.");
    } finally {
      setInitLoading(false);
    }
  };

  const loadPayment = async (id) => {
    const response = await api.get(`/lms/subscription-payments/${id}`);
    const payload = response.data?.data || response.data;
    const payment = payload.payment || payload;
    const nextData = payload.payment_data || null;

    if (payment.course_id) {
      const courseRes = await api.get(`/lms/courses/${payment.course_id}`);
      setCourse(getResponseData(courseRes));
    }

    setPaymentData(nextData);
    setPaymentStatus(normalizePaymentStatus(payment.status));

    if (payment.payment_type) {
      const methodsRes = await api.get("/payment-methods", { params: { amount: payment.amount } });
      const methods = getResponseData(methodsRes);
      setPaymentMethods(methods);

      const methodInfo = methods.find((method) => method.id === payment.payment_type || method.code === payment.payment_type);
      setSelectedMethod({
        id: payment.payment_type,
        name: methodInfo?.name || payment.payment_type,
        logo: methodInfo?.logo || "/assets/qris.png",
        type: payment.payment_type === "QRIS" ? "QR" : "VA",
      });
    }
  };

  const fetchPaymentMethods = async (amount) => {
    const response = await api.get("/payment-methods", { params: { amount } });
    setPaymentMethods(getResponseData(response));
  };

  const handleMethodSelect = (method) => {
    setSelectedMethod(method);
    setConfirmationData({ ...method, isModalOpen: false });
  };

  const handleConfirmPayment = async () => {
    if (!course || !selectedMethod) return;
    setConfirmationData(null);
    setLoading(true);
    setErrorMsg("");

    try {
      const response = await api.post(`/lms/courses/${course.id}/purchase`, {
        payment_method: selectedMethod.id,
      });
      const payload = response.data?.data || response.data;
      if (payload.requires_payment === false) {
        toast.success("Pembelian berhasil.");
        navigate(`/dashboard/courses/${course.id}`);
        return;
      }
      setPaymentData(payload.payment_data);
      setPaymentStatus("PENDING");
      setShowDetail(false);
      if (payload.payment?.id) {
        setSearchParams({ payment_id: payload.payment.id });
      }
    } catch (err) {
      toast.error("Gagal membuat pembayaran.");
      setErrorMsg(err.response?.data?.message || err.response?.data?.error || "Gagal menginisiasi pembayaran.");
    } finally {
      setLoading(false);
    }
  };

  const refreshPaymentStatus = async () => {
    if (!paymentId) return;
    setLoading(true);
    try {
      const response = await api.get(`/lms/subscription-payments/${paymentId}`);
      const payload = response.data?.data || response.data;
      const payment = payload.payment || payload;
      const nextStatus = normalizePaymentStatus(payment.status);
      setPaymentData(payload.payment_data || paymentData);
      if (nextStatus && nextStatus !== paymentStatus) {
        setPaymentStatus(nextStatus);
      }
      if (nextStatus === "PAID") {
        toast.success("Pembayaran berhasil, kursus dapat diakses.");
      } else {
        toast.info("Status pembayaran belum berubah.");
      }
    } catch {
      toast.error("Gagal memeriksa status pembayaran.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, isVA = true) => {
    navigator.clipboard.writeText(text);
    toast(isVA ? "Nomor Virtual Account disalin!" : "ID Transaksi disalin!", {
      icon: <Copy className="w-5 h-5 text-gray-100" />,
    });
  };

  const OrderSummaryCard = () => {
    if (!course) return null;
    const planAmount = Number(course.price || 0);
    const chargeAmount = Number(course.price || 0);
    const total = paymentData
      ? (paymentData.total_amount || (chargeAmount + (paymentData.handling_fee || 0) + (paymentData.admin_fee || 0)))
      : selectedMethod
      ? (course.price + Number(selectedMethod.handling_fee || 0) + Number(selectedMethod.admin_fee || 0))
      : course.price;

    return (
      <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <button
          type="button"
          className="flex w-full cursor-pointer items-center justify-between border-b bg-slate-50 p-4 text-left transition hover:bg-slate-100"
          onClick={() => setShowDetail(!showDetail)}
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2 text-blue-600">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Total Tagihan</p>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(total)}
              </p>
            </div>
          </div>
          {showDetail ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </button>

        {showDetail && (
          <div className="animate-in slide-in-from-top-2 bg-white p-4 text-gray-800">
            <div className="mb-4 flex items-center justify-between border-b pb-2 text-xs">
              <span>Kursus</span>
              <span className="font-semibold capitalize">
                {course.title}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Harga Kursus</span>
                <span>{formatCurrency(planAmount)}</span>
              </div>
              {(paymentData?.handling_fee || (selectedMethod ? Number(selectedMethod.handling_fee || 0) : 0)) > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Biaya Layanan</span>
                  <span>
                    {formatCurrency(paymentData?.handling_fee || selectedMethod?.handling_fee || 0)}
                  </span>
                </div>
              )}
              {(paymentData?.admin_fee || (selectedMethod ? Number(selectedMethod.admin_fee || 0) : 0)) > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Biaya Admin</span>
                  <span>
                    {formatCurrency(paymentData?.admin_fee || selectedMethod?.admin_fee || 0)}
                  </span>
                </div>
              )}
              <div className="mt-4 pt-3 border-t border-dashed flex items-center justify-between">
                <span className="text-sm font-bold text-gray-800">Total Pembayaran</span>
                <span className="text-lg font-bold text-blue-600">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (initLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (paymentStatus === "PAID") {
    return (
      <PaymentPaid paymentData={paymentData} onViewSubscriptions={() => navigate(`/dashboard`)} />
    );
  }
  if (paymentStatus === "ERROR") return <PaymentError paymentStatus="ERROR" errorMsg={errorMsg} />;
  if (paymentStatus === "EXPIRED") return <PaymentExpired paymentStatus="EXPIRED" errorMsg={errorMsg} />;

  // Pending payment screen (visual instructions)
  if (paymentStatus === "PENDING" && paymentData) {
    return (
      <div className="flex min-h-screen flex-col items-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-lg">
          <OrderSummaryCard />

          <div className="animate-in slide-in-from-bottom-4 overflow-hidden rounded-2xl bg-white shadow-xl duration-500">
            <div className="bg-slate-900 p-6 text-center text-white">
              <p className="text-sm font-medium opacity-80">Selesaikan Pembayaran</p>
              <button
                type="button"
                className="mx-auto mt-3 flex w-fit items-center rounded-full border border-slate-700 bg-slate-800/50 px-4 py-1.5 text-xs transition hover:bg-slate-700"
                onClick={() => copyToClipboard(paymentData.transaction_id, false)}
              >
                <span className="font-mono opacity-90">{paymentData.transaction_id}</span>
                <Copy className="ml-2 h-3 w-3 opacity-70" />
              </button>
            </div>

            <div className="p-6 md:p-8">
              <div className="mb-6 flex items-start rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900 shadow-sm">
                <AlertCircle className="mr-3 mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
                <div>
                  <p className="font-bold">Bayar sebelum:</p>
                  <p className="font-medium">{dayjs(paymentData.expiry_date).format("DD MMM YYYY, HH:mm")} WIB</p>
                </div>
              </div>

              {paymentData.payment_type === "QRIS" ? (
                <div className="flex flex-col items-center">
                  <p className="mb-4 text-center text-sm font-medium text-gray-600">
                    Scan QRIS menggunakan aplikasi e-wallet atau mobile banking pilihan Anda.
                  </p>
                  <div className="mb-6 rounded-xl border-2 border-dashed border-gray-300 bg-white p-4 shadow-sm">
                    {(paymentData.qr_code_base64 || paymentData.qr_code_url) ? (
                      <img src={paymentData.qr_code_base64 || paymentData.qr_code_url} alt="QR Code Payment" className="h-56 w-56 object-contain" />
                    ) : (
                      <div className="flex h-56 w-56 items-center justify-center text-sm text-gray-400">QR Code belum tersedia</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {selectedMethod?.logo && <img src={selectedMethod.logo} alt="QRIS Logo" className="h-6" />}
                    <span>Supported by QRIS</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col">
                  <p className="mb-4 text-center text-sm text-gray-600">Lakukan transfer ke Nomor Virtual Account berikut:</p>
                  {selectedMethod?.logo && (
                    <div className="mb-6 flex items-center justify-center">
                      <img src={selectedMethod.logo} alt={selectedMethod.name} className="h-8 object-contain" />
                    </div>
                  )}
                  <div className="group relative mb-6 flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/50 p-5 shadow-sm">
                    <div>
                      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-blue-500">Nomor Virtual Account</p>
                      <p className="font-mono text-2xl font-bold tracking-wider text-gray-800">
                        {paymentData.payment_number || paymentData.va_number}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(paymentData.payment_number || paymentData.va_number)}
                      className="rounded-lg border border-gray-200 bg-white p-2.5 text-gray-500 shadow-sm transition-all hover:border-blue-500 hover:bg-blue-500 hover:text-white active:scale-95"
                      title="Salin Nomor"
                    >
                      <Copy className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-5 text-xs text-gray-500">
                    <p className="font-bold text-gray-700">Cara Pembayaran:</p>
                    <ol className="ml-1 list-inside list-decimal space-y-1.5">
                      <li>Buka aplikasi Mobile Banking Anda</li>
                      <li>
                        Pilih menu <strong>Transfer Virtual Account</strong>
                      </li>
                      <li>Masukkan nomor VA di atas</li>
                      <li>Pastikan total tagihan sesuai</li>
                      <li>Masukkan PIN untuk membayar</li>
                    </ol>
                  </div>
                </div>
              )}

              <div className="mt-8 border-t border-gray-100 pt-6 text-center">
                <div className="inline-flex animate-pulse items-center rounded-full bg-blue-50 px-4 py-2 text-xs font-medium text-blue-600">
                  <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Mengecek status pembayaran otomatis...
                </div>
                <Button variant="outline" className="mt-4 w-full" onClick={refreshPaymentStatus} disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-600" />}
                  Cek Status Pembayaran
                </Button>
              </div>
            </div>
          </div>
        </div>
        <PaymentFooter />
      </div>
    );
  }

  // Initial Checkout / Select Payment Method Screen
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-2 text-center text-2xl font-bold text-gray-900 md:text-3xl">Pilih Metode Pembayaran</h1>
        <p className="mb-8 text-center text-sm text-gray-500">
          Pilih metode pembayaran untuk membeli kursus "{course?.title}".
        </p>

        <Button
          variant="outline"
          className="mb-6 w-full"
          onClick={() => navigate(`/dashboard/courses/${courseId}`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Batal & Kembali ke Detail Kursus
        </Button>

        {errorMsg && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-center text-sm text-red-600">
            {errorMsg}
          </div>
        )}

        <OrderSummaryCard />

        <div className="grid gap-4 md:grid-cols-2">
          {paymentMethods.map((method) => {
            const isActive = selectedMethod?.id === method.id;
            return (
              <button
                key={method.id}
                type="button"
                onClick={() => handleMethodSelect(method)}
                disabled={loading}
                className={cn(
                  "relative flex w-full items-center rounded-xl border-2 p-4 transition-all cursor-pointer",
                  !isActive && !loading && "border-transparent bg-white shadow-sm hover:border-blue-300",
                  isActive && "border-blue-600 bg-blue-50/40 shadow-md",
                  loading && "cursor-not-allowed opacity-50"
                )}
              >
                {isActive && (
                  <div className="absolute -right-2 -top-3 rounded-full bg-white">
                    <CheckCircle2 className="h-6 w-6 text-blue-600" />
                  </div>
                )}
                <div className="mr-4 flex h-10 w-16 items-center justify-center rounded-lg border bg-white p-1">
                  {method.logo ? (
                    <img src={method.logo} alt={method.name} className="max-h-full object-contain" />
                  ) : (
                    <CreditCard className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <h3 className="truncate text-sm font-bold text-gray-900">{method.name}</h3>
                  <div className="mt-0.5 flex items-center">
                    <Tag className="mr-1 h-3 w-3 text-gray-400" />
                    <p className="text-[11px] text-gray-500">
                      {method.type === "QR" ? "Scan Otomatis" : "Virtual Account"}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <Button
          onClick={() => setConfirmationData({ ...selectedMethod, isModalOpen: true })}
          className="mt-8 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 text-base shadow-lg transition duration-200"
          disabled={!selectedMethod || loading}
        >
          Bayar Sekarang
        </Button>

        {/* Confirmation Details Modal */}
        {confirmationData?.isModalOpen && course && selectedMethod && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
            <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <h3 className="mb-4 text-lg font-bold text-gray-900">Rincian Pembayaran</h3>
              <div className="space-y-3 text-sm text-gray-500">
                <div className="flex justify-between">
                  <span>Harga Kursus</span>
                  <span>{formatCurrency(course.price)}</span>
                </div>
                {Number(selectedMethod.handling_fee || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>Biaya Layanan</span>
                    <span>{formatCurrency(selectedMethod.handling_fee)}</span>
                  </div>
                )}
                {Number(selectedMethod.admin_fee || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>Biaya Admin</span>
                    <span>{formatCurrency(selectedMethod.admin_fee)}</span>
                  </div>
                )}
                <div className="my-2 border-t border-dashed" />
                <div className="flex justify-between text-lg font-bold text-gray-900">
                  <span>Total Bayar</span>
                  <span className="text-blue-600 font-bold">
                    {formatCurrency(
                      course.price +
                        Number(selectedMethod.handling_fee || 0) +
                        Number(selectedMethod.admin_fee || 0)
                    )}
                  </span>
                </div>
              </div>
              <div className="mt-6 flex w-full gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmationData(null)}>
                  Batal
                </Button>
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleConfirmPayment} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" /> : null}
                  Konfirmasi Bayar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      <PaymentFooter />
    </div>
  );
}
