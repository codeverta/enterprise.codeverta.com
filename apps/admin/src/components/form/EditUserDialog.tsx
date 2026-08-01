import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Edit } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api"; // Pastikan path ini benar

/**
 * Komponen Dialog untuk mengedit data pengguna.
 * @param {object} user - Objek pengguna yang akan diedit.
 * @param {function} onUpdateSuccess - Callback yang dijalankan setelah update berhasil.
 * @param {React.ReactNode} children - Trigger kustom untuk membuka dialog.
 */
export default function EditUserDialog({ user, onUpdateSuccess, children }) {
  const [name, setName] = useState(user.name);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = async (e) => {
    console.log({e})
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    // Siapkan payload, hanya sertakan password jika diisi
    const payload = { name };
    if (password) {
      payload.password = password;
      payload.password_confirmation = passwordConfirmation;
    }

    try {
      const response = await api.put(`/users/${user.id}`, payload);
      toast.success("User updated successfully!");
      if (onUpdateSuccess) {
        onUpdateSuccess(response.data.data);
      }
      setIsOpen(false); // Tutup dialog setelah berhasil
    } catch (error) {
      if (error.response) {
        if (error.response.status === 422) {
          setErrors(error.response.data.errors);
          toast.error("Validation failed. Please check the form.");
        } else if (error.response.status === 403) {
          toast.error(
            error.response.data.message ||
              "You are not authorized to perform this action."
          );
        } else {
          toast.error(
            error.response.data.message || "An unexpected error occurred."
          );
        }
      } else {
        toast.error("An error occurred. Please check your connection.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset state formulir setiap kali dialog dibuka
  useEffect(() => {
    if (isOpen) {
      setName(user.name);
      setPassword("");
      setPasswordConfirmation("");
      setErrors({});
      setShowPassword(false);
    }
  }, [isOpen, user]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {/* Gunakan trigger kustom jika ada, jika tidak, gunakan tombol default */}
        {children || (
          <Button variant="ghost" size="icon" title="Edit User">
            <Edit className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit User Profile</DialogTitle>
          <DialogDescription>
            Ubah data profil di sini. Email tidak dapat diubah.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                value={user.email}
                readOnly
                className="col-span-3 bg-gray-100 cursor-not-allowed"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Nama
              </Label>
              <div className="col-span-3">
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full"
                />
                {errors.name && (
                  <p className="text-red-500 text-xs mt-1">{errors.name[0]}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password" className="text-right">
                Password Baru
              </Label>
              <div className="col-span-3 relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Kosongkan jika tidak ingin ganti"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-800"
                  aria-label={
                    showPassword ? "Sembunyikan password" : "Tampilkan password"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
                {errors.password && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.password[0]}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password_confirmation" className="text-right">
                Konfirmasi
              </Label>
              <div className="col-span-3">
                <Input
                  id="password_confirmation"
                  type={showPassword ? "text" : "password"}
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  placeholder="Konfirmasi password baru"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
