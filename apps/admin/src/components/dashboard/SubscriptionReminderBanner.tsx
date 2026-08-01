import React, { useEffect, useState } from "react";
import { Link } from "react-router";
import api from "@/lib/api";
import { AlertCircle, AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uuid } from "@/lib/utils";


export default function SubscriptionReminderBanner() {
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const role = Number(currentUser?.role || 0);

  // Reminders only show for role 10 (Parent) and 20 (Student/Child)
  if (role !== 10 && role !== 20) {
    return null;
  }

  useEffect(() => {
    let active = true;

    async function checkSubscriptions() {
      try {
        const [subRes, childrenRes] = await Promise.all([
          api.get("/lms/my-subscriptions"),
          role === 10 ? api.get("/lms/parent/students") : Promise.resolve({ data: { data: [] } }),
        ]);

        if (!active) return;

        const payloadSubs = subRes.data?.data || subRes.data || {};
        const subs = payloadSubs.subscriptions || [];

        const payloadChildren = childrenRes.data?.data || childrenRes.data || [];
        const childrenList = Array.isArray(payloadChildren) ? payloadChildren : payloadChildren.students || [];

        const activeReminders: any[] = [];

        if (role === 10) {
          // Check Parent's own subscription
          const parentSub = subs.find((item: any) => {
            const plan = item.plan || {};
            return plan.pricing_category?.checkout_type === "parent" || plan.pricing_category?.slug === "parent-system";
          });

          if (parentSub) {
            const daysRemaining = parentSub.days_remaining != null ? Number(parentSub.days_remaining) : null;
            const isActive = Boolean(parentSub.is_active);

            if (!isActive) {
              activeReminders.push({
                type: "danger",
                title: "Langganan Orang Tua Berakhir",
                message: "Langganan membership Orang Tua Anda telah berakhir. Perbarui sekarang untuk mengaktifkan kembali fitur jualan materi dan course.",
              });
            } else if (daysRemaining !== null && daysRemaining <= 7) {
              activeReminders.push({
                type: "warning",
                title: "Langganan Orang Tua Hampir Berakhir",
                message: `Langganan membership Orang Tua Anda akan berakhir dalam ${daysRemaining} hari. Perbarui sekarang agar fitur jualan tetap aktif.`,
              });
            }
          }

          // Check children subscriptions
          childrenList.forEach((child: any) => {
            // Find subscription for this child
            const childSub = subs.find((item: any) => {
              const subObj = item.subscription || item;
              return subObj.student_id === child.id && subObj.course_id == null;
            });

            if (childSub) {
              const daysRemaining = childSub.days_remaining != null ? Number(childSub.days_remaining) : null;
              const isActive = Boolean(childSub.is_active);

              if (!isActive) {
                activeReminders.push({
                  type: "danger",
                  title: `Langganan Belajar Berakhir`,
                  message: `Masa aktif belajar anak Anda (${child.full_name}) telah berakhir. Perbarui paket agar ia tetap dapat belajar.`,
                });
              } 
              
              //  if (daysRemaining !== null && daysRemaining  7) {
              //   activeReminders.push({
              //     type: "warning",
              //     title: `Langganan Belajar Hampir Berakhir`,
              //     message: `Masa aktif belajar anak Anda (${child.full_name}) akan berakhir dalam ${daysRemaining} hari. Perbarui paket sekarang.`,
              //   });
              // }
            }
          });
        } else if (role === 20) {
          // Student subscription check
          const studentSub = subs.find((item: any) => {
            const subObj = item.subscription || item;
            return subObj.student_id === currentUser.id && subObj.course_id == null;
          });

          if (studentSub) {
            const daysRemaining = studentSub.days_remaining != null ? Number(studentSub.days_remaining) : null;
            const isActive = Boolean(studentSub.is_active);

            if (!isActive) {
              activeReminders.push({
                type: "danger",
                title: "Masa Belajar Berakhir",
                message: "Masa aktif belajar Anda telah berakhir. Hubungi atau ingatkan orang tua Anda untuk memperpanjang langganan belajar.",
              });
            } else if (daysRemaining !== null && daysRemaining <= 7) {
              activeReminders.push({
                type: "warning",
                title: "Masa Belajar Hampir Berakhir",
                message: `Masa aktif belajar Anda akan berakhir dalam ${daysRemaining} hari. Ingatkan orang tua Anda untuk memperpanjang langganan.`,
              });
            }
          }
        }

        setReminders(activeReminders);
      } catch (err) {
        console.error("Gagal memeriksa status subscription:", err);
      } finally {
        if (active) setLoading(false);
      }
    }

    checkSubscriptions();

    return () => {
      active = false;
    };
  }, [role, currentUser.id]);

  if (loading || reminders.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-6">
      {reminders.map((reminder, idx) => {
        const isDanger = reminder.type === "danger";
        return (
          <div
            key={idx}
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border text-sm transition-all duration-300 shadow-sm animate-in fade-in duration-500 ${
              isDanger
                ? "bg-red-50/70 border-red-200 text-red-900"
                : "bg-amber-50/70 border-amber-200 text-amber-900"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 p-1 rounded-md ${isDanger ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>
                {isDanger ? <AlertCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              </div>
              <div className="text-left">
                <p className="font-bold">{reminder.title}</p>
                <p className="mt-0.5 opacity-90 text-xs sm:text-sm leading-relaxed">{reminder.message}</p>
              </div>
            </div>
            
            <div className="shrink-0 self-end sm:self-center">
              {role === 10 ? (
                <Link to="/payments">
                  <Button
                    size="sm"
                    className={`font-semibold ${
                      isDanger
                        ? "bg-red-600 hover:bg-red-700 text-white"
                        : "bg-amber-600 hover:bg-amber-700 text-white"
                    }`}
                  >
                    Perbarui Sekarang
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isDanger ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                  Pemberitahuan Aktif
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
