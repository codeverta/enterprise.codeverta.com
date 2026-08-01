import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import dayjs from "dayjs";
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
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import DashboardLayout from "@/layout/DashboardLayout";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import PaymentFooter from "./PaymentFooter";
import PaymentError from "./PaymentError";
import PaymentExpired from "./PaymentExpired";
import PaymentPaid from "./PaymentPaid";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { User, Info } from "lucide-react";
import { getPlanSelectionState, subscriptionAmount } from "./plan-selection";


function PlanCard({ plan, onSelect, disabled, actionLabel = "Pilih Paket", popular }) {
  const features = parseFeatures(plan.features);
  return (
    <Card
      className={cn(
        "relative flex flex-col transition-all hover:-translate-y-0.5 hover:shadow-md",
        popular && "border-blue-500 shadow-sm",
        disabled && "opacity-60 hover:translate-y-0 hover:shadow-none"
      )}
    >
      {/*{popular && (
        <Badge className="absolute -top-2.5 left-4 bg-blue-600 hover:bg-blue-600">
          Paling Populer
        </Badge>
      )}*/}
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-wide text-gray-500">
          {plan.name}
        </CardTitle>
        <div className="pt-2 text-2xl md:text-3xl font-extrabold text-gray-900">
          {formatCurrency(plan.amount)}
          <span className="ml-1 text-xs font-normal text-gray-500">
            / {plan.interval || "month"}
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-2">
        {features.map((feature) => (
          <div key={feature.feature_key} className="flex items-start gap-2 text-sm text-gray-600">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <span>{feature.feature_key}</span>
          </div>
        ))}
      </CardContent>

      <CardFooter>
        <Button
          className="w-full"
          disabled={disabled}
          onClick={() => onSelect(plan)}
        >
          {actionLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}


const getResponseData = (r) => r.data?.data || r.data || [];

const parseFeatures = (features) => {
  if (!features) return [];
  if (Array.isArray(features)) return features;
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

const normalizePaymentStatus = (status) => String(status || "").toUpperCase();

function SubscriptionPaymentPage() {
  const { t, language } = useLanguage();
  useEffect(() => {
    dayjs.locale(language);
  }, [language]);

  const [searchParams, setSearchParams] = useSearchParams();
  const planId = searchParams.get("plan_id") || "";
  const paymentId = searchParams.get("payment_id") || "";
  const studentIdFromUrl = searchParams.get("student_id") || "";
  const pollingRef = useRef(null);
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);
  const isParentMode = Number(currentUser?.role || 0) === 10;

  const [initLoading, setInitLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [children, setChildren] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(planId);
  const [selectedStudentId, setSelectedStudentId] = useState(studentIdFromUrl);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [confirmationData, setConfirmationData] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("IDLE");
  const [errorMsg, setErrorMsg] = useState("");
  const [showDetail, setShowDetail] = useState(true);
  const isPaymentStep = ((searchParams.get("step") === "payment" && !!selectedPlanId) || !!paymentId || paymentStatus === "PENDING");

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) || null,
    [plans, selectedPlanId]
  );
  const selectedChild = useMemo(
    () => children.find((child) => child.id === selectedStudentId) || null,
    [children, selectedStudentId]
  );

  const parentPlans = useMemo(() => {
    return plans.filter((plan: any) => plan.pricing_category?.checkout_type === "parent" || plan.pricing_category?.slug === "parent-system");
  }, [plans]);

  const studentPlans = useMemo(() => {
    return plans.filter((plan: any) => plan.pricing_category?.checkout_type !== "parent" && plan.pricing_category?.slug !== "parent-system" && plan.pricing_category?.checkout_type !== "teacher");
  }, [plans]);

  const parentSubscriptions = useMemo(() => {
    return subscriptions.filter((item: any) => {
      const plan = item.plan || {};
      return plan.pricing_category?.checkout_type === "parent" || plan.pricing_category?.slug === "parent-system";
    });
  }, [subscriptions]);

  const activeParentSubscriptionItem = useMemo(
    () => parentSubscriptions.find((item: any) => item.is_active && (item.subscription || item)?.course_id == null) || null,
    [parentSubscriptions]
  );

  const getChildSubscriptionItem = (childId) =>
    subscriptions.find((item) => {
      const subscription = item.subscription || item;
      return subscription.student_id === childId && subscription.course_id == null;
    }) || null;

  const activeChildSubscriptionItem = useMemo(() => {
    if (!selectedStudentId) return null;
    const item = getChildSubscriptionItem(selectedStudentId);
    return item?.is_active ? item : null;
  }, [subscriptions, selectedStudentId]);

  const activeOwnSubscriptionItem = useMemo(
    () => subscriptions.find((item) => item.is_active && (item.subscription || item)?.course_id == null) || null,
    [subscriptions]
  );

  const selectedPlanIsParent = Boolean(
    selectedPlan?.pricing_category?.checkout_type === "parent" || selectedPlan?.pricing_category?.slug === "parent-system"
  );
  const activeSubscriptionItem = useMemo(
    () => {
      if (isParentMode) {
        return selectedPlanIsParent ? activeParentSubscriptionItem : activeChildSubscriptionItem;
      }
      return activeOwnSubscriptionItem;
    },
    [isParentMode, selectedPlanIsParent, activeParentSubscriptionItem, activeChildSubscriptionItem, activeOwnSubscriptionItem]
  );
  const selectedPlanChangeType = useMemo(() => {
    const subscription = activeSubscriptionItem?.subscription;
    if (!selectedPlan || !subscription) return "new";
    const currentAmount = subscriptionAmount(activeSubscriptionItem);
    const nextAmount = Number(selectedPlan.amount || 0);
    if (subscription.provider_plan_id === selectedPlan.id || currentAmount === nextAmount) return "renewal";
    return currentAmount !== null && nextAmount > currentAmount ? "upgrade" : "downgrade";
  }, [activeSubscriptionItem, selectedPlan]);
  const estimatedChargeAmount = useMemo(() => {
    const subscription = activeSubscriptionItem?.subscription;
    if (!selectedPlan || !subscription || selectedPlanChangeType !== "upgrade") return selectedPlan?.amount || 0;
    const start = subscription.current_period_start ? dayjs(subscription.current_period_start) : null;
    const end = subscription.current_period_end ? dayjs(subscription.current_period_end) : null;
    if (!start || !end || !end.isAfter(dayjs())) return selectedPlan.amount || 0;
    const totalMs = end.diff(start);
    const remainingMs = end.diff(dayjs());
    if (totalMs <= 0 || remainingMs <= 0) return selectedPlan.amount || 0;
    const credit = Number(subscription.amount || 0) * (remainingMs / totalMs);
    return Math.max(0, Math.ceil(Number(selectedPlan.amount || 0) - credit));
  }, [activeSubscriptionItem, selectedPlan, selectedPlanChangeType]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedPlan?.amount !== undefined) {
      fetchPaymentMethods(estimatedChargeAmount || selectedPlan.amount);
    }
  }, [selectedPlan?.id, estimatedChargeAmount]);

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
          fetchMySubscriptions();
          toast.success("Pembayaran berhasil, subscription aktif.");
        } else if (["EXPIRED", "FAILED"].includes(nextStatus)) {
          clearInterval(pollingRef.current);
        }
      } catch {
        // keep polling quiet
      }
    };

    checkStatus();
    pollingRef.current = setInterval(checkStatus, 5000);
    return () => clearInterval(pollingRef.current);
  }, [paymentData?.transaction_id, paymentId, paymentStatus]);

  const fetchInitialData = async () => {
    setInitLoading(true);
    try {
      const plansRes = await api.get("/subscription-plans");
      const allPlans = getResponseData(plansRes);
      const nextPlans = allPlans.filter((plan: any) => plan.pricing_category?.checkout_type !== "teacher");
      setPlans(nextPlans);
      if (isParentMode) {
        await fetchChildren();
      }
      await fetchMySubscriptions();

      const initialPlan = nextPlans.find((plan) => plan.id === planId) || null;
      if (initialPlan) {
        setSelectedPlanId(initialPlan.id);
        await fetchPaymentMethods(initialPlan.amount);
      }

      if (paymentId) {
        await loadPayment(paymentId);
      }
    } catch (err) {
      setPaymentStatus("ERROR");
      setErrorMsg(err.response?.data?.message || "Gagal memuat data pembayaran.");
    } finally {
      setInitLoading(false);
    }
  };

  const fetchPaymentMethods = async (amount) => {
    const response = await api.get("/payment-methods", { params: { amount } });
    setPaymentMethods(getResponseData(response));
  };

  const fetchMySubscriptions = async () => {
    const response = await api.get("/lms/my-subscriptions");
    const payload = response.data?.data || response.data || {};
    setSubscriptions(payload.subscriptions || []);
  };

  const fetchChildren = async () => {
    const response = await api.get("/lms/parent/students");
    const payload = getResponseData(response);
    const nextChildren = Array.isArray(payload) ? payload : payload.students || [];
    setChildren(nextChildren);
    if (!selectedStudentId && nextChildren.length === 1) {
      setSelectedStudentId(nextChildren[0].id);
    }
  };

  const loadPayment = async (id) => {
    const response = await api.get(`/lms/subscription-payments/${id}`);
    const payload = response.data?.data || response.data;
    const payment = payload.payment || payload;
    const nextData = payload.payment_data || null;
    setPaymentData(nextData);
    setPaymentStatus(normalizePaymentStatus(payment.status));
    if (payment.student_id) {
      setSelectedStudentId(payment.student_id);
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
  };

  const choosePlan = (plan) => {
    const isParentPlan = plan.pricing_category?.checkout_type === "parent" || plan.pricing_category?.slug === "parent-system";
    const currentSubscription = isParentMode
      ? (isParentPlan ? activeParentSubscriptionItem : activeChildSubscriptionItem)
      : activeOwnSubscriptionItem;
    const selection = getPlanSelectionState(plan, currentSubscription, {
      requiresStudent: isParentMode && !isParentPlan,
      hasSelectedStudent: Boolean(selectedStudentId),
    });
    if (selection.disabled) {
      toast.error(selection.reason === "lower_price" ? "Paket yang lebih murah tidak dapat dipilih." : "Pilih anak terlebih dahulu.");
      return;
    }
    setSelectedPlanId(plan.id);
    setSelectedMethod(null);
    setConfirmationData(null);
    setPaymentData(null);
    setPaymentStatus("IDLE");
    const currentTab = searchParams.get("tab");
    const params = { plan_id: plan.id, step: "payment" } as Record<string, string>;
    if (currentTab) params.tab = currentTab;
    if (isParentMode && !isParentPlan && selectedStudentId) {
      params.student_id = selectedStudentId;
    }
    setSearchParams(params);
  };

  const chooseChildPlan = (childId, plan = null) => {
    setSelectedStudentId(childId);
    setSelectedMethod(null);
    setConfirmationData(null);
    setPaymentData(null);
    setPaymentStatus("IDLE");
    const currentTab = searchParams.get("tab");
    if (plan) {
      setSelectedPlanId(plan.id);
      const params: Record<string, string> = { plan_id: plan.id, step: "payment", student_id: childId };
      if (currentTab) params.tab = currentTab;
      setSearchParams(params);
    } else {
      setSelectedPlanId("");
      const params: Record<string, string> = { student_id: childId };
      if (currentTab) params.tab = currentTab;
      setSearchParams(params);
    }
  };

  const continuePendingPayment = (childId, payment) => {
    setSelectedStudentId(childId);
    setPaymentStatus("PENDING");
    const currentTab = searchParams.get("tab");
    const params: Record<string, string> = { payment_id: payment.id, student_id: childId };
    if (currentTab) params.tab = currentTab;
    setSearchParams(params);
    loadPayment(payment.id);
  };

  const backToPlans = () => {
    setSelectedMethod(null);
    setConfirmationData(null);
    setPaymentData(null);
    setPaymentStatus("IDLE");
    const currentTab = searchParams.get("tab");
    setSearchParams(currentTab === "parent" ? { tab: "parent" } : {});
    fetchMySubscriptions();
  };

  const handleMethodSelect = (method) => {
    setSelectedMethod(method);
    setConfirmationData({ ...method, isModalOpen: false });
  };

  const handleConfirmPayment = async () => {
    if (!selectedPlan || (!confirmationData && selectedPlanChangeType !== "downgrade")) return;
    setConfirmationData(null);
    setLoading(true);
    setErrorMsg("");

    try {
      const isParentPlan = selectedPlan?.pricing_category?.checkout_type === "parent" || selectedPlan?.pricing_category?.slug === "parent-system";
      const response = await api.post("/lms/subscription-checkout", {
        pricing_id: selectedPlan.id,
        payment_method: confirmationData?.id,
        ...(isParentMode && !isParentPlan && selectedStudentId ? { student_id: selectedStudentId } : {}),
      });
      const payload = response.data?.data || response.data;
      if (payload.requires_payment === false) {
        toast.success(payload.change_type === "downgrade_scheduled" ? "Downgrade dijadwalkan setelah periode aktif selesai." : "Subscription berhasil diperbarui.");
        backToPlans();
        return;
      }
      setPaymentData(payload.payment_data);
      setPaymentStatus("PENDING");
      setShowDetail(false);
      setSelectedMethod(confirmationData);
      if (payload.payment?.id) {
        const params = { plan_id: selectedPlan.id, payment_id: payload.payment.id } as Record<string, string>;
        if (isParentMode && !isParentPlan && selectedStudentId) params.student_id = selectedStudentId;
        setSearchParams(params);
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
    try {
      const response = await api.get(`/lms/subscription-payments/${paymentId}`);
      const payload = response.data?.data || response.data;
      const payment = payload.payment || payload;
      const nextStatus = normalizePaymentStatus(payment.status);
      setPaymentData(payload.payment_data || paymentData);
      setPaymentStatus(nextStatus || paymentStatus);
      if (nextStatus === "PAID") {
        await fetchMySubscriptions();
        toast.success("Pembayaran berhasil, subscription aktif.");
      } else {
        toast.info("Status pembayaran diperbarui.");
      }
    } catch {
      toast.error("Gagal cek status pembayaran.");
    }
  };

  const copyToClipboard = (text, isVA = true) => {
    navigator.clipboard.writeText(text);
    toast(isVA ? "Nomor Virtual Account disalin!" : "ID Transaksi disalin!", {
      icon: <Copy className="w-5 h-5 text-gray-100" />,
    });
  };

  const OrderSummaryCard = () => {
    if (!selectedPlan) return null;
    const features = parseFeatures(selectedPlan.features);
    const planAmount = Number(paymentData?.plan_amount || selectedPlan.amount || 0);
    const chargeAmount = Number(paymentData?.charge_amount || paymentData?.final_amount || estimatedChargeAmount || selectedPlan.amount || 0);
    const prorationCredit = paymentData?.credit_amount !== undefined
      ? Number(paymentData.credit_amount || 0)
      : selectedPlanChangeType === "upgrade"
        ? Math.max(0, Number(selectedPlan.amount || 0) - Number(estimatedChargeAmount || 0))
        : 0;
    const total = paymentData
      ? (paymentData.total_amount || (chargeAmount + (paymentData.handling_fee || 0) + (paymentData.admin_fee || 0)))
      : selectedPlanChangeType === "downgrade"
        ? 0
        : confirmationData?.total_amount || estimatedChargeAmount || selectedPlan.amount;

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
            {isParentMode && (() => {
              const isParentPlan = selectedPlan?.pricing_category?.checkout_type === "parent" || selectedPlan?.pricing_category?.slug === "parent-system";
              if (!isParentPlan && !selectedChild) return null;
              return (
                <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-blue-500">
                    Subscription untuk
                  </p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {isParentPlan ? (currentUser.display_name || currentUser.username || "Merchant") : selectedChild?.full_name}
                  </p>
                  {(isParentPlan ? currentUser.email : selectedChild?.email) && (
                    <p className="text-xs text-gray-500">
                      {isParentPlan ? currentUser.email : selectedChild?.email}
                    </p>
                  )}
                </div>
              );
            })()}
            <div className="mb-4 flex items-center justify-between border-b pb-2 text-xs">
              <span>Paket</span>
              <span className="font-semibold capitalize">
                {selectedPlan.name}
              </span>
            </div>
            <div className="space-y-2">
              {features.length
                ? features.map((feature) => (
                    <div
                      key={feature.feature_key}
                      className="flex items-start gap-2 text-sm text-gray-600"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                      <span>{feature.feature_key}</span>
                    </div>
                  ))
                : null}
            </div>

            <div className="mt-4 border-t border-dashed pt-3">
              <div className="flex justify-between text-sm">
                <span>Harga Paket</span>
                <span>{formatCurrency(planAmount)}</span>
              </div>
              {prorationCredit > 0 && (
                <div className="flex justify-between text-sm text-emerald-700">
                  <span>Kredit Sisa Paket</span>
                  <span>-{formatCurrency(prorationCredit)}</span>
                </div>
              )}
              {selectedPlanChangeType === "downgrade" && (
                <div className="flex justify-between text-sm text-amber-700">
                  <span>Tagihan sekarang</span>
                  <span>{formatCurrency(0)}</span>
                </div>
              )}
              {(paymentData?.handling_fee || confirmationData?.handling_fee) >
                0 && (
                <div className="flex justify-between text-sm">
                  <span>Biaya Layanan</span>
                  <span>
                    {formatCurrency(
                      paymentData?.handling_fee ||
                        confirmationData?.handling_fee
                    )}
                  </span>
                </div>
              )}
              {(paymentData?.admin_fee || confirmationData?.admin_fee) > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Biaya Admin</span>
                  <span>
                    {formatCurrency(
                      paymentData?.admin_fee || confirmationData?.admin_fee
                    )}
                  </span>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-bold">Total Pembayaran</span>
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

  const ParentChildrenPanel = () => {
    if (!children.length) {
      return (
        <div className="mb-8 rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center shadow-sm">
          <Users className="mx-auto h-9 w-9 text-gray-300" />
          <h2 className="mt-4 text-lg font-bold text-gray-900">
            You don't have any children linked to your account yet.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
            Hubungkan akun anak terlebih dahulu sebelum membeli subscription.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/dashboard/akun-anak">
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Link Child Account
              </Button>
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="mb-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="mt-1 text-xl font-bold text-gray-900">Pilih anak yang akan berlangganan</h2>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {children.map((child) => {
            const item = getChildSubscriptionItem(child.id);
            const subscription = item?.subscription;
            const plan = item?.plan || {};
            const pendingPayment = item?.pending_payment;
            const isActive = Boolean(item?.is_active);
            const periodStart = subscription?.current_period_start;
            const periodEnd = subscription?.current_period_end;
            const isSelected = selectedStudentId === child.id;

            return (
              <div
                key={child.id}
                className={cn(
                  "rounded-2xl border bg-white p-5 shadow-sm transition",
                  isSelected ? "border-blue-500 ring-2 ring-blue-100" : "border-gray-200"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-bold text-gray-900">{child.full_name}</h3>
                    <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                      <Mail className="h-3.5 w-3.5" />
                      <span className="truncate">{child.email || "Email belum tersedia"}</span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                      isActive ? "bg-emerald-100 text-emerald-700" : pendingPayment ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                    )}
                  >
                    {isActive ? "Aktif" : pendingPayment ? "Pending" : subscription ? String(subscription.status || "expired").replaceAll("_", " ") : "Belum aktif"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 rounded-xl bg-gray-50 p-4 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">Paket</span>
                    <span className="text-right font-semibold text-gray-900">{plan.name || "-"}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">Mulai</span>
                    <span className="text-right">{periodStart ? dayjs(periodStart).format("DD MMM YYYY") : "-"}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">Berakhir</span>
                    <span className="text-right">{periodEnd ? dayjs(periodEnd).format("DD MMM YYYY") : "-"}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">Sisa hari</span>
                    <span className="text-right">{isActive ? `${item?.days_remaining ?? 0} hari` : "-"}</span>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  {pendingPayment ? (
                    <Button className="flex-1" onClick={() => continuePendingPayment(child.id, pendingPayment)}>
                      Continue Payment
                    </Button>
                  ) : (
                    <Button className="flex-1" onClick={() => chooseChildPlan(child.id)}>
                      {isActive || subscription ? "Renew Subscription" : "Buy Subscription"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const ParentSubscriptionStatusPanel = () => {
    if (!parentSubscriptions.length) {
      return (
        <div className="mb-8 rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          Kamu belum punya subscription merchant aktif. Pilih paket di bawah untuk mulai berlangganan.
        </div>
      );
    }

    return (
      <div className="my-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="mt-1 text-lg font-bold text-gray-900">Status subscription saat ini</h2>
          </div>
          <CalendarDays className="h-5 w-5 text-gray-400" />
        </div>

        <div className="grid gap-3">
          {parentSubscriptions.map((item) => {
            const subscription = item.subscription || item;
            const plan = item.plan || {};
            const periodEnd = subscription.current_period_end;
            const isActive = Boolean(item.is_active);
            const statusLabel = isActive ? "Aktif" : String(subscription.status || "Tidak aktif").replaceAll("_", " ");

            return (
              <div key={subscription.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900">{plan.name || "Paket Langganan"}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatCurrency(subscription.amount || plan.amount || 0)} / {subscription.interval || plan.interval || "month"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                      isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"
                    )}
                  >
                    {statusLabel}
                  </span>
                </div>

                <div className="mt-4 rounded-lg bg-white p-3 text-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Aktif sampai</p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {periodEnd ? `${dayjs(periodEnd).format("DD MMM YYYY, HH:mm")} WIB` : "Tanpa batas akhir"}
                  </p>
                  {periodEnd && (
                    <p className="mt-1 text-xs text-gray-500">
                      {isActive ? `Sisa ${item.days_remaining ?? 0} hari` : "Masa langganan sudah berakhir"}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const SubscriptionStatusPanel = () => {
    if (!subscriptions.length) {
      return (
        <div className="mb-8 rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          Kamu belum punya subscription aktif. Pilih paket di bawah untuk mulai langganan.
        </div>
      );
    }

    return (
      <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Langganan Saya</p>
            <h2 className="mt-1 text-lg font-bold text-gray-900">Status subscription saat ini</h2>
          </div>
          <CalendarDays className="h-5 w-5 text-gray-400" />
        </div>

        <div className="grid gap-3 md:grid-cols-1">
          {subscriptions.map((item) => {
            const subscription = item.subscription || item;
            const plan = item.plan || {};
            const pendingPlan = item.pending_plan || {};
            const periodEnd = subscription.current_period_end;
            const isActive = Boolean(item.is_active);
            const statusLabel = isActive ? "Aktif" : String(subscription.status || "Tidak aktif").replaceAll("_", " ");

            return (
              <div key={subscription.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900">{plan.name || "Paket Langganan"}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatCurrency(subscription.amount || plan.amount || 0)} / {subscription.interval || plan.interval || "month"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                      isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"
                    )}
                  >
                    {statusLabel}
                  </span>
                </div>
                <div className="mt-4 rounded-lg bg-white p-3 text-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Aktif sampai</p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {periodEnd ? `${dayjs(periodEnd).format("DD MMM YYYY, HH:mm")} WIB` : "Tanpa batas akhir"}
                  </p>
                  {periodEnd && (
                    <p className="mt-1 text-xs text-gray-500">
                      {isActive ? `Sisa ${item.days_remaining ?? 0} hari` : "Masa langganan sudah berakhir"}
                    </p>
                  )}
                  {subscription.pending_change_type === "downgrade" && (
                    <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                      Akan downgrade ke {pendingPlan.name || "paket baru"} pada {dayjs(subscription.pending_change_at || periodEnd).format("DD MMM YYYY, HH:mm")} WIB
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
      <div>
        <PaymentPaid paymentData={paymentData} onViewSubscriptions={backToPlans} />
      </div>
    );
  }
  if (paymentStatus === "ERROR") return <PaymentError paymentStatus="ERROR" errorMsg={errorMsg} />;
  if (paymentStatus === "EXPIRED") return <PaymentExpired paymentStatus="EXPIRED" errorMsg={errorMsg} />;

    if (!isPaymentStep) {
      return (
        <div className="min-h-screen bg-gray-50 px-4 py-12">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 text-center">
              <h1 className="mt-3 text-3xl font-bold text-gray-900 md:text-4xl">
                {isParentMode
                  ? t("payments.title.parent")
                  : t("payments.title.student")}
              </h1>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-gray-500">
                {isParentMode
                  ? t("payments.subtitle.parent")
                  : t("payments.subtitle.student")}
              </p>
            </div>

            {errorMsg && (
              <div className="mb-6 rounded-lg bg-red-50 p-4 text-center text-sm text-red-600">
                {errorMsg}
              </div>
            )}

            {isParentMode ? (
              null
            ) : (
              <SubscriptionStatusPanel />
            )}

            {plans.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-gray-500">
                Belum ada paket aktif. Admin bisa membuat paket di menu
                Langganan & Transaksi.
              </div>
            ) : (
              <>
                {isParentMode ? (
                    <Tabs
                      value={searchParams.get("tab") === "parent" ? "parent" : "student"}
                      onValueChange={(val) => {
                        const newParams = new URLSearchParams(searchParams);
                        if (val === "parent") {
                          newParams.set("tab", "parent");
                        } else {
                          newParams.delete("tab");
                        }
                        setSearchParams(newParams);
                      }}
                      className="w-full"
                    >
                      <TabsList className="grid mx-auto w-full grid-cols-2 sm:w-[400px]">
                        <TabsTrigger value="student" className="gap-2">
                          <Users className="h-4 w-4" /> Paket Anak
                        </TabsTrigger>
                        <TabsTrigger value="parent" className="gap-2">
                          <User className="h-4 w-4" /> Paket Saya
                        </TabsTrigger>
                      </TabsList>

                    {/* TAB 1: STUDENT SUBSCRIPTION */}
                    <TabsContent value="student" className="space-y-6 animate-in fade-in duration-300">
                      <ParentChildrenPanel />

                      {children.length > 0 && !selectedStudentId ? (
                        <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-gray-500">
                          Pilih salah satu anak di atas untuk melihat paket subscription.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {selectedChild && (
                            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                              Paket berikut akan dibeli untuk{" "}
                              <span className="font-bold">{selectedChild.full_name}</span>.
                            </div>
                          )}

                          {studentPlans.length === 0 ? (
                            <div className="rounded-xl border border-dashed bg-white p-6 text-center text-sm text-gray-500">
                              Tidak ada paket belajar anak yang aktif saat ini.
                            </div>
                          ) : (
                            <div className="grid gap-4 lg:grid-cols-3 sm:grid-cols-2 grid-cols-1">
                              {studentPlans.map((plan) => {
                                const selection = getPlanSelectionState(plan, activeChildSubscriptionItem, {
                                  requiresStudent: true,
                                  hasSelectedStudent: Boolean(selectedStudentId),
                                });
                                return (
                                  <PlanCard
                                    key={plan.id}
                                    plan={plan}
                                    onSelect={choosePlan}
                                    disabled={selection.disabled}
                                    actionLabel={selection.label}
                                    popular={plan.slug?.includes("financial") || plan.amount >= 300000}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </TabsContent>

                    {/* TAB 2: PARENT SUBSCRIPTION */}
                    <TabsContent value="parent" className="space-y-6 animate-in fade-in duration-300">
                      <ParentSubscriptionStatusPanel />

                      <div className="space-y-4">
                        <div className="border-b pb-2">
                          <h3 className="text-lg font-bold text-gray-900">Paket Langganan Merchant</h3>
                          <p className="text-sm text-gray-500">Pilih paket untuk mengaktifkan fitur parent.</p>
                        </div>

                        {parentPlans.length === 0 ? (
                          <div className="rounded-xl border border-dashed bg-white p-6 text-center text-sm text-gray-500">
                            Tidak ada paket merchant yang aktif saat ini.
                          </div>
                        ) : (
                          <div className="grid gap-4 lg:grid-cols-3 sm:grid-cols-2 grid-cols-1">
                            {parentPlans.map((plan) => {
                              const selection = getPlanSelectionState(plan, activeParentSubscriptionItem);
                              return (
                                <PlanCard
                                  key={plan.id}
                                  plan={plan}
                                  onSelect={choosePlan}
                                  disabled={selection.disabled}
                                  actionLabel={selection.label}
                                  popular={plan.slug?.includes("business") || plan.slug?.includes("ai")}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <>
                    <div className="grid gap-4 lg:grid-cols-3 sm:grid-cols-2 grid-cols-1">
                      {plans.map((plan) => {
                        const selection = getPlanSelectionState(plan, activeOwnSubscriptionItem);
                        return (
                          <PlanCard
                            key={plan.id}
                            plan={plan}
                            onSelect={choosePlan}
                            disabled={selection.disabled}
                            actionLabel={selection.label}
                            popular={plan.slug?.includes("business") || plan.slug?.includes("financial") || plan.amount >= 300000}
                          />
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
          <PaymentFooter />
        </div>
      );
    }

  if (paymentStatus === "PENDING" && paymentData) {
    return (
      <div className="flex min-h-screen flex-col items-center bg-gray-50 px-4 py-10">
        <div className="w-full max-w-lg">
          <OrderSummaryCard />

          <div className="animate-in slide-in-from-bottom-4 overflow-hidden rounded-2xl bg-white shadow-xl duration-500">
            <div className="bg-slate-900 p-6 text-center text-white">
              <p className="text-sm font-medium opacity-80">Selesaikan Pembayaran</p>
              {isParentMode && selectedChild && (
                <p className="mt-1 text-xs opacity-70">Untuk {selectedChild.full_name}</p>
              )}
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
                    <img src={paymentData.qr_code_base64} alt="QR Code Payment" className="h-56 w-56 object-contain" />
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
                      <p className="font-mono text-2xl font-bold tracking-wider text-gray-800">{paymentData.payment_number}</p>
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
                <Button variant="outline" className="mt-4 w-full" onClick={refreshPaymentStatus}>
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

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-2 text-center text-2xl font-bold text-gray-900 md:text-3xl">{t("payments.select_payment")}</h1>
        <p className="mb-8 text-center text-sm text-gray-500">
          {isParentMode && selectedChild
            ? `Pilih metode pembayaran untuk subscription ${selectedChild.full_name}.`
            : "Pilih paket dan metode pembayaran Codeverta."}
        </p>
        <Button variant="outline" className="mb-6 w-full" onClick={backToPlans}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {isParentMode ? "Kembali ke Daftar Subscription" : "Ganti Paket Langganan"}
        </Button>

        {errorMsg && <div className="mb-6 rounded-lg bg-red-50 p-4 text-center text-sm text-red-600">{errorMsg}</div>}

        <OrderSummaryCard />

        {selectedPlanChangeType === "downgrade" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            Paket saat ini tetap aktif sampai {dayjs(activeSubscriptionItem?.subscription?.current_period_end).format("DD MMM YYYY, HH:mm")} WIB.
            Setelah itu sistem akan otomatis memindahkan subscription ke paket {selectedPlan?.name}.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {paymentMethods.map((method) => {
              const isActive = confirmationData?.id === method.id || selectedMethod?.id === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => handleMethodSelect(method)}
                  disabled={loading || !selectedPlan}
                  className={cn(
                    "relative flex w-full items-center rounded-xl border-2 p-4 transition-all",
                    !isActive && !loading && "border-transparent bg-white shadow-sm hover:border-blue-300",
                    isActive && "border-blue-600 bg-blue-50/40 shadow-md",
                    (loading || !selectedPlan) && "cursor-not-allowed opacity-50"
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
                      <p className="text-[11px] text-gray-500">{method.type === "QR" ? "Scan Otomatis" : "Virtual Account"}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <Button
          onClick={() => selectedPlanChangeType === "downgrade" ? handleConfirmPayment() : setConfirmationData({ ...confirmationData, isModalOpen: true })}
          className="mt-8 w-full"
          disabled={(selectedPlanChangeType !== "downgrade" && !confirmationData) || loading}
        >
          {selectedPlanChangeType === "downgrade"
            ? "Downgrade Langganan"
            : selectedPlanChangeType === "renewal"
              ? "Perpanjang Paket"
              : "Checkout"}
        </Button>

        {confirmationData?.isModalOpen && selectedPlan && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
            <div className="relative w-full max-w-md rounded-2xl bg-white p-6">
              <h3 className="mb-4 font-bold text-gray-900">Rincian Pembayaran</h3>
              <div className="space-y-3 text-sm text-gray-500">
                <div className="flex justify-between">
                  <span>Harga Paket</span>
                  <span>{formatCurrency(selectedPlan.amount)}</span>
                </div>
                {selectedPlanChangeType === "upgrade" && selectedPlan.amount > estimatedChargeAmount && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Kredit Sisa Paket</span>
                    <span>-{formatCurrency(selectedPlan.amount - estimatedChargeAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Biaya Layanan</span>
                  <span>{formatCurrency(confirmationData.handling_fee)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Biaya Admin</span>
                  <span>{formatCurrency(confirmationData.admin_fee)}</span>
                </div>
                <div className="my-2 border-t" />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Bayar</span>
                  <span className="text-blue-600">{formatCurrency(confirmationData.total_amount)}</span>
                </div>
              </div>
              <div className="mt-6 flex w-full gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmationData(null)}>
                  Batal
                </Button>
                <Button className="flex-1" onClick={handleConfirmPayment} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Bayar Sekarang
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

export default DashboardLayout(SubscriptionPaymentPage);
