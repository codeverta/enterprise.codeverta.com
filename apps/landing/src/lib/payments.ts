/**
 * Payment gateway abstraction.
 *
 * The UI calls `createPaymentIntent()` regardless of which Indonesian gateway
 * is configured. To go live, implement the corresponding adapter below and
 * set `ACTIVE_PROVIDER`. Until then, the mock adapter records the attempt in
 * localStorage so the dashboard/payment-history UI can render real data.
 *
 * Supported providers (placeholders — wire real SDK calls server-side):
 *   - Xendit    → https://developers.xendit.co
 *   - Midtrans  → https://docs.midtrans.com
 *   - Duitku    → https://docs.duitku.com
 *   - Tripay    → https://tripay.co.id/developer
 *
 * IMPORTANT: Real gateway calls MUST happen on the server (a TanStack
 * `createServerFn` once Lovable Cloud is enabled). Never ship secret API
 * keys to the browser. The client only receives a redirect URL / VA number
 * / QR string from the server response.
 */

import type {
  PaymentMethod,
  PaymentProvider,
  PaymentRecord,
  PaymentStatus,
} from "./db-schema";

const HISTORY_KEY = "kita_payment_history";

/** Xendit is the production target; this mock mirrors the same lifecycle locally. */
export const ACTIVE_PROVIDER: PaymentProvider = "xendit";

export interface CreatePaymentInput {
  parentEmail: string;
  parentName?: string;
  amountIdr: number;
  method: PaymentMethod;
  seats: number;
  /** Optional method-specific details (VA bank code, e-wallet brand, etc.) */
  details?: Record<string, string>;
}

export interface CreatePaymentResult {
  ok: boolean;
  record: PaymentRecord;
  /** Gateway redirect URL, QR payload, or VA number — whichever applies. */
  instruction?: string;
  error?: string;
}

function uid() {
  return (
    "pay_" +
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36)
  );
}

function readHistory(): PaymentRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as PaymentRecord[]) : [];
  } catch {
    return [];
  }
}

function writeHistory(items: PaymentRecord[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {
    /* storage may be unavailable */
  }
}

export function getPaymentHistory(): PaymentRecord[] {
  return readHistory().sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
}

/**
 * Create a payment intent.
 *
 * Today: stores a `pending` record locally and returns a friendly instruction.
 * Tomorrow: replace the body of the matching adapter with a real server call.
 */
export async function createPaymentIntent(
  input: CreatePaymentInput,
): Promise<CreatePaymentResult> {
  const now = new Date().toISOString();
  const record: PaymentRecord = {
    id: uid(),
    parent_id: input.parentEmail, // until Supabase: use email as stable id
    amount_idr: input.amountIdr,
    method: input.method,
    provider: ACTIVE_PROVIDER,
    status: "pending" as PaymentStatus,
    created_at: now,
  };

  let instruction: string | undefined;

  // ----- Adapter dispatch (all placeholders) -----
  switch (ACTIVE_PROVIDER) {
    case "midtrans":
      // TODO(Midtrans): call createTransaction() via server fn using
      //   process.env.MIDTRANS_SERVER_KEY; return redirect_url (Snap).
      instruction = "Midtrans Snap checkout will open here.";
      break;
    case "xendit":
      // TODO(Xendit): call Invoice API (or QR/VA API) via server fn using
      //   process.env.XENDIT_SECRET_KEY; return invoice_url.
      instruction = "Xendit invoice will be generated.";
      break;
    case "duitku":
      // TODO(Duitku): call Inquiry API via server fn using
      //   process.env.DUITKU_MERCHANT_KEY; return paymentUrl.
      instruction = "Duitku payment page will open.";
      break;
    case "tripay":
      // TODO(Tripay): call Transaction Create via server fn using
      //   process.env.TRIPAY_API_KEY + private key signature; return checkout_url.
      instruction = "Tripay checkout will open.";
      break;
  }

  // Persist locally so payment-history UI can render something real.
  const history = readHistory();
  history.push(record);
  writeHistory(history);

  return { ok: true, record, instruction };
}

/** Webhook handler stub — call this from a server route once live. */
export function applyWebhookUpdate(
  recordId: string,
  status: PaymentStatus,
  providerReference?: string,
) {
  const history = readHistory();
  const idx = history.findIndex((p) => p.id === recordId);
  if (idx === -1) return;
  history[idx] = {
    ...history[idx],
    status,
    provider_reference: providerReference ?? history[idx].provider_reference,
    paid_at: status === "paid" ? new Date().toISOString() : history[idx].paid_at,
  };
  writeHistory(history);
}
