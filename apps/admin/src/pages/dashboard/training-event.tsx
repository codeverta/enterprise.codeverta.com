import { useState, useEffect } from "react";
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import { toast } from "sonner";
import { 
  Calendar as CalendarIcon, 
  MapPin, 
  Plus, 
  Trash2, 
  Clock, 
  ExternalLink 
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/api"; // Asumsi axios instance Anda
import DashboardLayout from "../../layout/DashboardLayout";

// --- UTILITY GOOGLE CALENDAR ---
const generateGoogleCalendarUrl = (event) => {
  const formatDate = (dateString) => {
    // Convert ke format YYYYMMDDTHHmmssZ
    return new Date(dateString).toISOString().replace(/-|:|\.\d\d\d/g, "");
  };

  const start = formatDate(event.start_time);
  const end = formatDate(event.end_time);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
    details: event.description,
    location: event.location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

function TrainingManager() {
  const [events, setEvents] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [meta, setMeta] = useState({ current_page: 1, total_pages: 1 });
  const [formData, setFormData] = useState({
    title: "",
    location: "",
    start_time: "",
    end_time: "",
    registration_url: "",
    description: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async (page = 1) => {
    try {
      const res = await api.get(`/trainings?page=${page}&limit=5`);
      setEvents(res.data.data || []);
    } catch (error) {
      console.error(error);
      toast.error("Gagal memuat jadwal");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      // Validasi sederhana: Pastikan End Time > Start Time
      if (new Date(formData.end_time) <= new Date(formData.start_time)) {
        toast.warning("Waktu selesai harus lebih besar dari waktu mulai");
        return;
      }

      await api.post("/trainings", {
        ...formData,
        // Pastikan format ISO string dikirim ke Go
        start_time: formData.start_time ? new Date(formData.start_time).toISOString() : undefined,
        end_time: formData.end_time ? new Date(formData.end_time).toISOString() : undefined,
      });
      
      toast.success("Jadwal latihan berhasil dibuat");
      setIsOpen(false);
      fetchEvents();
      setFormData({ title: "", location: "", start_time: "", end_time: "", description: "" });
    } catch (error) {
      console.error(error);
      toast.error("Gagal menyimpan data");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Hapus jadwal ini?")) {
      await api.delete(`/trainings/${id}`);
      fetchEvents();
    }
  };

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8 max-w-screen-2xl mx-auto space-y-6">
      <header className="flex mb-6 justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Jadwal latihan Komunitas
          </h1>
          <p className="text-muted-foreground">Kelola agenda latihan</p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Tambah Jadwal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buat Jadwal Latihan Baru</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Judul Kegiatan</Label>
                <Input
                  required
                  placeholder="Contoh: Latihan Rutin Minggu Pagi"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mulai</Label>
                  <Input
                    type="datetime-local"
                    required
                    value={formData.start_time}
                    onChange={(e) =>
                      setFormData({ ...formData, start_time: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Selesai</Label>
                  <Input
                    type="datetime-local"
                    value={formData.end_time}
                    onChange={(e) =>
                      setFormData({ ...formData, end_time: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Lokasi</Label>
                <Input
                  placeholder="Contoh: GOR Soemantri"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Deskripsi/Catatan</Label>
                <Textarea
                  placeholder="Detail perlengkapan, dresscode, dll..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Link Pendaftaran (Google Forms)</Label>
                <Input
                  type="url"
                  placeholder="https://forms.gle/..."
                  value={formData.registration_url}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      registration_url: e.target.value,
                    })
                  }
                />
              </div>
              {loading ? (
                <Button disabled className="w-full">
                  Menyimpan...
                </Button>
              ) : (
                <Button type="submit" className="w-full">
                  Simpan Jadwal
                </Button>
              )}
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-1 gap-4">
        {events.length === 0 && (
          <p className="text-center mt-20 text-slate-500 col-span-full">
            Belum ada jadwal latihan. Tambahkan jadwal baru menggunakan tombol
            di atas.
          </p>
        )}
        {events.map((event) => (
          <Card
            key={event.id}
            className="hover:shadow-md transition-shadow border-l-4 border-l-indigo-500"
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg font-semibold leading-tight">
                  {event.title}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-500 h-8 w-8 -mr-2"
                  onClick={() => handleDelete(event.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Badge variant="secondary" className="w-fit mt-1">
                {event.description ? "Ada Catatan" : "Reguler"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {/* Waktu */}
              <div className="flex items-start gap-2 text-slate-600">
                <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-medium text-slate-900">
                    {dayjs(event.start_time)
                      .locale("id")
                      .format("dddd, DD MMMM YYYY")}
                  </span>
                  <span>
                    {dayjs(event.start_time).format("HH:mm")} WIB -{" "}
                    {`${
                      event.end_time
                        ? dayjs(event.end_time).format("HH:mm") + " WIB"
                        : "Selesai"
                    }`}
                  </span>
                </div>
              </div>

              {/* Lokasi */}
              {event.location && (
                <div className="flex items-start gap-2 text-slate-600">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{event.location}</span>
                </div>
              )}

              {/* Deskripsi (Optional) */}
              {event.description && (
                <div className="bg-slate-50 p-2 rounded text-xs text-slate-600 line-clamp-2">
                  {event.description}
                </div>
              )}
              {event.registration_url && (
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  asChild
                >
                  <a
                    href={event.registration_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Link Pendaftaran (Google Form)
                  </a>
                </Button>
              )}
              {/* Tombol Simpan ke Calendar */}
              <Button
                variant="outline"
                className="w-full mt-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                asChild
              >
                <a
                  href={generateGoogleCalendarUrl(event)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  Simpan ke Google Calendar
                  <ExternalLink className="w-3 h-3 ml-1 opacity-50" />
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex justify-center items-center gap-4 mt-8">
        <Button
          variant="outline"
          disabled={meta.current_page === 1}
          onClick={() => fetchEvents(meta.current_page - 1)}
        >
          Previous
        </Button>
        <span className="text-sm">
          Halaman {meta.current_page} dari {meta.total_pages}
        </span>
        <Button
          variant="outline"
          disabled={meta.current_page === meta.total_pages}
          onClick={() => fetchEvents(meta.current_page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export default DashboardLayout(TrainingManager);