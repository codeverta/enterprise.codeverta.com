// src/schemas/registrationSchema.js
import { z } from "zod";

export const registrationSchema = z.object({
  first_name: z.string().min(1, { message: "Nama depan wajib diisi." }),
  last_name: z.string().min(1, { message: "Nama belakang wajib diisi." }),  bib_name: z.string().min(1, { message: "Nama BIB wajib diisi." }),
  email: z.string().email({ message: "Format email tidak valid." }),
  phone_number: z.string().regex(/^08\d{8,11}$/, { message: "Nomor telepon tidak valid (contoh: 081234567890)." }),
  date_of_birth: z.string().min(1, { message: "Tanggal lahir wajib diisi." }),
  id_type: z.enum(["KTP", "SIM", "Paspor"]), // Contoh pilihan
  id_number: z.string().min(16, { message: "Nomor ID minimal 16 karakter." }),
  blood_type: z.enum(["A", "B", "AB", "O"]),
  jersey_size: z.enum(["XS", "S", "M", "L", "XL", "XXL"]),
  gender: z.enum(["Male", "Female"]),
  country: z.string().min(1, { message: "Negara wajib diisi." }),
  province: z.string().min(1, { message: "Provinsi wajib diisi." }),
  city: z.string().min(1, { message: "Kota wajib diisi." }),
  address: z.string().min(5, { message: "Alamat wajib diisi." }),
  emergency_contact_name: z.string().min(1, { message: "Nama kontak darurat wajib diisi." }),
  emergency_contact_numbers: z.string().regex(/^08\d{8,11}$/, { message: "Nomor kontak darurat tidak valid." }),
  relationship_with_emergency_contacts: z.string().min(1, { message: "Hubungan wajib diisi." }),
  community_name: z.string().optional(),
  special_conditional_medic: z.string().optional(),
  promo_code: z.string().optional(),
});