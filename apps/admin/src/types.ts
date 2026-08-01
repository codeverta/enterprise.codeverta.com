// types.ts

export type RegistrationStatus = "PENDING" | "VERIFIED" | "REJECTED";
export type PaymentStatus = "PENDING" | "PAID" | "EXPIRED" | "FAILED";

export interface MetaPagination {
  next_cursor_time: string;
  next_cursor_id: string;
  has_more: boolean;
}

export interface Participant {
  id: string;
  order_id: string;
  unique_code: string;
  first_name: string;
  last_name: string;
  bib_name: string;
  email: string;
  phone_number: string;
  date_of_birth: string; // date string
  ticket_category_id: string;
  category: string;
  id_type: string;
  id_number: string;
  blood_type: string;
  jersey_size: string;
  jersey_type: string;
  gender: string;
  country: string;
  province: string;
  city: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_number: string;
  emergency_contact_relation: string;
  community_name: string;
  medical_condition: string;
  tracking_profile_link: string;
  registration_status: RegistrationStatus;
  is_verified: boolean;
  is_paid: boolean;
  rejected_reason: string | null;
  original_price: number;
  discount_amount: number;
  final_amount: number;
  promo_code_used: string;
  is_early_bird: boolean;
  is_racepack_taken: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface Payment {
  id: string;
  order_id: string;
  transaction_id: string | null;
  payment_type: string;
  amount: number;
  va_number: string;
  expiry_date: string;
  status: PaymentStatus;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

// Digunakan untuk list view (lebih ringan)
export interface OrderListResponse {
  id: string;
  reservation_id: string;
  pic_name: string;
  registration_status: RegistrationStatus;
  status: PaymentStatus;
  final_amount: number;
  created_at: string;
  // Field ini biasanya hasil count join di backend, 
  // sesuaikan jika backend tidak mengirimnya secara eksplisit
  participant_count?: number; 
}

// Digunakan untuk detail view (diklik)
export interface OrderDetail extends OrderListResponse {
  unique_code: string;
  pic_email: string;
  pic_phone: string;
  total_original_price: number;
  total_discount: number;
  payment_url: string;
  token: string;
  rejected_reason: string | null;
  expires_at: string | null;
  updated_at: string;
  participants: Participant[];
  payment?: Payment; // Sesuai dengan struct Order yang memiliki field Payment
}