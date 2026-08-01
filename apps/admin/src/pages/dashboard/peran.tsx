import React, { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import DashboardLayout from "../../layout/DashboardLayout";

function Roles() {
  // State untuk data dan UI
  const [roles, setRoles] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  const [allPermissions, setAllPermissions] = useState([]);

  // State untuk form Role
  const [roleName, setRoleName] = useState("");
  const [editingRole, setEditingRole] = useState(null);

  // State untuk form Permission
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedPermissions, setSelectedPermissions] = useState(new Set());

  // State untuk pencarian dan pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [paginationData, setPaginationData] = useState({
    currentPage: 1,
    lastPage: 1,
  });

  // Debounce effect untuk input pencarian
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPaginationData((prev) => ({ ...prev, currentPage: 1 }));
    }, 500);

    return () => {
      clearTimeout(timerId);
    };
  }, [searchTerm]);

  // Fungsi untuk mengambil data dari API
  const fetchRoles = useCallback(async (page = 1, search = "") => {
    try {
      const response = await api.get("/roles", {
        params: {
          page: page,
          search: search,
        },
      });
      setRoles(response.data.data);
      setPaginationData({
        currentPage: response.data.meta.current_page,
        lastPage: response.data.meta.last_page,
      });
    } catch (error) {
      console.error("Gagal mengambil data roles:", error);
    }
  }, []);

  // Fungsi untuk mengambil semua permission
  const fetchAllPermissions = useCallback(async () => {
    try {
      const response = await api.get("/permissions");
      setAllPermissions(response.data.data);
    } catch (error) {
      console.error("Gagal mengambil data permissions:", error);
    }
  }, []);

  // Effect untuk mengambil data saat halaman berubah atau pencarian di-submit
  useEffect(() => {
    fetchRoles(paginationData.currentPage, debouncedSearchTerm);
    fetchAllPermissions();
  }, [
    paginationData.currentPage,
    debouncedSearchTerm,
    fetchRoles,
    fetchAllPermissions,
  ]);

  // Handler untuk form submit (Create & Update Role)
  const handleRoleFormSubmit = async (e) => {
    e.preventDefault();
    const roleData = { name: roleName };

    try {
      if (editingRole) {
        await api.put(`/roles/${editingRole.id}`, roleData);
      } else {
        await api.post("/roles", roleData);
      }
      resetRoleForm();
      fetchRoles(paginationData.currentPage, debouncedSearchTerm);
    } catch (error) {
      console.error("Gagal menyimpan role:", error);
    }
  };

  // Handler untuk membuka dialog edit role
  const handleEditRole = (role) => {
    setEditingRole(role);
    setRoleName(role.name);
    setIsDialogOpen(true);
  };

  // Handler untuk membuka dialog permission
  const handleManagePermissions = async (role) => {
    setSelectedRole(role);
    try {
      const response = await api.get(`/roles/${role.id}/permissions`);
      const permissionsSet = new Set(response.data.data.map((perm) => perm.id));
      setSelectedPermissions(permissionsSet);
      setIsPermissionDialogOpen(true);
    } catch (error) {
      console.error("Gagal mengambil permissions role:", error);
    }
  };

  // Handler untuk toggle checkbox permission
  const handlePermissionToggle = (permissionId) => {
    setSelectedPermissions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(permissionId)) {
        newSet.delete(permissionId);
      } else {
        newSet.add(permissionId);
      }
      return newSet;
    });
  };

  // Handler untuk submit perubahan permission
  const handlePermissionSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/roles/${selectedRole.id}/permissions`, {
        permissions: Array.from(selectedPermissions),
      });
      setIsPermissionDialogOpen(false);
      // Tidak perlu refresh data roles karena hanya permission yang berubah
    } catch (error) {
      console.error("Gagal menyimpan permissions:", error);
    }
  };

  // Fungsi untuk mereset form role dan menutup dialog
  const resetRoleForm = () => {
    setRoleName("");
    setEditingRole(null);
    setIsDialogOpen(false);
  };

  // Handler untuk navigasi halaman
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= paginationData.lastPage) {
      setPaginationData((prev) => ({ ...prev, currentPage: newPage }));
    }
  };

  // Handler untuk menghapus data (dihapus sesuai permintaan)
  // const handleDelete = ... (dihapus)

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex items-center justify-between mb-6 w-full">
        <div className="w-full">
          <h1 className="text-3xl font-bold tracking-tight">Manajemen Role</h1>
          <p className="text-slate-500 mt-1">
            {
              "Kelola Peran pengguna di sini. Atur role dan permission yang sesuai."
            }
          </p>
          <div>
            <div className="flex justify-between items-center my-4">
              <Input
                placeholder="Cari nama role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => resetRoleForm()}>Tambah Role</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>
                      {editingRole ? "Edit Role" : "Tambah Role Baru"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingRole
                        ? `Mengubah role ${editingRole.name}`
                        : "Buat role baru di sini."}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleRoleFormSubmit}>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                          Nama
                        </Label>
                        <Input
                          id="name"
                          value={roleName}
                          onChange={(e) => setRoleName(e.target.value)}
                          className="col-span-3"
                          required
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit">
                        {editingRole ? "Simpan Perubahan" : "Buat Role"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Role</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.length > 0 ? (
                    roles.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell className="font-medium">
                          {role.name}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditRole(role)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleManagePermissions(role)}
                          >
                            Atur Permission
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={2} className="h-24 text-center">
                        Tidak ada data.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-end space-x-2 py-4">
              <span className="text-sm text-muted-foreground">
                Halaman {paginationData.currentPage} dari{" "}
                {paginationData.lastPage}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(paginationData.currentPage - 1)}
                disabled={paginationData.currentPage === 1}
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(paginationData.currentPage + 1)}
                disabled={
                  paginationData.currentPage === paginationData.lastPage
                }
              >
                Selanjutnya
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Dialog untuk mengelola Permission */}
      <Dialog
        open={isPermissionDialogOpen}
        onOpenChange={setIsPermissionDialogOpen}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Atur Permission</DialogTitle>
            <DialogDescription>
              Mengatur permission untuk role **{selectedRole?.name}**.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePermissionSubmit}>
            <div className="grid gap-4 py-4 max-h-[400px] overflow-y-auto">
              {allPermissions.length > 0 ? (
                allPermissions.map((permission) => (
                  <div
                    key={permission.id}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox
                      id={`permission-${permission.id}`}
                      checked={selectedPermissions.has(permission.id)}
                      onCheckedChange={() =>
                        handlePermissionToggle(permission.id)
                      }
                    />
                    <Label htmlFor={`permission-${permission.id}`}>
                      {permission.name}
                    </Label>
                  </div>
                ))
              ) : (
                <div className="text-center text-slate-500">
                  Tidak ada permission yang tersedia.
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="submit">Simpan Permission</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DashboardLayout(Roles);
