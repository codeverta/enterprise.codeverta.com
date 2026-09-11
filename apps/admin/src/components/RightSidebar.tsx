import React, { useEffect, useRef, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  MoreHorizontal,
  LogOut,
  Key,
  Eye,
  EyeOff,
  Loader2,
  Camera,
} from "lucide-react";
import { NavLink } from "react-router";
import { Button } from "@/components/ui/button";
import clsx from "clsx";
import { Badge } from "@/components/ui/badge";
import RegisterPasskeyButton from "./RegisterPasskeyButton";
import api from "@/lib/api"; // Import api untuk fetch code partner
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SidebarUser = {
  id?: string;
  display_name: string;
  email: string;
  avatar_url?: string;
};

function initials(name?: string) {
  return String(name || "User")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function RightSidebar({
  user,
  isOpen,
  onLogout,
  rightSidebarItems,
  roleInfo,
}: {
  user: SidebarUser | null;
  isOpen: boolean;
  onLogout: () => void;
  rightSidebarItems: {
    name: string;
    icon: React.ElementType;
    href?: string;
    onClick?: () => void;
  }[];
  roleInfo: { label: string; color: string };
}) {
  // State untuk manajemen Linking Code Partner
  const [showCode, setShowCode] = useState(false);
  const [linkingCode, setLinkingCode] = useState("");
  const [loadingCode, setLoadingCode] = useState(false);
  const [avatarURL, setAvatarURL] = useState(user?.avatar_url || "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [localDisplayName, setLocalDisplayName] = useState(user?.display_name || "");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    display_name: "",
    username: "",
    email: "",
    bio: "",
    headline: "",
    phone_number: "",
  });

  const fetchProfile = async () => {
    try {
      const res = await api.get("/my-profile");
      const d = res.data?.data || {};
      setProfileForm({
        display_name: d.display_name || "",
        username: d.username || "",
        email: d.email || "",
        bio: d.bio || "",
        headline: d.headline || "",
        phone_number: d.phone_number || "",
      });
      if (d.avatar_url) {
        setAvatarURL(d.avatar_url);
      }
      if (d.display_name) {
        setLocalDisplayName(d.display_name);
      }
    } catch (err) {
      console.error("Gagal memuat profil", err);
    }
  };

  useEffect(() => {
    if (user?.display_name) {
      setLocalDisplayName(user.display_name);
    }
  }, [user?.display_name]);

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.display_name.trim()) {
      toast.error("Nama lengkap wajib diisi");
      return;
    }
    if (!profileForm.username.trim()) {
      toast.error("Username wajib diisi");
      return;
    }
    try {
      setSavingProfile(true);
      await api.put("/my-profile", {
        display_name: profileForm.display_name,
        username: profileForm.username,
        bio: profileForm.bio,
        headline: profileForm.headline,
        phone_number: profileForm.phone_number,
      });
      
      setLocalDisplayName(profileForm.display_name);

      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem(
        "user",
        JSON.stringify({ ...storedUser, display_name: profileForm.display_name, username: profileForm.username })
      );
      toast.success("Profil berhasil disimpan.");
      setIsEditingProfile(false);
      
      setTimeout(() => window.location.reload(), 800);
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Profil gagal diperbarui."
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const isPhoneImage = /\.(heic|heif)$/i.test(file.name);
    if (!file.type.startsWith("image/") && !isPhoneImage) {
      toast.error("Pilih file gambar yang valid.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran foto maksimal 5 MB.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    try {
      setUploadingAvatar(true);
      const res = await api.post("/my-profile/avatar", formData);
      const avatar = res.data?.data?.avatar_url || "";
      setAvatarURL(avatar);

      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem(
        "user",
        JSON.stringify({ ...storedUser, avatar_url: avatar })
      );
      toast.success("Foto profil berhasil diperbarui.");
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Foto profil gagal diperbarui."
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleToggleCode = async () => {
    if (showCode) {
      setShowCode(false);
      return;
    }

    setShowCode(true);
    // Hanya fetch ke API jika data code belum di-load
    if (!linkingCode) {
      try {
        setLoadingCode(true);
        const res = await api.get("/lms/student/linking-code");
        setLinkingCode(res.data?.data?.linking_code || "CV-9831A");
      } catch (err) {
        setLinkingCode("Gagal memuat kode");
      } finally {
        setLoadingCode(false);
      }
    }
  };

  // Normalisasi pengecekan role (case-insensitive)
  const isStudent =
    roleInfo.label.toLowerCase() === "student" ||
    roleInfo.label.toLowerCase() === "partner";

  return (
    <div className="mt-auto">
      <Drawer direction="right">
        <DrawerTrigger asChild>
          <div
            className={clsx(
              "p-2 bg-gray-100 rounded-lg flex items-center transition-all duration-300 cursor-pointer hover:bg-gray-200",
              !isOpen && "p-1.5 justify-center"
            )}
            title={user?.active_subscription ? `Plan: ${user.active_subscription}` : "Pengaturan Akun"}
          >
            <Avatar className="h-6 w-6 shrink-0 border border-gray-200">
              <AvatarImage src={avatarURL} alt={localDisplayName || "User"} />
              <AvatarFallback className="bg-white text-[9px] font-semibold text-gray-600">
                {initials(localDisplayName)}
              </AvatarFallback>
            </Avatar>
            {isOpen && (
              <>
                <div className="flex-grow ml-2.5 overflow-hidden text-left">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="font-semibold text-xs text-gray-800 truncate max-w-[85px]">
                      {localDisplayName}
                    </p>
                    <Badge
                      variant="outline"
                      className={`text-[9px] h-4 px-1 py-0 font-medium border ${roleInfo.color}`}
                    >
                      {roleInfo.label}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-gray-500 truncate">
                    {user?.email}
                  </p>
                  {user?.active_subscription && (
                    <p className="text-[9px] text-blue-600 font-semibold truncate mt-0.5" title={user.active_subscription}>
                      Plan: {user.active_subscription}
                    </p>
                  )}
                </div>
                <MoreHorizontal className="h-4 w-4 text-gray-500 ml-1.5 flex-shrink-0" />
              </>
            )}
          </div>
        </DrawerTrigger>
        <DrawerContent className="w-[340px] max-h-[100vh] overflow-y-auto">
          {isEditingProfile ? (
            <form onSubmit={handleSaveProfile} className="flex flex-col h-full">
              <DrawerHeader className="text-left pb-2 border-b">
                <DrawerTitle>Edit Profil</DrawerTitle>
                <DrawerDescription>
                  Perbarui informasi profil publik Anda di sini.
                </DrawerDescription>
              </DrawerHeader>
              
              <div className="p-4 flex flex-col space-y-4 flex-grow overflow-y-auto">
                {/* Photo profile upload */}
                <div className="flex flex-col items-center space-y-2 pb-4 border-b border-gray-100">
                  <div className="relative">
                    <Avatar className="h-20 w-20 border-2 border-gray-200">
                      <AvatarImage
                        src={avatarURL}
                        alt={localDisplayName || "User"}
                      />
                      <AvatarFallback className="bg-gray-100 font-semibold text-gray-700 text-xl">
                        {initials(localDisplayName)}
                      </AvatarFallback>
                    </Avatar>
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="absolute bottom-0 right-0 h-8 w-8 rounded-full border border-white shadow-sm"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      title="Ubah foto profil"
                    >
                      {uploadingAvatar ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </Button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                  >
                    Ubah Foto Profil
                  </Button>
                </div>

                {/* Form fields */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="display_name" className="text-xs font-semibold text-gray-600">Nama Lengkap *</Label>
                    <Input
                      id="display_name"
                      placeholder="Nama Lengkap"
                      value={profileForm.display_name}
                      onChange={(e) => setProfileForm({ ...profileForm, display_name: e.target.value })}
                      disabled={savingProfile || uploadingAvatar}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="username" className="text-xs font-semibold text-gray-600">Username *</Label>
                    <Input
                      id="username"
                      placeholder="username"
                      value={profileForm.username}
                      onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value.toLowerCase().replace(/\s+/g, "") })}
                      disabled={savingProfile || uploadingAvatar}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="email" className="text-xs font-semibold text-gray-600">Email (Read-only)</Label>
                    <Input
                      id="email"
                      value={profileForm.email}
                      disabled
                      className="bg-gray-50 text-gray-500 cursor-not-allowed border-gray-200"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="phone_number" className="text-xs font-semibold text-gray-600">No. Telepon</Label>
                    <Input
                      id="phone_number"
                      placeholder="0812xxxxxx"
                      value={profileForm.phone_number}
                      onChange={(e) => setProfileForm({ ...profileForm, phone_number: e.target.value })}
                      disabled={savingProfile || uploadingAvatar}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="bio" className="text-xs font-semibold text-gray-600">Bio</Label>
                    <Textarea
                      id="bio"
                      placeholder="Ceritakan tentang diri Anda..."
                      value={profileForm.bio}
                      onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                      disabled={savingProfile || uploadingAvatar}
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                </div>
              </div>

              <DrawerFooter className="pt-4 border-t flex flex-row gap-2 mt-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditingProfile(false)}
                  disabled={savingProfile}
                  className="flex-1"
                >
                  Batal
                </Button>
                <Button type="submit" disabled={savingProfile} className="flex-1">
                  {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Simpan
                </Button>
              </DrawerFooter>
            </form>
          ) : (
            <div className="flex flex-col h-full">
              <DrawerHeader className="text-left">
                <DrawerTitle>Pengaturan Akun</DrawerTitle>
                <DrawerDescription>
                  Kelola akun, preferensi, dan pengaturan aplikasi Anda.
                </DrawerDescription>
              </DrawerHeader>
              <div className="p-4 flex flex-col space-y-2 flex-grow overflow-y-auto">
                <div className="mb-3 flex items-center gap-3 border-b border-gray-100 pb-4">
                  <Avatar className="h-14 w-14 border border-gray-200">
                    <AvatarImage
                      src={avatarURL}
                      alt={localDisplayName || "User"}
                    />
                    <AvatarFallback className="bg-gray-100 font-semibold text-gray-700 text-lg">
                      {initials(localDisplayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800">
                      {localDisplayName}
                    </p>
                    <p className="truncate text-xs text-gray-500">{user?.email}</p>
                    {user?.active_subscription && (
                      <div className="mt-1">
                        <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold border border-blue-100">
                          Plan: {user.active_subscription}
                        </span>
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="link"
                      className="p-0 h-auto text-xs font-semibold text-blue-600 hover:text-blue-700 mt-1"
                      onClick={() => {
                        fetchProfile();
                        setIsEditingProfile(true);
                      }}
                    >
                      Edit Profil
                    </Button>
                  </div>
                </div>
                <RegisterPasskeyButton />

                {/* 1. Kondisional Rendering List Menu Sidebar */}
                {rightSidebarItems
                  .filter((item) => {
                    // Filter / Sembunyikan menu "Akun Anak" atau sejenisnya jika usernya adalah Student
                    if (
                      isStudent &&
                      (item.name.toLowerCase().includes("anak") ||
                        item.name.toLowerCase().includes("child") ||
                        item.name.toLowerCase().includes("partner"))
                    ) {
                      return false;
                    }
                    return true;
                  })
                  .map((item) =>
                    item.href ? (
                      <NavLink
                        key={item.href}
                        to={item.href}
                        className={({ isActive }) =>
                          clsx(
                            "flex items-center p-2 rounded-md hover:bg-gray-100 text-gray-700",
                            isActive && "bg-blue-100 text-blue-700"
                          )
                        }
                      >
                        <item.icon className="h-5 w-5 mr-3" />
                        <span className="font-medium text-sm">{item.name}</span>
                      </NavLink>
                    ) : (
                      <div
                        key={item.name}
                        onClick={item.onClick}
                        className="flex items-center p-2 rounded-md hover:bg-gray-100 text-gray-700 cursor-pointer"
                      >
                        <item.icon className="h-5 w-5 mr-3" />
                        <span className="font-medium text-sm">{item.name}</span>
                      </div>
                    )
                  )}

                {/* 2. Fitur Tampilkan Code Khusus Untuk Student */}
                {isStudent && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 px-2 uppercase tracking-wider">
                      Akses Merchant
                    </p>
                    <div className="p-2 rounded-md bg-gray-50 border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-gray-700">
                          <Key className="h-4 w-4 mr-2 text-gray-400" />
                          <span className="text-xs font-medium">
                            Kode Hubung Merchant
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-500"
                          onClick={handleToggleCode}
                        >
                          {showCode ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>

                      {/* Kode hanya di-render dan di-fetch saat di-klik buka */}
                      {showCode && (
                        <div className="mt-2 text-center bg-white p-2 rounded border border-dashed border-gray-300 font-mono text-sm font-bold tracking-widest text-blue-600 min-h-[38px] flex items-center justify-center">
                          {loadingCode ? (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                          ) : (
                            linkingCode
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <DrawerFooter className="pt-4 mt-auto border-t">
                <Button onClick={onLogout} variant="outline" className="w-full">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Keluar</span>
                </Button>
              </DrawerFooter>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export default RightSidebar;
