// Contoh di file: src/pages/admin/ManageDocumentsPage.jsx
import DashboardLayout from "@/layout/DashboardLayout";
import DocumentManager from "@/components/crud/DocumentManager"; // Sesuaikan path

function ManageDocumentsPage() {
  return (
    <DocumentManager
      viewMode="admin"
      title="Manajemen Dokumen"
      description="Unggah, cari, dan kelola semua dokumen Anda di satu tempat."
    />
  );
}

export default DashboardLayout(ManageDocumentsPage);
