import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";
import { type LevelPlanId } from "@/lib/level-plans";
import { useLang } from "@/lib/i18n";
const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  CreditCard,
  Loader2,
  Mail,
  RefreshCw,
  ShoppingBag,
  Tag,
  Users,
  Lock,
  QrCode,
  Landmark,
  Building2,
  Smartphone,
  Check,
  CheckCircle,
  Sparkles,
} from "lucide-react";

export type MembershipPlanId = "legacy" | "family-public" | "business-public" | "legacy-kita" | "family-kita" | "business-kita";

export const Route = createFileRoute("/pembayaran")({
  validateSearch: (search: Record<string, unknown>): { level?: string; plan?: string; payment_id?: string } => {
    const out: { level?: string; plan?: string; payment_id?: string } = {};
    const level = search.level;
    const plan = search.plan;
    const paymentId = search.payment_id;
    if (typeof level === "string") {
      out.level = level;
    }
    if (typeof plan === "string") {
      out.plan = plan;
    }
    if (typeof paymentId === "string") {
      out.payment_id = paymentId;
    }
    return out;
  },
  head: () => ({
    meta: [
      { title: "Payment — KITA Future Homeschool" },
      {
        name: "description",
        content:
          "Complete your KITA Future Homeschool subscription payment. QRIS, bank transfer, virtual account, e-wallet, and card.",
      },
    ],
  }),
  component: GuestPaymentPage,
});

const getResponseData = (r: any) => r.data?.data || r.data || [];

const parseFeatures = (features: any): string[] => {
  if (!features) return [];
  if (Array.isArray(features)) return features.map((f: any) => typeof f === "object" ? (f.feature_key || f.description || "") : String(f));
  if (typeof features === "string") {
    try {
      const parsed = JSON.parse(features);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const normalizePaymentStatus = (status: string) => String(status || "").toUpperCase();

const resolvePlanId = (plan: any, fallbackPlans: any[] = []) => {
  if (plan?.slug) return plan.slug;
  if (plan?.id) return plan.id;
  const planId = plan?.plan_id || plan?.provider_plan_id;
  if (!planId) return "";
  return fallbackPlans.find((item) => item.id === planId)?.slug || planId;
};

const PaymentFooter = () => (
  <div className="mt-12 text-center text-xs text-muted-foreground/60">
    &copy; KITA Future Homeschool {new Date().getFullYear()}. Secure Checkout powered by Xendit.
  </div>
);

function PaymentError({
  paymentStatus,
  errorMsg,
  en,
}: {
  paymentStatus: "EXPIRED" | "ERROR" | "FAILED";
  errorMsg?: string;
  en?: boolean;
}) {
  return (
    <div className="min-h-[90vh] bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-t-4 border-red-500 animate-in zoom-in-95 duration-300">
        <div className="mx-auto bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="w-10 h-10 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          {paymentStatus === "EXPIRED" 
            ? (en ? "Payment Expired" : "Waktu Pembayaran Habis") 
            : (en ? "An Error Occurred" : "Terjadi Kesalahan")}
        </h2>
        <p className="text-gray-600 mb-6 text-sm">
          {errorMsg || (en ? "Sorry, an error occurred while processing your request." : "Mohon maaf, terjadi kesalahan saat memuat data.")}{" "}
          {en 
            ? "Please retry checkout or contact our support team if this issue persists." 
            : "Silakan ulangi proses checkout atau hubungi tim support kami jika masalah berlanjut."}
        </p>
        <button
          onClick={() => (window.location.href = "/harga")}
          className="bg-gray-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-900 transition w-full"
        >
          {en ? "Back to Pricing Page" : "Kembali ke Halaman Harga"}
        </button>
      </div>
      <PaymentFooter />
    </div>
  );
}

function PaymentPaid({
  paymentData,
  en,
}: {
  paymentData: any;
  en?: boolean;
}) {
  return (
    <div className="min-h-[90vh] bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-t-4 border-green-500 animate-in zoom-in-95 duration-300">
        <div className="mx-auto bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          {en ? "Payment Successful!" : "Pembayaran Berhasil!"}
        </h2>
        <p className="text-gray-600 mb-6 text-sm leading-relaxed">
          {en
            ? "Thank you! Your payment was successful. We have generated an activation link for your account."
            : "Terima kasih, pembayaran berhasil dilakukan. Akun Anda siap untuk diaktifkan."}
          <br />
          <span className="font-semibold text-emerald-600 mt-2 block">
            {en
              ? "Please check your email inbox (and spam folder) for the password setup link."
              : "Silakan periksa kotak masuk (dan folder spam) email Anda untuk mengatur password baru."}
          </span>
        </p>
        <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-100">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            {en ? "Total Paid" : "Total Dibayar"}
          </p>
          <p className="text-xl font-bold text-gray-900">
            {formatCurrency(paymentData?.total_amount || paymentData?.charge_amount || 0)}
          </p>
        </div>
        <button
          onClick={() => (window.location.href = import.meta.env.VITE_ADMIN_URL)}
          className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition w-full shadow-lg shadow-green-200"
        >
          {en ? "Go to Login Page" : "Ke Halaman Login"}
        </button>
      </div>
      <PaymentFooter />
    </div>
  );
}


  const OrderSummaryCard = ({
    selectedPlan,
    showDetail,
    setShowDetail,
    paymentData,
    confirmationData,
    promoData,
    en,
    parseFeatures,
  }: any) => {
    if (!selectedPlan) return null;
    const features = parseFeatures(selectedPlan.features);
    const isTrial = confirmationData?.id === "free_trial" || paymentData?.payment_type === "free_trial";
    const planAmount = isTrial ? 0 : Number(
      paymentData?.plan_amount || selectedPlan.amount || selectedPlan.amount || 0,
    );
    const promoDiscount = isTrial ? 0 : Number(
      paymentData?.credit_amount || promoData?.discount_amount || 0,
    );
    const total = isTrial ? 0 : paymentData
      ? paymentData.total_amount ||
        planAmount + (paymentData.handling_fee || 0) + (paymentData.admin_fee || 0)
      : Math.max(0, planAmount - promoDiscount) + (confirmationData?.handling_fee || 0) + (confirmationData?.admin_fee || 0);

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
              <p className="text-xs font-medium text-gray-500">
                {en ? "Total Bill" : "Total Tagihan"}
              </p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(total)}</p>
            </div>
          </div>
          {showDetail ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>

        {showDetail && (
          <div className="animate-in slide-in-from-top-2 bg-white p-4 text-gray-800">
            <div className="mb-4 flex items-center justify-between border-b pb-2 text-xs">
              <span>{en ? "Package" : "Paket"}</span>
              <span className="font-semibold capitalize">{selectedPlan.name}</span>
            </div>
            <div className="space-y-2">
              {(features.length
                ? features
                : [
                    en ? "Access to curriculum content" : "Akses materi kurikulum lengkap",
                    en ? "Personalized child portfolio" : "Portofolio belajar mandiri anak",
                    en ? "Secure automated payments" : "Metode pembayaran aman & otomatis",
                  ]
              ).map((feature: string) => (
                <div key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-dashed pt-3">
              <div className="flex justify-between text-sm">
                <span>{en ? "Package Price" : "Harga Paket"}</span>
                <span>{formatCurrency(planAmount)}</span>
              </div>
              {promoDiscount > 0 && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>
                    {en ? "Promo Discount" : "Diskon Promo"}{" "}
                    {paymentData?.promo_code || promoData?.code ? `(${paymentData?.promo_code || promoData?.code})` : ""}
                  </span>
                  <span>-{formatCurrency(promoDiscount)}</span>
                </div>
              )}
              {(paymentData?.handling_fee || confirmationData?.handling_fee) > 0 && (
                <div className="flex justify-between text-sm">
                  <span>{en ? "Service Fee" : "Biaya Layanan"}</span>
                  <span>
                    {formatCurrency(paymentData?.handling_fee || confirmationData?.handling_fee)}
                  </span>
                </div>
              )}
              {(paymentData?.admin_fee || confirmationData?.admin_fee) > 0 && (
                <div className="flex justify-between text-sm">
                  <span>{en ? "Admin Fee" : "Biaya Admin"}</span>
                  <span>
                    {formatCurrency(paymentData?.admin_fee || confirmationData?.admin_fee)}
                  </span>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-bold">
                  {en ? "Total Payment" : "Total Pembayaran"}
                </span>
                <span className="text-lg font-bold text-blue-600">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };


function GuestPaymentPage() {
  const { lang } = useLang();
  const en = lang === "en";
  const search = Route.useSearch() as { level?: string; plan?: string; payment_id?: string };
  const { level: levelIdFromSearch, plan: planIdFromSearch, payment_id: paymentIdFromUrl } = search;
  const levelId = levelIdFromSearch || planIdFromSearch;
  const navigate = Route.useNavigate();

  const pollingRef = useRef<any>(null);

  // Guest Registration Form States
  const [parentName, setParentName] = useState("");
  const [parentUsername, setParentUsername] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentNisn, setStudentNisn] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [teacherUsername, setTeacherUsername] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [city, setCity] = useState("");
  const [institution, setInstitution] = useState("");
  const [teachingStatus, setTeachingStatus] = useState("");
  const [simpkb, setSimpkb] = useState("");
  const [nuptk, setNuptk] = useState("");
  const [gtk, setGtk] = useState("");
  const [declarationChecked, setDeclarationChecked] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [isValidatingEmail, setIsValidatingEmail] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [isValidatingUsername, setIsValidatingUsername] = useState(false);

  // Plans, Payment Methods and Active states
  const [initLoading, setInitLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState(levelId || "");
  const [selectedMethod, setSelectedMethod] = useState<any>(null);
  const [confirmationData, setConfirmationData] = useState<any>(null);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [paymentStatus, setPaymentStatus] = useState("IDLE");
  const [paymentId, setPaymentId] = useState(paymentIdFromUrl || "");
  const [errorMsg, setErrorMsg] = useState("");
  const [showDetail, setShowDetail] = useState(true);
  const [promoCode, setPromoCode] = useState("");
  const [promoData, setPromoData] = useState<any>(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  const selectedPlan = useMemo(
    () => {
      if (!selectedPlanId) return null;
      return plans.find((plan) => plan.slug === selectedPlanId || plan.id === selectedPlanId) || null;
    },
    [plans, selectedPlanId]
  );

  const checkoutType = selectedPlan?.pricing_category?.checkout_type || "parent_child";

  const isPaymentStep = useMemo(() => {
    return !!paymentId || paymentStatus === "PENDING";
  }, [paymentId, paymentStatus]);

  useEffect(() => {
    const emailToCheck = checkoutType === "teacher" ? teacherEmail : parentEmail;
    
    if (!emailToCheck) {
      setEmailError("");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToCheck)) {
      setEmailError(en ? "Invalid email format" : "Format email tidak valid");
      return;
    }

    setEmailError("");
    setIsValidatingEmail(true);

    const timer = setTimeout(async () => {
      try {
        const res = await api.get("/checkout/check-email", { params: { email: emailToCheck } });
        const data = res.data?.data || res.data;
        if (data && data.available === false) {
          setEmailError(en ? "Email is already registered" : "Email sudah terdaftar");
        } else {
          setEmailError("");
        }
      } catch (err) {
        console.error("Failed to check email availability", err);
      } finally {
        setIsValidatingEmail(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [parentEmail, teacherEmail, checkoutType, en]);

  useEffect(() => {
    const usernameToCheck =
      checkoutType === "teacher" ? teacherUsername : parentUsername;
    if (!usernameToCheck) {
      setUsernameError("");
      setIsValidatingUsername(false);
      return;
    }

    if (!/^[a-z0-9._-]{3,30}$/.test(usernameToCheck)) {
      setUsernameError(
        en
          ? "Use 3-30 lowercase letters, numbers, dots, underscores, or hyphens."
          : "Gunakan 3-30 huruf kecil, angka, titik, garis bawah, atau tanda hubung.",
      );
      setIsValidatingUsername(false);
      return;
    }

    setUsernameError("");
    setIsValidatingUsername(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await api.get("/checkout/check-username", {
          params: { username: usernameToCheck },
        });
        const data = response.data?.data || response.data;
        setUsernameError(
          data?.available === false
            ? en
              ? "Username is already in use."
              : "Username sudah digunakan."
            : "",
        );
      } catch (error) {
        console.error("Failed to check username availability", error);
      } finally {
        setIsValidatingUsername(false);
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [parentUsername, teacherUsername, checkoutType, en]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedPlan) {
      const amount = selectedPlan.amount || selectedPlan.amount || 0;
      fetchPaymentMethods(amount);
    }
  }, [selectedPlan?.id]);

  useEffect(() => {
    if (!paymentId || ["PAID", "EXPIRED", "FAILED"].includes(paymentStatus)) return;

    const checkStatus = async () => {
      try {
        const response = await api.get(`/checkout/payment-status/${paymentId}`);
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
          toast.success(en ? "Payment successful, account ready for activation!" : "Pembayaran berhasil, silakan aktifkan akun Anda.");
        } else if (["EXPIRED", "FAILED"].includes(nextStatus)) {
          clearInterval(pollingRef.current);
        }
      } catch (e) {
        // Keep polling quiet
      }
    };

    checkStatus();
    pollingRef.current = setInterval(checkStatus, 5000);
    return () => clearInterval(pollingRef.current);
  }, [paymentId, paymentStatus]);

  const fetchInitialData = async () => {
    setInitLoading(true);
    try {
      const plansRes = await api.get("/lms/subscription-plans", {
        params: { pricing_category_slug: "guru-2-digit" },
      });
      const nextPlans = getResponseData(plansRes);
      setPlans(nextPlans);

      const initialPlan = nextPlans.find((plan: any) => plan.slug === levelId || plan.id === levelId) || null;
      if (initialPlan) {
        setSelectedPlanId(initialPlan.slug);
        await fetchPaymentMethods(initialPlan.amount || initialPlan.amount);
      }

      if (paymentIdFromUrl) {
        await loadPayment(paymentIdFromUrl, nextPlans);
      }
    } catch (err: any) {
      setPaymentStatus("ERROR");
      setErrorMsg(err.response?.data?.message || "Gagal memuat data pembayaran.");
    } finally {
      setInitLoading(false);
    }
  };

  const fetchPaymentMethods = async (amount: number) => {
    try {
      const response = await api.get("/lms/payment-methods", { params: { amount } });
      setPaymentMethods(getResponseData(response));
    } catch (e) {
      console.error("Failed to load payment methods", e);
    }
  };

  const resetPromo = () => {
    setPromoCode("");
    setPromoData(null);
    setPromoError("");
  };

  const handleApplyPromo = async () => {
    if (!selectedPlan || !promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError("");
    try {
      const response = await api.post("/checkout/validate-promo", {
        plan_id: selectedPlan.id,
        promo_code: promoCode,
      });
      const nextPromo = response.data?.data || response.data;
      setPromoData(nextPromo);
      setPromoCode(nextPromo.code || promoCode.trim().toUpperCase());
      setSelectedMethod(null);
      setConfirmationData(null);
      await fetchPaymentMethods(nextPromo.final_amount || 0);
      toast.success(en ? "Promo code applied." : "Kode promo berhasil digunakan.");
    } catch (err: any) {
      const message = err.response?.data?.message || err.response?.data?.error || (en ? "Promo code is invalid." : "Kode promo tidak valid.");
      setPromoData(null);
      setPromoError(message);
      toast.error(message);
    } finally {
      setPromoLoading(false);
    }
  };

  const loadPayment = async (id: string, availablePlans = plans) => {
    try {
      const response = await api.get(`/checkout/payment-status/${id}`);
      const payload = response.data?.data || response.data;
      const payment = payload.payment || payload;
      const nextData = payload.payment_data || null;
      const paymentPlan = payload.plan || payload.subscription?.plan || null;
      let planOptions = availablePlans;
      setPaymentData(nextData);
      setPaymentStatus(normalizePaymentStatus(payment.status));
      setPaymentId(id);

      if (paymentPlan?.id && !planOptions.some((plan) => plan.id === paymentPlan.id)) {
        planOptions = [...planOptions, paymentPlan];
        setPlans(planOptions);
      }
      
      const planId = resolvePlanId(paymentPlan, planOptions);
      if (planId) {
        setSelectedPlanId(planId);
        const plan = planOptions.find((item) => item.slug === planId || item.id === planId);
        if (plan) {
          await fetchPaymentMethods(plan.amount || 0);
        }
      }

      if (payment.payment_type) {
        const methodInfo = paymentMethods.find((method) => method.id === payment.payment_type || method.code === payment.payment_type);
        setSelectedMethod({
          id: payment.payment_type,
          name: methodInfo?.name || payment.payment_type,
          logo: methodInfo?.logo || "/assets/qris.png",
          type: payment.payment_type === "QRIS" ? "QR" : "VA",
        });
      }
    } catch (err: any) {
      toast.error("Gagal memuat status pembayaran.");
    }
  };

  const handleMethodSelect = (method: any) => {
    setSelectedMethod(method);
    setConfirmationData({ ...method, isModalOpen: false });
  };

  const handleConfirmPayment = async () => {
    if (checkoutType === "teacher") {
      if (!teacherName || !teacherUsername || !teacherEmail || !whatsapp || !city || !institution || !teachingStatus) {
        toast.error("Mohon lengkapi seluruh kolom wajib (*)");
        return;
      }
      if (!simpkb.trim() && !nuptk.trim() && !gtk.trim()) {
        toast.error("Wajib mengisi minimal salah satu metode verifikasi (SIMPKB / NUPTK / No GTK)");
        return;
      }
      if (!declarationChecked) {
        toast.error("Anda harus menyetujui pernyataan kebenaran data");
        return;
      }
    } else {
      if (!parentName || !parentUsername || !parentEmail || !parentPhone || !studentName || !studentNisn) {
        toast.error(en ? "Please fill in all account information" : "Mohon lengkapi semua informasi akun");
        return;
      }
    }
    if (emailError) {
      toast.error(emailError);
      return;
    }
    if (usernameError || isValidatingUsername) {
      toast.error(usernameError || (en ? "Checking username…" : "Sedang memeriksa username…"));
      return;
    }
    if (!selectedPlan) {
      toast.error(en ? "Please select a plan" : "Pilih paket belajar terlebih dahulu");
      return;
    }
    if (!confirmationData) {
      toast.error(en ? "Please select a payment method" : "Pilih metode pembayaran terlebih dahulu");
      return;
    }

    const paymentMethod = confirmationData;
    setConfirmationData({ ...paymentMethod, isModalOpen: false });
    setLoading(true);
    setErrorMsg("");

    try {
      const payloadObj: any = {
        plan_id: selectedPlan.id,
        payment_method: paymentMethod.id || paymentMethod.code,
      };
      if (promoData?.code && paymentMethod.id !== "free_trial" && paymentMethod.id !== "approval") {
        payloadObj.promo_code = promoData.code;
      }

      if (checkoutType === "teacher") {
        payloadObj.teacher_name = teacherName;
        payloadObj.teacher_username = teacherUsername;
        payloadObj.teacher_email = teacherEmail;
        payloadObj.whatsapp = whatsapp;
        payloadObj.city = city;
        payloadObj.institution = institution;
        payloadObj.teaching_status = teachingStatus;
        payloadObj.simpkb = simpkb;
        payloadObj.nuptk = nuptk;
        payloadObj.gtk = gtk;
        payloadObj.declaration = declarationChecked;
      } else {
        payloadObj.parent_name = parentName;
        payloadObj.parent_username = parentUsername;
        payloadObj.parent_email = parentEmail;
        payloadObj.parent_phone = parentPhone;
        payloadObj.student_name = studentName;
        payloadObj.student_nisn = studentNisn;
      }

      const response = await api.post("/checkout/guest", payloadObj);

      const payload = response.data?.data || response.data;
      setPaymentData(payload.payment_data);
      setPaymentStatus("PENDING");
      setShowDetail(false);
      setSelectedMethod(paymentMethod);
      
      if (payload.payment?.id) {
        setPaymentId(payload.payment.id);
        navigate({
          search: (prev: any) => ({
            ...prev,
            payment_id: payload.payment.id,
          }),
        });
      }
    } catch (err: any) {
      toast.error("Gagal membuat pembayaran.");
      setErrorMsg(err.response?.data?.message || err.response?.data?.error || "Gagal menginisiasi pembayaran.");
    } finally {
      setLoading(false);
    }
  };

  const refreshPaymentStatus = async () => {
    if (!paymentId) return;
    try {
      const response = await api.get(`/checkout/payment-status/${paymentId}`);
      const payload = response.data?.data || response.data;
      const payment = payload.payment || payload;
      const nextStatus = normalizePaymentStatus(payment.status);
      setPaymentData(payload.payment_data || paymentData);
      setPaymentStatus(nextStatus || paymentStatus);
      if (nextStatus === "PAID") {
        toast.success(en ? "Payment verified successfully!" : "Pembayaran berhasil diverifikasi!");
      } else {
        toast.info(en ? "Payment status updated." : "Status pembayaran diperbarui.");
      }
    } catch {
      toast.error(en ? "Failed to check payment status." : "Gagal cek status pembayaran.");
    }
  };

  const copyToClipboard = (text: string, isVA = true) => {
    navigator.clipboard.writeText(text);
    toast(isVA ? (en ? "Virtual Account number copied!" : "Nomor Virtual Account disalin!") : (en ? "Transaction ID copied!" : "ID Transaksi disalin!"), {
      icon: <Copy className="w-5 h-5 text-gray-100" />,
    });
  };

  const backToPlans = () => {
    setSelectedMethod(null);
    setConfirmationData(null);
    setPaymentData(null);
    setPaymentStatus("IDLE");
    setPaymentId("");
    navigate({
      search: (prev: any) => {
        const next = { ...prev };
        delete next.payment_id;
        return next;
      },
    });
  };

  if (initLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (paymentStatus === "PAID") {
    return <PaymentPaid paymentData={paymentData} en={en} />;
  }
  if (paymentStatus === "ERROR" || paymentStatus === "FAILED") {
    return <PaymentError paymentStatus="ERROR" errorMsg={errorMsg} en={en} />;
  }
  if (paymentStatus === "EXPIRED") {
    return <PaymentError paymentStatus="EXPIRED" errorMsg={errorMsg} en={en} />;
  }

  if (paymentStatus === "PENDING" && paymentData) {
    return (
      <SiteLayout>
        <div className="flex min-h-screen flex-col items-center bg-gray-50 px-4 py-10">
          <div className="w-full max-w-lg">
            <OrderSummaryCard
              selectedPlan={selectedPlan}
              showDetail={showDetail}
              setShowDetail={setShowDetail}
              paymentData={paymentData}
              confirmationData={confirmationData}
              promoData={promoData}
              en={en}
              parseFeatures={parseFeatures}
            />

            <div className="animate-in slide-in-from-bottom-4 overflow-hidden rounded-2xl bg-white shadow-xl duration-500">
              <div className="bg-slate-900 p-6 text-center text-white">
                <p className="text-sm font-medium opacity-80">
                  {en ? "Complete Your Payment" : "Selesaikan Pembayaran"}
                </p>
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
                    <p className="font-bold">{en ? "Pay before:" : "Bayar sebelum:"}</p>
                    <p className="font-medium">{formatDate(paymentData.expiry_date)} WIB</p>
                  </div>
                </div>

                {paymentData.payment_type === "QRIS" ? (
                  <div className="flex flex-col items-center">
                    <p className="mb-4 text-center text-sm font-medium text-gray-600">
                      {en
                        ? "Scan QRIS using your mobile banking or e-wallet app."
                        : "Scan QRIS menggunakan aplikasi e-wallet atau mobile banking pilihan Anda."}
                    </p>
                    <div className="mb-6 rounded-xl border-2 border-dashed border-gray-300 bg-white p-4 shadow-sm">
                      <img
                        src={paymentData.qr_code_base64}
                        alt="QR Code Payment"
                        className="h-56 w-56 object-contain"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      {selectedMethod?.logo && (
                        <img src={selectedMethod.logo} alt="QRIS Logo" className="h-6" />
                      )}
                      <span>Supported by QRIS</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <p className="mb-4 text-center text-sm text-gray-600">
                      {en
                        ? "Transfer money to the following Virtual Account number:"
                        : "Lakukan transfer ke Nomor Virtual Account berikut:"}
                    </p>
                    {selectedMethod?.logo && (
                      <div className="mb-6 flex items-center justify-center">
                        <img
                          src={selectedMethod.logo}
                          alt={selectedMethod.name}
                          className="h-8 object-contain"
                        />
                      </div>
                    )}
                    <div className="group relative mb-6 flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/50 p-5 shadow-sm">
                      <div>
                        <p className="mb-1 text-xs font-bold uppercase tracking-wider text-blue-500">
                          Nomor Virtual Account
                        </p>
                        <p className="font-mono text-2xl font-bold tracking-wider text-gray-800">
                          {paymentData.payment_number}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(paymentData.payment_number)}
                        className="rounded-lg border border-gray-200 bg-white p-2.5 text-gray-500 shadow-sm transition-all hover:border-blue-500 hover:bg-blue-500 hover:text-white active:scale-95"
                        title="Salin Nomor"
                      >
                        <Copy className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-5 text-xs text-gray-500">
                      <p className="font-bold text-gray-700">
                        {en ? "How to Pay:" : "Cara Pembayaran:"}
                      </p>
                      <ol className="ml-1 list-inside list-decimal space-y-1.5">
                        <li>
                          {en
                            ? "Open your Mobile Banking application"
                            : "Buka aplikasi Mobile Banking Anda"}
                        </li>
                        <li>
                          {en ? "Select Transfer -> Virtual Account" : "Pilih menu "}
                          <strong>{en ? "Virtual Account" : "Transfer Virtual Account"}</strong>
                        </li>
                        <li>{en ? "Enter the VA number above" : "Masukkan nomor VA di atas"}</li>
                        <li>
                          {en
                            ? "Confirm total bill matches payment amount"
                            : "Pastikan total tagihan sesuai"}
                        </li>
                        <li>
                          {en
                            ? "Enter your PIN to complete transaction"
                            : "Masukkan PIN untuk membayar"}
                        </li>
                      </ol>
                    </div>
                  </div>
                )}

                <div className="mt-8 border-t border-gray-100 pt-6 text-center">
                  <div className="inline-flex animate-pulse items-center rounded-full bg-blue-50 px-4 py-2 text-xs font-medium text-blue-600">
                    <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                    {en
                      ? "Verifying payment status automatically..."
                      : "Mengecek status pembayaran otomatis..."}
                  </div>
                  <Button variant="outline" className="mt-4 w-full" onClick={refreshPaymentStatus}>
                    {en ? "Check Payment Status" : "Cek Status Pembayaran"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <PaymentFooter />
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="relative mx-auto max-w-6xl px-4 py-10 md:py-14">
        {/* Backdrop design */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex justify-center"
        >
          <div className="h-72 w-[44rem] rounded-full bg-gradient-to-r from-primary/15 via-indigo-500/10 to-fuchsia-500/10 blur-3xl" />
        </div>

        {/* Header */}
        <div className="mb-10 text-center md:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary backdrop-blur">
            <Lock className="h-3 w-3" />
            {en ? "Secure Checkout" : "Checkout Aman"}
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">
            {en ? "Complete your" : "Selesaikan"}{" "}
            <span className="text-accent-grad">{en ? "Registration" : "Pendaftaran"}</span>
          </h1>

          <p className="mt-3 max-w-xl text-base text-muted-foreground md:text-lg">
            {en
              ? "Fill in your account details. Your access will be activated instantly after successful payment."
              : "Lengkapi informasi akun Anda. Akses akan langsung aktif setelah pembayaran berhasil."}
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          {/* Left Column (Inputs & Payment Methods) */}
          <div className="space-y-6">
            {/* 1. Account Info Form */}
            <Card className="rounded-[1.5rem] border border-border/60 bg-card/80 shadow-card backdrop-blur">
              <CardContent className="p-7">
                <div className="flex items-center gap-2 mb-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm">
                    <Users className="h-4 w-4" />
                  </span>
                  <h2 className="text-lg font-bold text-foreground">
                    {en ? "Guest Account Information" : "Informasi Akun Pendaftaran"}
                  </h2>
                </div>

                {checkoutType === "teacher" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="col-span-full mb-2">
                      <h3 className="text-base font-bold text-gray-900">Pendaftaran Guru</h3>
                      <h4 className="text-xs font-semibold text-gray-700 mt-1">
                        Verifikasi Profesi Guru
                      </h4>
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed bg-blue-50/50 p-4 rounded-xl border border-blue-100/60">
                        Program Guru2Digit hanya diperuntukkan bagi tenaga pendidik, guru, tutor,
                        homeschool educator, trainer pendidikan, dan pemilik lembaga pendidikan.
                        Untuk menjaga kualitas komunitas dan pembelajaran, verifikasi profesi wajib
                        dilakukan sebelum akses diberikan.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="teacher_name"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Nama Lengkap *
                      </Label>
                      <Input
                        id="teacher_name"
                        value={teacherName}
                        onChange={(e) => setTeacherName(e.target.value)}
                        placeholder="Nama lengkap"
                        className="h-11 rounded-xl border-border/60 bg-background/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="teacher_username"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Username *
                      </Label>
                      <div className="relative">
                        <Input
                          id="teacher_username"
                          value={teacherUsername}
                          onChange={(event) =>
                            setTeacherUsername(event.target.value.toLowerCase().replace(/\s+/g, ""))
                          }
                          autoComplete="username"
                          placeholder="username"
                          className={cn(
                            "h-11 rounded-xl border-border/60 bg-background/70 pr-10 focus-visible:ring-2 focus-visible:ring-primary/20",
                            usernameError
                              ? "border-red-500 focus-visible:border-red-500"
                              : "focus-visible:border-primary",
                          )}
                        />
                        {isValidatingUsername && (
                          <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      {usernameError && (
                        <p className="text-xs font-medium text-red-500">{usernameError}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="teacher_email"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Email *
                      </Label>
                      <div className="relative">
                        <Input
                          id="teacher_email"
                          type="email"
                          value={teacherEmail}
                          onChange={(e) => setTeacherEmail(e.target.value)}
                          placeholder="nama@email.com"
                          className={cn(
                            "h-11 rounded-xl border-border/60 bg-background/70 focus-visible:ring-2 focus-visible:ring-primary/20",
                            emailError
                              ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                              : "focus-visible:border-primary",
                          )}
                        />
                        {isValidatingEmail && (
                          <div className="absolute right-3 top-3.5">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      {emailError && (
                        <p className="text-xs text-red-500 font-medium animate-in fade-in duration-200">
                          {emailError}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="whatsapp"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        No. WhatsApp *
                      </Label>
                      <Input
                        id="whatsapp"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                        placeholder="08xxxxxxxxxx"
                        className="h-11 rounded-xl border-border/60 bg-background/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="city"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Kota *
                      </Label>
                      <Input
                        id="city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Kota"
                        className="h-11 rounded-xl border-border/60 bg-background/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="institution"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Institusi / Sekolah *
                      </Label>
                      <Input
                        id="institution"
                        value={institution}
                        onChange={(e) => setInstitution(e.target.value)}
                        placeholder="Nama sekolah atau lembaga"
                        className="h-11 rounded-xl border-border/60 bg-background/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="teaching_status"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Status Mengajar *
                      </Label>
                      <select
                        id="teaching_status"
                        value={teachingStatus}
                        onChange={(e) => setTeachingStatus(e.target.value)}
                        className="flex h-11 w-full rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Pilih status mengajar</option>
                        <option value="Guru PNS">Guru PNS</option>
                        <option value="Guru Swasta">Guru Swasta</option>
                        <option value="Guru Honorer">Guru Honorer</option>
                        <option value="Tutor / Mentor / Trainer">Tutor / Mentor / Trainer</option>
                        <option value="Homeschool Educator">Homeschool Educator</option>
                        <option value="Pemilik Lembaga Pendidikan">
                          Pemilik Lembaga Pendidikan
                        </option>
                        <option value="Lainnya">Lainnya</option>
                      </select>
                    </div>

                    <div className="col-span-full mt-4 border-t pt-4">
                      <h4 className="text-sm font-bold text-gray-900">
                        Verifikasi Tenaga Pendidik
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Wajib mengisi minimal salah satu metode verifikasi di bawah ini.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="simpkb"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        A. SIMPKB
                      </Label>
                      <Input
                        id="simpkb"
                        value={simpkb}
                        onChange={(e) => setSimpkb(e.target.value)}
                        placeholder="Nomor SIMPKB"
                        className="h-11 rounded-xl border-border/60 bg-background/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="nuptk"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        B. NUPTK
                      </Label>
                      <Input
                        id="nuptk"
                        value={nuptk}
                        onChange={(e) => setNuptk(e.target.value)}
                        placeholder="Nomor NUPTK"
                        className="h-11 rounded-xl border-border/60 bg-background/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="gtk"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        C. No GTK
                      </Label>
                      <Input
                        id="gtk"
                        value={gtk}
                        onChange={(e) => setGtk(e.target.value)}
                        placeholder="Nomor GTK"
                        className="h-11 rounded-xl border-border/60 bg-background/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label
                        htmlFor="parent_name"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        {en ? "Parent's Name" : "Nama Orang Tua"}
                      </Label>
                      <Input
                        id="parent_name"
                        value={parentName}
                        onChange={(e) => setParentName(e.target.value)}
                        placeholder={en ? "Your full name" : "Nama lengkap Anda"}
                        className="h-11 rounded-xl border-border/60 bg-background/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="parent_username"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        {en ? "Parent's Username" : "Username Orang Tua"} *
                      </Label>
                      <div className="relative">
                        <Input
                          id="parent_username"
                          value={parentUsername}
                          onChange={(event) =>
                            setParentUsername(event.target.value.toLowerCase().replace(/\s+/g, ""))
                          }
                          autoComplete="username"
                          placeholder="username"
                          className={cn(
                            "h-11 rounded-xl border-border/60 bg-background/70 pr-10 focus-visible:ring-2 focus-visible:ring-primary/20",
                            usernameError
                              ? "border-red-500 focus-visible:border-red-500"
                              : "focus-visible:border-primary",
                          )}
                        />
                        {isValidatingUsername && (
                          <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      {usernameError && (
                        <p className="text-xs font-medium text-red-500">{usernameError}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="parent_email"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        {en ? "Parent's Email" : "Email Orang Tua"}
                      </Label>
                      <div className="relative">
                        <Input
                          id="parent_email"
                          type="email"
                          value={parentEmail}
                          onChange={(e) => setParentEmail(e.target.value)}
                          placeholder="name@email.com"
                          className={cn(
                            "h-11 rounded-xl border-border/60 bg-background/70 focus-visible:ring-2 focus-visible:ring-primary/20",
                            emailError
                              ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                              : "focus-visible:border-primary",
                          )}
                        />
                        {isValidatingEmail && (
                          <div className="absolute right-3 top-3.5">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      {emailError && (
                        <p className="text-xs text-red-500 font-medium animate-in fade-in duration-200">
                          {emailError}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="parent_phone"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        {en ? "WhatsApp Number" : "No. WhatsApp"}
                      </Label>
                      <Input
                        id="parent_phone"
                        value={parentPhone}
                        onChange={(e) => setParentPhone(e.target.value)}
                        placeholder="08xxxxxxxxxx"
                        className="h-11 rounded-xl border-border/60 bg-background/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="student_name"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        {en ? "Child's Name" : "Nama Lengkap Anak"}
                      </Label>
                      <Input
                        id="student_name"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder={en ? "Child's full name" : "Nama lengkap anak"}
                        className="h-11 rounded-xl border-border/60 bg-background/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="student_nisn"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        {en ? "Student NISN" : "NISN Siswa"}
                      </Label>
                      <Input
                        id="student_nisn"
                        value={studentNisn}
                        onChange={(e) => setStudentNisn(e.target.value)}
                        placeholder={en ? "10-digit student NISN" : "10 digit NISN siswa"}
                        className="h-11 rounded-xl border-border/60 bg-background/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 2. Choose Plan if not selected or to change */}
            <Card className="rounded-[1.5rem] border border-border/60 bg-card/80 shadow-card backdrop-blur">
              <CardContent className="p-7">
                <div className="flex items-center gap-2 mb-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-sm">
                    <Tag className="h-4 w-4" />
                  </span>
                  <h2 className="text-lg font-bold text-foreground">
                    {en ? "Select Learning Access" : "Pilih Jenjang Belajar"}
                  </h2>
                </div>

                <div className="flex flex-wrap gap-2">
                  {plans.map((p) => {
                    const active = selectedPlanId === p.slug || selectedPlanId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPlanId(p.slug);
                          setSelectedMethod(null);
                          setConfirmationData(null);
                          resetPromo();
                        }}
                        className={cn(
                          "rounded-full border px-4 py-2 text-xs font-semibold transition-all duration-300",
                          active
                            ? "border-primary bg-primary/10 text-primary shadow-sm"
                            : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                        )}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* 3. Payment Methods Selector */}
            <Card className="rounded-[1.5rem] border border-border/60 bg-card/80 shadow-card backdrop-blur">
              <CardContent className="p-7">
                <div className="flex items-center gap-2 mb-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-500 text-white shadow-sm">
                    <CreditCard className="h-4 w-4" />
                  </span>
                  <h2 className="text-lg font-bold text-foreground">
                    {en ? "Select Payment Method" : "Pilih Metode Pembayaran"}
                  </h2>
                </div>

                {errorMsg && (
                  <div className="mb-6 rounded-lg bg-red-50 p-4 text-center text-sm text-red-600">
                    {errorMsg}
                  </div>
                )}

                {paymentMethods.length === 0 ? (
                  <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-xl bg-muted/20">
                    {en ? "Loading payment options..." : "Memuat pilihan pembayaran..."}
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {paymentMethods.map((method) => {
                      const isActive =
                        confirmationData?.id === method.id || selectedMethod?.id === method.id;
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => handleMethodSelect(method)}
                          disabled={loading || !selectedPlan}
                          className={cn(
                            "relative flex w-full items-center rounded-xl border-2 p-4 transition-all",
                            !isActive &&
                              !loading &&
                              "border-transparent bg-white shadow-sm hover:border-blue-300",
                            isActive && "border-blue-600 bg-blue-50/40 shadow-md",
                            (loading || !selectedPlan) && "cursor-not-allowed opacity-50",
                          )}
                        >
                          {isActive && (
                            <div className="absolute -right-2 -top-3 rounded-full bg-white z-10">
                              <CheckCircle2 className="h-6 w-6 text-blue-600" />
                            </div>
                          )}
                          <div className="mr-4 flex h-10 w-16 items-center justify-center rounded-lg border bg-white p-1 shadow-sm">
                            {method.logo ? (
                              <img
                                src={method.logo}
                                alt={method.name}
                                className="max-h-full object-contain"
                              />
                            ) : (
                              <CreditCard className="h-5 w-5 text-gray-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <h3 className="truncate text-sm font-bold text-gray-900">
                              {method.name}
                            </h3>
                            <div className="mt-0.5 flex items-center">
                              <Tag className="mr-1 h-3 w-3 text-gray-400" />
                              <p className="text-[11px] text-gray-500">
                                {method.type === "QR"
                                  ? en
                                    ? "Instant QR Scan"
                                    : "Scan QRIS Otomatis"
                                  : "Virtual Account"}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column (Summary & Confirmation) */}
          <div className="space-y-6">
            <div className="lg:sticky lg:top-24">
              <OrderSummaryCard
                selectedPlan={selectedPlan}
                showDetail={showDetail}
                setShowDetail={setShowDetail}
                paymentData={paymentData}
                confirmationData={confirmationData}
                promoData={promoData}
                en={en}
                parseFeatures={parseFeatures}
              />
              {selectedPlan && !selectedPlan.requires_approval && (
                <Card className="mb-6 rounded-[1.25rem] border border-border/60 bg-card/80 shadow-card backdrop-blur">
                  <CardContent className="p-5">
                    <Label
                      htmlFor="promo_code"
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {en ? "Promo Code" : "Kode Promo"}
                    </Label>
                    <div className="mt-2 flex gap-2">
                      <Input
                        id="promo_code"
                        value={promoCode}
                        onChange={(e) => {
                          setPromoCode(e.target.value.toUpperCase());
                          setPromoError("");
                          if (promoData) {
                            setPromoData(null);
                            setSelectedMethod(null);
                            setConfirmationData(null);
                            void fetchPaymentMethods(
                              selectedPlan.amount || selectedPlan.amount || 0,
                            );
                          }
                        }}
                        placeholder={en ? "Enter code" : "Masukkan kode"}
                        disabled={loading || promoLoading || confirmationData?.id === "free_trial"}
                        className="h-11 rounded-xl border-border/60 bg-background/70 uppercase"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleApplyPromo}
                        disabled={
                          !promoCode.trim() ||
                          !selectedPlan ||
                          loading ||
                          promoLoading ||
                          confirmationData?.id === "free_trial"
                        }
                        className="h-11 rounded-xl"
                      >
                        {promoLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : en ? (
                          "Apply"
                        ) : (
                          "Pakai"
                        )}
                      </Button>
                    </div>
                    {promoData?.discount_amount > 0 && (
                      <p className="mt-2 text-xs font-medium text-emerald-600">
                        {en ? "Discount applied:" : "Diskon diterapkan:"}{" "}
                        {formatCurrency(promoData.discount_amount)}
                      </p>
                    )}
                    {promoError && (
                      <p className="mt-2 text-xs font-medium text-red-500">{promoError}</p>
                    )}
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardContent>
                  <div className="col-span-full mt-4 flex items-start gap-2.5">
                    <input
                      id="declaration"
                      type="checkbox"
                      checked={declarationChecked}
                      onChange={(e) => setDeclarationChecked(e.target.checked)}
                      className="mt-1 h-4.5 w-4.5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label
                      htmlFor="declaration"
                      className="text-xs leading-relaxed font-normal text-muted-foreground cursor-pointer select-none"
                    >
                      Saya menyatakan bahwa seluruh data yang saya berikan adalah benar dan dapat
                      dipertanggungjawabkan. Saya memahami bahwa Guru2Digit berhak melakukan
                      verifikasi terhadap data yang diberikan.
                    </Label>
                  </div>
                </CardContent>
              </Card>
              <Button
                onClick={() => setConfirmationData({ ...confirmationData, isModalOpen: true })}
                className="mt-4 w-full h-14 rounded-2xl font-bold bg-gradient-to-r from-primary via-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-200 transition-all hover:scale-[1.01] hover:shadow-xl hover:shadow-indigo-300 disabled:opacity-50"
                disabled={
                  !confirmationData ||
                  loading ||
                  !!emailError ||
                  isValidatingEmail ||
                  !!usernameError ||
                  isValidatingUsername
                }
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="mr-2 h-4 w-4" />
                )}
                {en ? "Initiate Payment" : "Bayar Sekarang"}
              </Button>
            </div>
          </div>
        </div>

        {/* Confirmation Modal */}
        {confirmationData?.isModalOpen && selectedPlan && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
            <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
              <h3 className="mb-4 font-bold text-gray-900 text-lg">
                {en ? "Billing Confirmation" : "Rincian Pembayaran"}
              </h3>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>{en ? "Selected Access" : "Akses Jenjang"}</span>
                  <span className="font-semibold text-gray-900 capitalize">
                    {selectedPlan.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{en ? "Billing Type" : "Tipe Tagihan"}</span>
                  <span className="font-semibold text-gray-900">
                    {confirmationData.id === "free_trial"
                      ? en
                        ? "7-Day Free Trial"
                        : "Coba Gratis 7 Hari"
                      : en
                        ? "Monthly Subscription"
                        : "Berlangganan Bulanan"}
                  </span>
                </div>
                <div className="my-2 border-t" />
                <div className="flex justify-between">
                  <span>{en ? "Plan Price" : "Harga Paket"}</span>
                  <span>
                    {confirmationData.id === "free_trial"
                      ? en
                        ? "Free"
                        : "Gratis"
                      : formatCurrency(selectedPlan.amount || selectedPlan.amount)}
                  </span>
                </div>
                {confirmationData.id !== "free_trial" && (
                  <>
                    {promoData?.discount_amount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>{en ? "Promo Discount" : "Diskon Promo"}</span>
                        <span>-{formatCurrency(promoData.discount_amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>{en ? "Service Fee" : "Biaya Layanan"}</span>
                      <span>{formatCurrency(confirmationData.handling_fee || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{en ? "Admin Fee" : "Biaya Admin"}</span>
                      <span>{formatCurrency(confirmationData.admin_fee || 0)}</span>
                    </div>
                  </>
                )}
                <div className="my-2 border-t" />
                <div className="flex justify-between text-lg font-bold">
                  <span>{en ? "Total Payment" : "Total Bayar"}</span>
                  <span className="text-blue-600">
                    {confirmationData.id === "free_trial"
                      ? en
                        ? "Free"
                        : "Gratis"
                      : formatCurrency(
                          confirmationData.total_amount ||
                            Math.max(
                              0,
                              (selectedPlan.amount || selectedPlan.amount || 0) -
                                (promoData?.discount_amount || 0),
                            ),
                        )}
                  </span>
                </div>
              </div>
              <div className="mt-6 flex w-full gap-3">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => setConfirmationData(null)}
                >
                  {en ? "Cancel" : "Batal"}
                </Button>
                <Button
                  className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleConfirmPayment}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {en ? "Confirm & Pay" : "Bayar Sekarang"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
      <PaymentFooter />
    </SiteLayout>
  );
}
