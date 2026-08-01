import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Label } from "@/components/ui/label";
import * as z from "zod";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, Check, X, Loader2 } from "lucide-react";
import api from "@/lib/api";

// Regex validasi
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TRIM = (v: string) => v?.trim() || "";
const MAX_CHARS = { username: 30, email: 100, display_name: 80 };

// Password strength
const scoreLabel = (s: number) => s <= 1 ? "Lemah" : s === 2 ? "Sedang" : s === 3 ? "Kuat" : "Sangat Kuat";
const scoreColor = (s: number) => s <= 1 ? "bg-red-500" : s === 2 ? "bg-amber-500" : s === 3 ? "bg-emerald-500" : "bg-emerald-600";

function passwordStrength(pw: string): number {
  let score = 0;
  if (!pw) return 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

const formSchema = z.object({
  username: z.string().min(3, "Minimal 3 karakter").max(MAX_CHARS.username, `Maks ${MAX_CHARS.username} karakter`),
  display_name: z.string().max(MAX_CHARS.display_name, `Maks ${MAX_CHARS.display_name} karakter`).optional().or(z.literal("")),
  email: z.string().max(MAX_CHARS.email).refine((v) => !v || EMAIL_REGEX.test(v), "Format email tidak valid"),
  role: z.string(),
  status: z.string(),
  mentor_type: z.string().optional(),
  city: z.string().max(100).optional(),
  institution: z.string().max(160).optional(),
  teaching_status: z.string().max(100).optional(),
  simpkb: z.string().max(100).optional(),
  nuptk: z.string().max(100).optional(),
  gtk: z.string().max(100).optional(),
  declaration: z.boolean().optional(),
  password: z.string().optional(),
});

function UserFormDialog({ isOpen, setIsOpen, editingUser, onSave }) {
  const [showPassword, setShowPassword] = useState(false);
  const [emailStatus, setEmailStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [emailMsg, setEmailMsg] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [usernameMsg, setUsernameMsg] = useState("");
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "", display_name: "", email: "", role: "20", status: "1",
      password: "", mentor_type: "eksternal", city: "", institution: "",
      teaching_status: "", simpkb: "", nuptk: "", gtk: "", declaration: false,
    },
  });

  const currentRole = watch("role");
  const currentStatus = watch("status");
  const currentMentorType = watch("mentor_type") || "eksternal";
  const pw = watch("password") || "";
  const pwStrength = passwordStrength(pw);

  useEffect(() => {
    if (isOpen) {
      if (editingUser) {
        const profile = editingUser.profile || {};
        const metadata = profile.metadata || {};
        const verification = metadata.teacher_verification || {};
        reset({
          username: editingUser.username || "",
          display_name: editingUser.display_name || "",
          email: editingUser.email || "",
          role: String(editingUser.role),
          status: String(editingUser.status),
          password: "",
          mentor_type: editingUser.mentor_type || "eksternal",
          city: profile.city || verification.city || metadata.city || "",
          institution:
            profile.institution || verification.institution || metadata.institution || "",
          teaching_status:
            profile.teaching_status || verification.teaching_status || metadata.teaching_status || "",
          simpkb: profile.simpkb || verification.simpkb || metadata.simpkb || "",
          nuptk: profile.nuptk || verification.nuptk || metadata.nuptk || "",
          gtk: profile.gtk || verification.gtk || metadata.gtk || "",
          declaration: Boolean(
            profile.declaration ?? verification.declaration ?? metadata.declaration
          ),
        });
        setEmailStatus("idle");
        setEmailMsg("");
        setUsernameStatus("idle");
        setUsernameMsg("");
      } else {
        reset({
          username: "", display_name: "", email: "", role: "20", status: "1",
          password: "", mentor_type: "eksternal", city: "", institution: "",
          teaching_status: "", simpkb: "", nuptk: "", gtk: "", declaration: false,
        });
        setEmailStatus("idle");
        setEmailMsg("");
        setUsernameStatus("idle");
        setUsernameMsg("");
      }
    }
  }, [isOpen, editingUser, reset]);

  // Username real-time check with debounce
  useEffect(() => {
    const usernameVal = TRIM(watch("username"));
    if (!usernameVal || usernameVal.length < 3) {
      setUsernameStatus("idle");
      setUsernameMsg("");
      return;
    }
    if (editingUser && usernameVal.toLowerCase() === editingUser.username?.toLowerCase()) {
      setUsernameStatus("idle");
      setUsernameMsg("");
      return;
    }

    setUsernameStatus("checking");
    setUsernameMsg("");
    const timer = setTimeout(async () => {
      try {
        const response = await api.get("/checkout/check-username", {
          params: {
            username: usernameVal,
            exclude_id: editingUser?.id || undefined,
          },
        });
        const data = response.data?.data || response.data || {};
        if (data.available) {
          setUsernameStatus("valid");
          setUsernameMsg("Username tersedia");
        } else {
          setUsernameStatus("invalid");
          setUsernameMsg("Username sudah digunakan");
        }
      } catch (err) {
        setUsernameStatus("idle");
        setUsernameMsg("");
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [watch("username"), editingUser]);

  // Email real-time check
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = TRIM(e.target.value);
    setValue("email", val, { shouldValidate: true });
    if (!val || !EMAIL_REGEX.test(val) || editingUser) {
      setEmailStatus("idle");
      setEmailMsg("");
      return;
    }
    setEmailStatus("checking");
    // Debounce check (tidak perlu API — cukup format)
    const timer = setTimeout(() => {
      setEmailStatus(EMAIL_REGEX.test(val) ? "valid" : "invalid");
      setEmailMsg(EMAIL_REGEX.test(val) ? "Email valid" : "Format email tidak valid");
    }, 500);
    return () => clearTimeout(timer);
  };

  const onSubmit = (data) => {
    if (usernameStatus === "invalid") {
      return;
    }
    const payload: any = {
      username: TRIM(data.username),
      display_name: TRIM(data.display_name),
      email: TRIM(data.email),
      role: Number(data.role),
      status: Number(data.status),
    };
    if (data.role === "30" || data.role === "40") {
      payload.mentor_type = data.mentor_type;
    }
    if (data.role === "40") {
      payload.city = TRIM(data.city);
      payload.institution = TRIM(data.institution);
      payload.teaching_status = TRIM(data.teaching_status);
      payload.simpkb = TRIM(data.simpkb);
      payload.nuptk = TRIM(data.nuptk);
      payload.gtk = TRIM(data.gtk);
      payload.declaration = !!data.declaration;
    }
    if (data.password?.trim()) {
      payload.password = data.password.trim();
    }
    onSave(payload);
  };

  const sanitizeInput = (handler: any) => ({
    ...handler,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const sanitized = e.target.value.replace(/(?![\w.@\-\s])./g, "").slice(0, 200);
      e.target.value = sanitized;
      handler.onChange(e);
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[680px]">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Ubah" : "Tambah"} Pengguna</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            {/* USERNAME */}
            <div className="grid gap-1.5">
              <Label htmlFor="username">Username *</Label>
              <div className="relative">
                <Input
                  id="username"
                  {...sanitizeInput(register("username"))}
                  placeholder="Masukkan username"
                  maxLength={MAX_CHARS.username}
                />
                {usernameStatus === "checking" && (
                  <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {usernameStatus === "valid" && (
                  <Check className="absolute right-3 top-2.5 h-4 w-4 text-emerald-500" />
                )}
                {usernameStatus === "invalid" && (
                  <X className="absolute right-3 top-2.5 h-4 w-4 text-red-500" />
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-[11px] text-destructive">
                  {usernameMsg === "Username sudah digunakan" ? usernameMsg : errors.username ? String(errors.username.message) : ""}
                </span>
                <span className="text-[10px] text-muted-foreground">{watch("username")?.length || 0}/{MAX_CHARS.username}</span>
              </div>
            </div>

            {/* DISPLAY NAME */}
            <div className="grid gap-1.5">
              <Label htmlFor="display_name">Nama Tampilan</Label>
              <Input
                id="display_name"
                {...register("display_name")}
                placeholder="Nama tampilan (opsional)"
                maxLength={MAX_CHARS.display_name}
              />
              <div className="flex justify-end">
                <span className="text-[10px] text-muted-foreground">{(watch("display_name") || "")?.length}/{MAX_CHARS.display_name}</span>
              </div>
            </div>

            {/* EMAIL */}
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email *</Label>
              <div className="relative">
                <Input
                  id="email"
                  value={watch("email")}
                  onChange={handleEmailChange}
                  placeholder="contoh@domain.com"
                  maxLength={MAX_CHARS.email}
                />
                {emailStatus === "checking" && (
                  <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {emailStatus === "valid" && (
                  <Check className="absolute right-3 top-2.5 h-4 w-4 text-emerald-500" />
                )}
                {emailStatus === "invalid" && (
                  <X className="absolute right-3 top-2.5 h-4 w-4 text-red-500" />
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-[11px] text-destructive">{emailMsg === "Format email tidak valid" ? emailMsg : errors.email ? String(errors.email.message) : ""}</span>
                <span className="text-[10px] text-muted-foreground">{(watch("email") || "")?.length}/{MAX_CHARS.email}</span>
              </div>
            </div>

            {/* ROLE */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="role">Role</Label>
                <Select value={currentRole} onValueChange={(v) => setValue("role", v)}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Pilih Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">Orang Tua</SelectItem>
                    <SelectItem value="20">Siswa</SelectItem>
                    <SelectItem value="30">Mentor Internal</SelectItem>
                    <SelectItem value="40">Mentor Eksternal</SelectItem>
                    <SelectItem value="99">Admin</SelectItem>
                    {currentUser?.role === 100 && (
                      <SelectItem value="100">Superadmin</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="status">Status Akun</Label>
                <Select value={currentStatus} onValueChange={(v) => setValue("status", v)}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 — Aktif</SelectItem>
                    <SelectItem value="2">2 — Tidak aktif</SelectItem>
                    <SelectItem value="3">3 — Menunggu aktivasi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* MENTOR TYPE — only for role 30/40 */}
            {(currentRole === "30" || currentRole === "40") && (
              <div className="grid gap-1.5">
                <Label htmlFor="mentor_type">Tipe Mentor</Label>
                <Select value={currentMentorType} onValueChange={(v) => setValue("mentor_type", v)}>
                  <SelectTrigger id="mentor_type">
                    <SelectValue placeholder="Pilih Tipe Mentor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal</SelectItem>
                    <SelectItem value="eksternal">Eksternal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {currentRole === "40" && (
              <section className="space-y-3 rounded-xl border border-sky-100 bg-sky-50/50 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Profil Guru Eksternal
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Data verifikasi tenaga pendidik yang tersimpan pada profile user.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="city">Kota</Label>
                    <Input id="city" {...register("city")} placeholder="Kota domisili" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="institution">Institusi</Label>
                    <Input id="institution" {...register("institution")} placeholder="Nama sekolah/institusi" />
                  </div>
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label htmlFor="teaching_status">Status Mengajar</Label>
                    <Input id="teaching_status" {...register("teaching_status")} placeholder="Contoh: Guru aktif" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="simpkb">SIMPKB</Label>
                    <Input id="simpkb" {...register("simpkb")} placeholder="Nomor SIMPKB" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="nuptk">NUPTK</Label>
                    <Input id="nuptk" {...register("nuptk")} placeholder="Nomor NUPTK" />
                  </div>
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label htmlFor="gtk">Nomor GTK</Label>
                    <Input id="gtk" {...register("gtk")} placeholder="Nomor GTK" />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg border border-sky-100 bg-white px-3 py-2.5">
                  <div>
                    <Label htmlFor="declaration" className="text-xs font-medium">
                      Pernyataan kebenaran data
                    </Label>
                    <p className="text-[11px] text-slate-500">
                      Guru telah menyetujui deklarasi data verifikasi.
                    </p>
                  </div>
                  <Switch
                    id="declaration"
                    checked={!!watch("declaration")}
                    onCheckedChange={(checked) => setValue("declaration", checked)}
                  />
                </div>
              </section>
            )}

            {/* PASSWORD */}
            <div className="grid gap-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  placeholder={editingUser ? "Kosongkan jika tidak diubah" : "Password minimal 8 karakter"}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Password strength bar */}
              {pw && (
                <div className="mt-1 space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className={`h-1 flex-1 rounded-full ${i <= pwStrength ? scoreColor(pwStrength) : "bg-slate-200"}`} />
                    ))}
                  </div>
                  <p className={`text-[10px] font-medium ${pwStrength <= 1 ? "text-red-500" : pwStrength === 2 ? "text-amber-500" : "text-emerald-500"}`}>
                    {scoreLabel(pwStrength)}
                  </p>
                </div>
              )}
              {errors.password && (
                <p className="text-[11px] font-medium text-destructive">{String(errors.password.message)}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Batal</Button>
            </DialogClose>
            <Button type="submit">Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default UserFormDialog;
