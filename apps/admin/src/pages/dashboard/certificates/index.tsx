import React, { useEffect, useState } from "react";
import { Award, Download, Loader2, ExternalLink } from "lucide-react";
import { Link } from "react-router";
import dayjs from "dayjs";
import { toast } from "sonner";
import api from "@/lib/api";
import DashboardLayout from "@/layout/DashboardLayout";
import { Button } from "@/components/ui/button";

interface StudentCertificate {
  id: string;
  course_id: string;
  course: {
    id: string;
    title: string;
    cover_image_url: string;
  };
  certificate_url?: string;
  issued_at: string;
  created_at: string;
}

function CertificatesPage() {
  const [certs, setCerts] = useState<StudentCertificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCertificates();
  }, []);

  const fetchCertificates = async () => {
    setLoading(true);
    try {
      const res = await api.get("/lms/my-certificates");
      const data = res.data?.data || res.data || [];
      setCerts(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Gagal memuat sertifikat");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">
          Memuat sertifikat...
        </span>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8 max-w-screen-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sertifikat Saya</h1>
        <p className="text-sm text-slate-500">
          Daftar sertifikat yang telah kamu peroleh dari course yang
          diselesaikan.
        </p>
      </div>

      {certs.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white p-8">
          <Award className="h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-700">
            Belum Ada Sertifikat
          </h2>
          <p className="mt-2 max-w-sm text-center text-sm text-slate-500">
            Selesaikan seluruh materi pada suatu course untuk mendapatkan
            sertifikat kelulusan.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => (window.location.href = "/dashboard/courses")}
          >
            Lihat Course
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {certs.map((cert) => (
            <div
              key={cert.id}
              className="group overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md"
            >
              {/* Certificate Preview */}
              <div className="relative aspect-[1.414/1] overflow-hidden bg-slate-100">
                {cert.certificate_url ? (
                  <img
                    src={cert.certificate_url}
                    alt={`Sertifikat ${cert.course?.title}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center border-8 border-double border-amber-100 bg-white p-5 text-center">
                    <Award className="h-12 w-12 text-amber-500" />
                    <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-600">
                      Certificate of Completion
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm font-bold text-slate-800">
                      {cert.course?.title || "Course"}
                    </p>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="truncate text-sm font-semibold text-slate-900">
                  {cert.course?.title || "Course"}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Diterbitkan:{" "}
                  {dayjs(cert.issued_at || cert.created_at).format(
                    "DD MMMM YYYY"
                  )}
                </p>

                <div className="mt-3 flex gap-2">
                  <Link
                    to={`/dashboard/courses/${cert.course_id}?view=true&tab=certificate`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Lihat
                  </Link>
                  {cert.certificate_url && (
                    <a
                      href={cert.certificate_url}
                      download={`certificate-${cert.id.slice(0, 8)}.jpg`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Unduh
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DashboardLayout(CertificatesPage);
