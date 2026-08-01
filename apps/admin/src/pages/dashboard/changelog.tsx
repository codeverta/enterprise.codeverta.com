import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  GitCommit,
  CheckCircle,
  Sparkles,
  Shield,
  Layers,
  ArrowLeft,
  Clock,
} from "lucide-react";
import { Link } from "react-router";
import DashboardLayout from "@/layout/DashboardLayout";

interface ChangelogItem {
  version: string;
  date: string;
  category: "Major" | "Minor" | "Hotfix";
  changes: {
    title: string;
    description: string;
    type: "feature" | "improvement" | "fix" | "security";
  }[];
}

const changelogData: ChangelogItem[] = [
  {
    version: "v2.1.0",
    date: "8 Juli 2026",
    category: "Major",
    changes: [
      {
        title: "Sistem Role & Otorisasi Mentor Eksternal",
        description: "Refaktorisasi role hardcode ke konstanta terpusat ROLES. Menambahkan guard hak akses penuh bagi Role (External Mentor) untuk mengakses semua halaman/fitur milik Role 30 (Instructor) secara aman.",
        type: "feature",
      },
      {
        title: "Isolasi Keamanan & Data untuk",
        description: "Membatasi visibilitas daftar kelas, statistik kelas, progress pembelajaran siswa, dan jadwal template belajar agar mentor eksternal hanya dapat mengakses siswa dan kelas milik mereka sendiri.",
        type: "security",
      },
      {
        title: "Perbaikan MySQL Table Name Error",
        description: "Menyelaraskan kueri database untuk progress siswa dari tabel singular ke plural (student_progresses) sesuai aturan GORM, menyelesaikan error 500 internal server.",
        type: "fix",
      },
    ],
  },
  {
    version: "v2.0.0",
    date: "7 Juli 2026",
    category: "Major",
    changes: [
      {
        title: "Redesain UI Checkout Premium & Dinamis",
        description: "Mengganti halaman checkout statis dengan desain e-commerce premium yang responsif. Mengintegrasikan biaya admin dan handling fee dinamis langsung dari API Payment Gateway, bukan hardcode.",
        type: "feature",
      },
      {
        title: "Auto-repair Database untuk Slug Berlangganan",
        description: "Menambahkan fungsi migrasi startup di backend untuk mendeteksi dan memperbaiki slug paket langganan yang kosong secara otomatis dengan format berbasis nama unik.",
        type: "fix",
      },
      {
        title: "Fitur Pencarian, Paginasi, & Filter Mentor Baru",
        description: "Menerapkan paginasi, pencarian server-side, filter berbasis mentor, dan tampilan avatar mentor pada daftar kelas admin. Menggunakan endpoint statistik independen untuk menghitung total status kelas.",
        type: "feature",
      },
      {
        title: "Integrasi Real Data Dashboard Orang Tua",
        description: "Menghubungkan pricing list berlangganan di Dashboard Orang Tua langsung dengan database melalui API backend, menggantikan data statis.",
        type: "improvement",
      },
    ],
  },
  {
    version: "v1.9.0",
    date: "6 Juli 2026",
    category: "Minor",
    changes: [
      {
        title: "Koreksi Alur Unit & Lesson Editor",
        description: "Memperbaiki bug redirect editor di mana tombol unit baru malah menampilkan editor lesson. Menambahkan sidebar scrollbar yang responsif pada editor modul.",
        type: "fix",
      },
      {
        title: "Batasan Karakter Input & Validasi Upload",
        description: "Menambahkan indikator jumlah karakter maksimum (0/X) untuk judul unit, judul lesson, deskripsi, konten, serta validasi max file size pendukung.",
        type: "improvement",
      },
    ],
  },
];

function ChangelogPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-600">
              <Sparkles className="h-4 w-4" />
              <span>Pembaruan Aplikasi</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900">
              Changelog
            </h1>
            <p className="text-gray-500">
              Catatan pembaruan fitur, perbaikan bug, dan peningkatan sistem pada KITA Future Homeschool.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-4 h-10 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Dashboard
          </Link>
        </div>

        {/* Timeline */}
        <div className="relative border-l border-gray-200 ml-4 md:ml-6 space-y-12">
          {changelogData.map((item, index) => (
            <div key={item.version} className="relative pl-8 md:pl-10">
              {/* Dot Icon */}
              <span className="absolute -left-[17px] top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 border border-blue-200 text-blue-600 shadow-sm">
                <GitCommit className="h-4 w-4" />
              </span>

              {/* Version Block */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-2xl font-black text-gray-900 tracking-tight">
                    {item.version}
                  </span>
                  <Badge
                    variant="secondary"
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      item.category === "Major"
                        ? "bg-blue-100 text-blue-700"
                        : item.category === "Minor"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {item.category} Release
                  </Badge>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{item.date}</span>
                  </div>
                </div>

                {/* Changes List */}
                <div className="grid gap-4">
                  {item.changes.map((change, i) => (
                    <Card
                      key={i}
                      className="border border-gray-200/60 bg-white/80 shadow-sm backdrop-blur transition-all hover:shadow-md hover:border-gray-300"
                    >
                      <CardContent className="p-5 flex gap-4">
                        <span
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white ${
                            change.type === "feature"
                              ? "bg-emerald-500"
                              : change.type === "fix"
                              ? "bg-red-500"
                              : change.type === "security"
                              ? "bg-indigo-600"
                              : "bg-amber-500"
                          }`}
                        >
                          {change.type === "feature" ? (
                            <Sparkles className="h-3.5 w-3.5" />
                          ) : change.type === "fix" ? (
                            <CheckCircle className="h-3.5 w-3.5" />
                          ) : change.type === "security" ? (
                            <Shield className="h-3.5 w-3.5" />
                          ) : (
                            <Layers className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <div className="space-y-1">
                          <h4 className="font-bold text-gray-900 text-sm md:text-base">
                            {change.title}
                          </h4>
                          <p className="text-sm text-gray-600 leading-relaxed">
                            {change.description}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const WrappedChangelogPage = DashboardLayout(ChangelogPage);
export default WrappedChangelogPage;
