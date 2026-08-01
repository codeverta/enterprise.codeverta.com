import { useState } from "react";
import { MessageCircle, X, Mail, Phone } from "lucide-react";

const WA_NUMBER = "6282342047638";
const WA_PREFIX = "https://wa.me/";
const EMAIL = "admin@kitafuture.com";

export default function FloatingContact() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Contact card */}
      {open && (
        <div className="animate-in slide-in-from-bottom-4 fade-in duration-300 rounded-2xl border border-border/60 bg-card/95 shadow-[0_20px_60px_-15px_oklch(0.2_0.05_265/0.35)] backdrop-blur-xl p-4 w-72">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold">Hubungi Kami</h3>
            <button
              onClick={() => setOpen(false)}
              className="h-6 w-6 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-3">
            <a
              href={`mailto:${EMAIL}`}
              className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-muted/70 transition-all group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Mail className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium">Email</p>
                <p className="text-sm font-semibold truncate">{EMAIL}</p>
              </div>
            </a>
            <a
              href={`${WA_PREFIX}${WA_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-emerald-50/70 transition-all group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Phone className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium">WhatsApp</p>
                <p className="text-sm font-semibold">+62 823-4204-7638 (Aiswarya)</p>
              </div>
            </a>
          </div>
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_8px_30px_-8px_oklch(0.62_0.2_155/0.6)] hover:shadow-[0_12px_40px_-8px_oklch(0.62_0.2_155/0.8)] hover:-translate-y-0.5 transition-all duration-300 active:scale-95"
        aria-label={open ? "Tutup kontak" : "Hubungi kami"}
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </button>
    </div>
  );
}
