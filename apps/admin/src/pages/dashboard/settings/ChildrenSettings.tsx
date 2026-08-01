import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Plus, UserX, User, ArrowRight, Pencil } from "lucide-react";
import DashboardLayout from "../../../layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Student {
  id: string;
  student_id?: string;
  full_name: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  avatar_url: string;
  phone_number: string;
  email?: string;
}

function ChildrenSettings() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [linkingCode, setLinkingCode] = useState("");
	const [addMode, setAddMode] = useState("create");
	const [newStudent, setNewStudent] = useState({
		username: "", email: "", password: "", display_name: "",
		first_name: "", last_name: "", phone_number: "",
	});

  // State Dialog Control
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [studentToUnlink, setStudentToUnlink] = useState<Student | null>(null);

  // State Edit Dialog Control
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhoneNumber, setEditPhoneNumber] = useState("");
  const [editPassword, setEditPassword] = useState("");

  const handleStartEdit = (student: Student) => {
    setEditingStudent(student);
    setEditDisplayName(student.full_name || student.name || "");
    setEditFirstName(student.first_name || "");
    setEditLastName(student.last_name || "");
    setEditEmail(student.email || "");
    setEditPhoneNumber(student.phone_number || "");
    setEditPassword("");
    setIsEditOpen(true);
  };


const fetchLinkedStudents = async () => {
  try {
    setLoading(true);
    const res = await api.get("/lms/parent/students");
    const payload = res.data.data || {};
    setStudents(Array.isArray(payload) ? payload : payload.students || []);
  } catch (err) {
    toast.error({
      title: "Gagal memuat data",
      description: "Tidak dapat mengambil daftar akun anak.",
    });
    setStudents([]); // Fallback safe jika API error
  } finally {
    setLoading(false);
  }
};
  useEffect(() => {
    fetchLinkedStudents();
  }, []);

const handleLinkStudent = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!linkingCode.trim()) return;

  try {
    setSubmitLoading(true);
    const res = await api.post("/lms/parent/link-student", {
      linking_code: linkingCode,
    });

    // SESUAIKAN DENGAN SONNER TOAST
    toast.success("Berhasil terhubung", {
      description: `${
        res.data?.data?.student_name || "Partner"
      } telah ditambahkan ke akun Anda.`,
    });

    setLinkingCode("");
    setIsAddOpen(false);
    fetchLinkedStudents();
  } catch (err: any) {
    const errorMsg =
      err.response?.data?.message || "Pastikan kode yang dimasukkan valid.";

    // JANGAN MASUKKAN OBJEK UTUH KE DALAM TOAST POLOS
    toast.error("Gagal menghubungkan", {
      description: errorMsg,
    });
  } finally {
    setSubmitLoading(false);
  }
};
const handleCreateStudent = async (e: React.FormEvent) => {
	e.preventDefault();
	try {
		setSubmitLoading(true);
		const res = await api.post("/lms/parent/students", newStudent);
		toast.success("Akun anak berhasil dibuat", {
			description: `${res.data?.data?.student?.display_name || newStudent.display_name} sudah terhubung ke akun Anda.`,
		});
		setNewStudent({ username: "", email: "", password: "", display_name: "", first_name: "", last_name: "", phone_number: "" });
		setIsAddOpen(false);
		fetchLinkedStudents();
	} catch (err: any) {
		toast.error("Gagal membuat akun anak", {
			description: err.response?.data?.message || "Periksa kembali email, username, dan password.",
		});
	} finally {
		setSubmitLoading(false);
	}
};

const updateNewStudent = (field: keyof typeof newStudent, value: string) => {
	setNewStudent((current) => ({ ...current, [field]: value }));
};
const handleUnlinkStudent = async () => {
  if (!studentToUnlink) return;

  try {
    setSubmitLoading(true);
    await api.delete(`/lms/parent/students/${studentToUnlink.student_id || studentToUnlink.id}`);

    toast.warning("Akses dicabut", {
      description: `Hubungan dengan akun ${studentToUnlink.full_name} berhasil dihapus.`,
    });

    setStudentToUnlink(null);
    fetchLinkedStudents();
  } catch (err: any) {
    const errorMsg =
      err.response?.data?.message ||
      "Terjadi kesalahan saat memutus hubungan akun.";

    // PERBAIKAN: Sesuaikan dengan format Sonner
    toast.error("Gagal menghapus", {
      description: errorMsg,
    });
  } finally {
    setSubmitLoading(false);
  }
};
const handleUpdateStudent = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!editingStudent) return;

  try {
    setSubmitLoading(true);
    await api.put(`/lms/parent/students/${editingStudent.student_id || editingStudent.id}`, {
      display_name: editDisplayName,
      first_name: editFirstName,
      last_name: editLastName,
      email: editEmail,
      phone_number: editPhoneNumber,
      password: editPassword || undefined,
    });

    toast.success("Berhasil memperbarui", {
      description: `Profil partner ${editDisplayName} berhasil disimpan.`,
    });

    setIsEditOpen(false);
    fetchLinkedStudents();
  } catch (err: any) {
    const errorMsg =
      err.response?.data?.message || "Terjadi kesalahan saat memperbarui akun anak.";

    toast.error("Gagal memperbarui", {
      description: errorMsg,
    });
  } finally {
    setSubmitLoading(false);
  }
};
  return (
    <div className="space-y-6 p-12">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Akun Anak / Partner</h3>
          <p className="text-sm text-muted-foreground">
            Hubungkan akun belajar anak Anda untuk memantau progress materi dan
            kuis mereka.
          </p>
        </div>

        {/* Modal Tambah Anak */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Tambah Akun Anak
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
            <form
              onSubmit={
                addMode === "create" ? handleCreateStudent : handleLinkStudent
              }
            >
              <DialogHeader>
                <DialogTitle>Tambah Akun Anak</DialogTitle>
                <DialogDescription>
                  Buat akun belajar baru untuk anak atau hubungkan akun partner
                  yang sudah tersedia.
                </DialogDescription>
              </DialogHeader>
              <Tabs value={addMode} onValueChange={setAddMode} className="py-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="create">Buat Akun Baru</TabsTrigger>
                  <TabsTrigger value="link">Hubungkan Kode</TabsTrigger>
                </TabsList>
                <TabsContent value="create" className="mt-4 grid gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label
                        className="text-xs font-semibold"
                        htmlFor="newFirstName"
                      >
                        Nama Depan
                      </label>
                      <Input
                        id="newFirstName"
                        placeholder="Contoh: Samantha"
                        value={newStudent.first_name}
                        onChange={(e) =>
                          updateNewStudent("first_name", e.target.value)
                        }
                        maxLength={100}
                        disabled={submitLoading}
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        className="text-xs font-semibold"
                        htmlFor="newLastName"
                      >
                        Nama Belakang
                      </label>
                      <Input
                        id="newLastName"
                        placeholder="Contoh: Meliora"
                        value={newStudent.last_name}
                        onChange={(e) =>
                          updateNewStudent("last_name", e.target.value)
                        }
                        maxLength={100}
                        disabled={submitLoading}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label
                      className="text-xs font-semibold"
                      htmlFor="newDisplayName"
                    >
                      Nama Tampilan
                    </label>
                    <Input
                      id="newDisplayName"
                      placeholder="Contoh: Samantha Meliora."
                      value={newStudent.display_name}
                      onChange={(e) =>
                        updateNewStudent("display_name", e.target.value)
                      }
                      maxLength={20}
                      required
                      disabled={submitLoading}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label
                        className="text-xs font-semibold"
                        htmlFor="newUsername"
                      >
                        Username
                      </label>
                      <Input
                        id="newUsername"
                        placeholder="budi_pratama"
                        value={newStudent.username}
                        onChange={(e) =>
                          updateNewStudent(
                            "username",
                            e.target.value.toLowerCase()
                          )
                        }
                        minLength={3}
                        maxLength={12}
                        required
                        disabled={submitLoading}
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        className="text-xs font-semibold"
                        htmlFor="newPhone"
                      >
                        Nomor Telepon
                      </label>
                      <Input
                        id="newPhone"
                        placeholder="Contoh: 08123456789"
                        value={newStudent.phone_number}
                        onChange={(e) =>
                          updateNewStudent("phone_number", e.target.value)
                        }
                        maxLength={20}
                        disabled={submitLoading}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold" htmlFor="newEmail">
                      Email Login
                    </label>
                    <Input
                      id="newEmail"
                      type="email"
                      placeholder="samantha@codeverta.com"
                      value={newStudent.email}
                      onChange={(e) =>
                        updateNewStudent("email", e.target.value)
                      }
                      maxLength={50}
                      required
                      disabled={submitLoading}
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      className="text-xs font-semibold"
                      htmlFor="newPassword"
                    >
                      Password
                    </label>
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="Minimal 8 karakter"
                      value={newStudent.password}
                      onChange={(e) =>
                        updateNewStudent("password", e.target.value)
                      }
                      minLength={8}
                      maxLength={20}
                      required
                      disabled={submitLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Gunakan 8–20 karakter. Anak dapat langsung login setelah
                      akun dibuat.
                    </p>
                  </div>
                </TabsContent>
                <TabsContent value="link" className="mt-4 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Masukkan kode penghubung dari halaman profil akun LMS anak.
                  </p>
                  <Input
                    id="code"
                    placeholder="Contoh: CV-9831A"
                    value={linkingCode}
                    onChange={(e) =>
                      setLinkingCode(e.target.value.toUpperCase())
                    }
                    disabled={submitLoading}
                    maxLength={10}
                    className="tracking-wider uppercase font-mono text-center text-lg"
                  />
                </TabsContent>
              </Tabs>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={
                    submitLoading || (addMode === "link" && !linkingCode)
                  }
                >
                  {submitLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {addMode === "create" ? "Buat & Hubungkan" : "Hubungkan"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <hr className="border-border" />

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : students.length === 0 ? (
        /* Empty State */
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <User className="h-6 w-6 text-muted-foreground" />
            </div>
            <h4 className="mt-4 text-lg font-semibold">
              Belum ada akun terhubung
            </h4>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              Anda belum menghubungkan akun anak ke profil parent ini. Dapatkan
              kode hubung dari akun anak untuk memulai.
            </p>
          </CardContent>
        </Card>
      ) : (
        /* Daftar Partner */
        <div className="grid gap-4 md:grid-cols-2">
          {students.map((student) => (
            <Card key={student.id} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                    {student.avatar_url ? (
                      <img
                        src={student.avatar_url}
                        alt={student.full_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-sm font-medium">
                      {student.full_name || student.name}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {student.email || student.phone_number || "Partner"}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground hover:bg-accent"
                    onClick={() => handleStartEdit(student)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setStudentToUnlink(student)}
                  >
                    <UserX className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              {/* <CardContent className="flex justify-end pt-0">
                <Button variant="link" size="sm" className="gap-1 p-0 text-xs">
                  Lihat Progress Belajar <ArrowRight className="h-3 w-3" />
                </Button>
              </CardContent> */}
            </Card>
          ))}
        </div>
      )}

      {/* AlertDialog Konfirmasi Hapus Akses */}
      <AlertDialog
        open={!!studentToUnlink}
        onOpenChange={(open) => !open && setStudentToUnlink(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Apakah Anda yakin ingin menghapus akses?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus akses ke akun{" "}
              <span className="font-semibold text-foreground">
                {studentToUnlink?.full_name}
              </span>
              ? Anda tidak akan bisa melihat perkembangan belajar mereka lagi.
              <br />
              <br />
              <span className="text-xs text-muted-foreground">
                *Aksi ini hanya memutus hubungan data dan tidak akan menghapus
                akun partner dari platform Codeverta School.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitLoading}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleUnlinkStudent();
              }}
              className="bg-destructive hover:bg-destructive/90 text-white"
              disabled={submitLoading}
            >
              {submitLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Hapus Akses
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Edit Informasi Anak */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleUpdateStudent}>
            <DialogHeader>
              <DialogTitle>Edit Informasi Partner</DialogTitle>
              <DialogDescription>
                Perbarui detail informasi profil dan akun login untuk partner.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label
                    htmlFor="firstName"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Nama Depan
                  </label>
                  <Input
                    id="firstName"
                    placeholder="Nama Depan"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    disabled={submitLoading}
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="lastName"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Nama Belakang
                  </label>
                  <Input
                    id="lastName"
                    placeholder="Nama Belakang"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    disabled={submitLoading}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="displayName"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Nama Tampilan
                </label>
                <Input
                  id="displayName"
                  placeholder="Nama Lengkap / Tampilan"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  disabled={submitLoading}
                  required
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="email"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@domain.com"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  disabled={submitLoading}
                  required
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="phoneNumber"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Nomor Telepon
                </label>
                <Input
                  id="phoneNumber"
                  placeholder="0812xxxxxx"
                  value={editPhoneNumber}
                  onChange={(e) => setEditPhoneNumber(e.target.value)}
                  disabled={submitLoading}
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="password"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Ubah Password (Kosongkan jika tidak diubah)
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimal 8 karakter"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  disabled={submitLoading}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                disabled={submitLoading}
              >
                Batal
              </Button>
              <Button type="submit" disabled={submitLoading}>
                {submitLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Simpan Perubahan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}


export default DashboardLayout(ChildrenSettings)
