import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import api from "@/lib/api";

// --- Schema Definition ---
const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,11}$/;
const safeStringRegex = /^[a-zA-Z0-9\s.,\-\/'’]+$/;

export const participantSchema = z.object({
  first_name: z.string().min(2, "Min 2 char").regex(safeStringRegex),
  last_name: z.string().min(2, "Min 2 char").regex(safeStringRegex),
  email: z.string().email("Email invalid"),
  gender: z.enum(["Male", "Female"]),
  date_of_birth: z
    .string()
    .refine((d) => new Date(d).toString() !== "Invalid Date"),
  blood_type: z.enum(["A", "B", "AB", "O", "-"]),
  phone_number: z.string().regex(phoneRegex, "Format: 08xx..."),
  id_type: z.enum(["KTP", "PASSPORT", "SIM"]),
  id_number: z
    .string()
    .min(5)
    .regex(/^[a-zA-Z0-9]+$/),
  address: z.string().min(5).regex(safeStringRegex),
  city: z.string().optional(),
  province: z.string().optional(),
  country: z.string().min(2).regex(safeStringRegex),
  category: z.string().optional(),
  bib_name: z
    .string()
    .max(15)
    .regex(/^[a-zA-Z0-9\s]+$/),
  jersey_size: z.enum(["XS", "S", "M", "L", "XL", "XXL", "3XL"]),
  community_name: z.string().optional(),
  medical_condition: z.string().optional(),
  emergency_contact_name: z.string().min(2).regex(safeStringRegex),
  relationship_with_emergency_contacts: z
    .string()
    .min(2)
    .regex(safeStringRegex),
  emergency_contact_numbers: z.string().regex(phoneRegex),
});

export const useParticipantForm = ({ initialData, onSuccess, onClose }) => {
  const [provinces, setProvinces] = useState([]);
  const [regencies, setRegencies] = useState([]);
  const isEdit = !!initialData;

  const form = useForm({
    resolver: zodResolver(participantSchema),
    defaultValues: {
      country: "Indonesia",
      province: "",
      city: "",
      id_type: "KTP",
      blood_type: "-",
      medical_condition: "-",
    },
  });

  const { watch, setValue, reset, trigger } = form;
  const watchedCountry = watch("country");
  const watchedProvince = watch("province");
  const isIndonesia = watchedCountry === "Indonesia";

  // --- Region Logic ---
  useEffect(() => {
    api
      .get("/regions/provinces")
      .then((res) => setProvinces(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isIndonesia || !watchedProvince) {
      setRegencies([]);
      if (!isIndonesia) setValue("city", "");
      return;
    }
    api
      .get(`/regions/regencies/${watchedProvince}`)
      .then((res) => setRegencies(res.data))
      .catch(() => {});
  }, [watchedProvince, isIndonesia, setValue]);

  // --- Populate Data on Edit ---
  useEffect(() => {
    if (initialData) {
      reset({
        ...initialData,
        date_of_birth: initialData.date_of_birth?.split("T")[0] || "",
        country: initialData.country || "Indonesia",
      });
    } else {
      reset({
        country: "Indonesia",
        province: "",
        city: "",
        id_type: "KTP",
        blood_type: "-",
        medical_condition: "-",
      });
    }
  }, [initialData, reset]);

  // --- Submission Handler ---
  const handleFormSubmit = async (formData) => {
    const provinceName =
      provinces.find((p) => p.id === formData.province)?.name ||
      formData.province;
    const cityName =
      regencies.find((r) => r.id === formData.city)?.name || formData.city;

    const payload = {
      ...formData,
      province: isIndonesia ? provinceName : formData.province,
      city: isIndonesia ? cityName : formData.city,
    };

    try {
      if (isEdit) {
        await api.put(`/participants/${initialData.id}`, payload);
        toast.success("Berhasil diperbarui");
      } else {
        await api.post("/participants/register", payload);
      }
      if (onSuccess) onSuccess(payload);
      if (onClose) onClose();
    } catch (error) {
      toast.error("Gagal menyimpan data");
    }
  };

  // --- UI Helpers ---
  const handleSelectChange = (field, value) => {
    setValue(field, value);
    trigger(field);
  };

  const handleCountryChange = (value) => {
    setValue("country", value);
    trigger("country");
    if (value !== "Indonesia") {
      setValue("province", "");
      setValue("city", "");
    }
  };

  return {
    form,
    regions: { provinces, regencies, isIndonesia },
    actions: {
      handleSelectChange,
      handleCountryChange,
      submit: form.handleSubmit(handleFormSubmit),
    },
    isEdit,
  };
};
