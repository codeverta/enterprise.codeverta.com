"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Send, AlertTriangle, Loader2 } from "lucide-react";

// Import komponen Shadcn (sesuaikan path import dengan struktur project Anda)
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Definisikan tipe data untuk Template
interface Template {
  id: string;
  name: string;
  tencent_template_id: number;
}

export default function BulkEmailDialog({isProcessing}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const disabled = isProcessing

  // Ambil list template saat Dialog dibuka
  useEffect(() => {
    if (open) {
      fetchTemplates();
      setSuccess(null);
      setError(null);
      setSelectedTemplate("");
    }
  }, [open]);

  const fetchTemplates = async () => {
    setFetching(true);
    try {
      // Ganti dengan endpoint list template Anda
      const response = await api.get("/templates");
      setTemplates(response.data.data || []);
    } catch (err) {
      console.error(err);
      setError("Gagal memuat daftar template.");
    } finally {
      setFetching(false);
    }
  };

  const handleSend = async () => {
    if (!selectedTemplate) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // POST ke endpoint SendBulkEmail yang baru kita buat
      const response = await api.post("/email/send-broadcast", {
        template_id: selectedTemplate,
      });

      setSuccess(
        `Berhasil! ${response.data.target_count} email sedang diproses di background.`
      );

      // Reset form setelah sukses (opsional: bisa langsung tutup dialog)
      setTimeout(() => setOpen(false), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || "Gagal mengirim broadcast.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="default"
          className="bg-blue-600 hover:bg-blue-700 text-white"
          disabled={disabled}
        >
          {disabled ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Email Sedang Diproses
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Broadcast Peserta
            </>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Kirim Broadcast Email</DialogTitle>
          <DialogDescription>
            Pilih template untuk dikirim ke seluruh peserta (Paid). Sistem akan
            menggunakan antrian lambat (500 email/hari).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Status Message */}
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded border border-red-200">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 text-sm text-green-600 bg-green-50 rounded border border-green-200">
              {success}
            </div>
          )}

          {/* Form Input */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="template" className="text-right">
              Template
            </Label>
            <div className="col-span-3">
              <Select
                value={selectedTemplate}
                onValueChange={setSelectedTemplate}
                disabled={fetching || loading}
              >
                <SelectTrigger id="template" className="w-full">
                  <SelectValue
                    placeholder={fetching ? "Memuat..." : "Pilih Template"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name} (ID: {tpl.tencent_template_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Warning Info */}
          <Alert
            variant="default"
            className="bg-yellow-50 border-yellow-200 text-yellow-800"
          >
            <AlertTriangle className="h-4 w-4 stroke-yellow-600" />
            <AlertTitle>Perhatian Mode Santai</AlertTitle>
            <AlertDescription className="text-xs">
              Email tidak akan terkirim instan. Worker akan mengirim 1 email
              setiap ~3 menit untuk menjaga reputasi server dan kuota harian.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Batal
          </Button>
          <Button
            onClick={handleSend}
            disabled={!selectedTemplate || loading || fetching}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memproses...
              </>
            ) : (
              "Mulai Broadcast"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
