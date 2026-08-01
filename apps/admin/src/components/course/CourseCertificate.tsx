import React, { useEffect, useState } from "react";
import { Award, Download, Loader2, ArrowLeft } from "lucide-react";
import dayjs from "dayjs";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";

interface CertificateData {
  completed: boolean;
  completed_lessons: number;
  total_lessons: number;
  student_name: string;
  course_title: string;
  completion_date: string;
  course_id: string;
  certificate_id: string;
  certificate_url?: string;
  has_custom_template?: boolean;
}

interface CourseCertificateProps {
  courseId: string;
  onBack?: () => void;
}

function CourseCertificate({ courseId, onBack }: CourseCertificateProps) {
  const [cert, setCert] = useState<CertificateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notComplete, setNotComplete] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });

  useEffect(() => {
    fetchCertificate();
  }, [courseId]);

  const fetchCertificate = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/lms/courses/${courseId}/certificate`);
      const data = res.data?.data || res.data;
      if (data?.completed) {
        setCert(data);
      } else {
        setNotComplete(true);
        setProgress({
          completed: data?.completed_lessons || 0,
          total: data?.total_lessons || 0,
        });
      }
    } catch (err: any) {
      const data = err.response?.data?.data;
      if (data) {
        setProgress({
          completed: data.completed_lessons || 0,
          total: data.total_lessons || 0,
        });
      }
      setNotComplete(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Memuat sertifikat...
      </div>
    );
  }

  if (notComplete || !cert) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-6">
        <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
          <Award className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-bold text-slate-900">
            Sertifikat Belum Tersedia
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Selesaikan semua lesson di course ini untuk mendapatkan sertifikat.
          </p>
          {progress.total > 0 && (
            <div className="mt-4">
              <div className="text-sm text-slate-600">
                Progress: {progress.completed} / {progress.total} lesson selesai
              </div>
              <div className="mt-2 h-2 w-48 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{
                    width: `${(progress.completed / progress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
          {onBack && (
            <Button variant="outline" className="mt-4" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
            </Button>
          )}
        </div>
      </div>
    );
  }

  const completionDate = dayjs(cert.completion_date).format("DD MMMM YYYY");
  const certificateId = cert.certificate_id.slice(0, 8).toUpperCase();
  const hasCustomCertificate = !!cert.certificate_url;

  return (
    <div className="space-y-4">
      {/* Print button */}
      <div className="no-print flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Sertifikat Kelulusan</h2>
          <p className="text-sm text-slate-500">
            Selamat! Kamu telah menyelesaikan course ini.
          </p>
        </div>
        <div className="flex gap-2">
          {hasCustomCertificate && (
            <Button asChild variant="outline">
              <a
                href={cert.certificate_url}
                download={`certificate-${certificateId}.jpg`}
              >
                <Download className="mr-2 h-4 w-4" /> Unduh
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Certificate */}
      <div className="flex justify-center">
        {hasCustomCertificate ? (
          <img
            id="certificate-printable"
            src={cert.certificate_url}
            alt={`Sertifikat ${cert.student_name}`}
            className="w-full max-w-[900px] rounded-2xl border bg-white object-contain shadow-xl print:shadow-none print:border-0"
          />
        ) : (
          <div
            id="certificate-printable"
            className="w-full max-w-[800px] overflow-hidden rounded-2xl border-2 border-amber-200 bg-white shadow-xl print:shadow-none print:border-0"
            style={{ aspectRatio: "1.414/1" }}
          >
            <div className="relative flex h-full flex-col items-center justify-center p-8 md:p-12">
              {/* Decorative border */}
              <div className="pointer-events-none absolute inset-4 rounded-xl border-2 border-dashed border-amber-300 md:inset-6" />
              <div className="pointer-events-none absolute inset-6 rounded-lg border border-amber-200 md:inset-8" />

              {/* Corner decorations */}
              <div className="pointer-events-none absolute left-8 top-8 text-3xl text-amber-300 md:left-12 md:top-12">
                ❧
              </div>
              <div className="pointer-events-none absolute right-8 top-8 rotate-180 text-3xl text-amber-300 md:right-12 md:top-12">
                ❧
              </div>
              <div className="pointer-events-none absolute bottom-8 left-8 rotate-180 text-3xl text-amber-300 md:bottom-12 md:left-12">
                ❧
              </div>
              <div className="pointer-events-none absolute bottom-8 right-8 text-3xl text-amber-300 md:bottom-12 md:right-12">
                ❧
              </div>

              {/* Content */}
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
                  <Award className="h-10 w-10 text-amber-600" />
                </div>

                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-600">
                  Certificate of Completion
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                  Sertifikat Kelulusan
                </h1>

                <div className="my-6 flex items-center gap-3">
                  <div className="h-px w-16 bg-amber-300" />
                  <div className="h-2 w-2 rotate-45 bg-amber-400" />
                  <div className="h-px w-16 bg-amber-300" />
                </div>

                <p className="text-sm text-slate-500">Diberikan kepada</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">
                  {cert.student_name}
                </h2>

                <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-500">
                  Telah berhasil menyelesaikan seluruh materi pembelajaran pada
                  course
                </p>
                <p className="mt-1 text-lg font-semibold text-blue-600">
                  {cert.course_title}
                </p>

                <div className="mt-8 flex items-center gap-8">
                  <div className="text-center">
                    <p className="text-xs text-slate-400">Tanggal Kelulusan</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {completionDate}
                    </p>
                  </div>
                  <div className="h-8 w-px bg-slate-200" />
                  <div className="text-center">
                    <p className="text-xs text-slate-400">ID Sertifikat</p>
                    <p className="mt-1 font-mono text-sm font-semibold text-slate-700">
                      {certificateId}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          #certificate-printable,
          #certificate-printable * {
            visibility: visible !important;
          }
          #certificate-printable {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 100%;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

export default CourseCertificate;
