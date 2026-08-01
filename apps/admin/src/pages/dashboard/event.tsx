import React, { useState, useEffect } from "react";
import { 
  Plus, Calendar, Pencil, Trash2, MoreHorizontal, 
  Ticket, ArrowLeft, DollarSign, 
  ClipboardList
} from "lucide-react";
import dayjs from "dayjs";
import api from "@/lib/api"; // Sesuaikan path
import { toast } from "sonner";
import DashboardLayout from "../../layout/DashboardLayout";
import { Switch } from "@/components/ui/switch"; 
// --- SHADCN UI IMPORTS ---
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate, useParams } from "react-router";
import CategoryDialog from "../../components/price-category/CategoryDialog";

// ==========================================
// MAIN PARENT COMPONENT
// ==========================================
function UnifiedEventManager() {
  // Gunakan hooks dari router
  const { id } = useParams(); 
  const navigate = useNavigate();

  // Logika: Jika ada ID di URL, tampilkan Ticket Manager.
  // Jika tidak, tampilkan List.
  if (id) {
    return (
      <TicketManagerView 
        eventId={id} // Kirim ID, bukan object event utuh
        onBack={() => navigate('/dashboard/events')} // Kembali ke URL dasar
      />
    );
  }

  return <EventListView onSelectEvent={(eventId) => navigate(`/dashboard/events/${eventId}`)} />;
}

// ==========================================
// VIEW 1: EVENT LIST (Halaman Depan)
// ==========================================
function EventListView({ onSelectEvent }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const fetchEvents = async () => {
    try {
      const res = await api.get("/events");
      setEvents(res.data);
    } catch (error) {
      toast.error("Gagal mengambil data event");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, []);

  const handleDelete = async (id) => {
    if (!confirm("Hapus event ini?")) return;
    try {
      await api.delete(`/events/${id}`);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      toast.success("Event dihapus");
    } catch (error) {
      toast.error("Gagal menghapus event");
    }
  };

  const handleToggleActive = async (event, checked) => {
    if (updatingId) return;
    setUpdatingId(event.id);
    try {
      await api.put(`/events/${event.id}`, { is_active: checked });
      toast.success(checked ? "Event diaktifkan" : "Event dinonaktifkan");
      await fetchEvents(); 
    } catch (error) {
      toast.error("Gagal update status");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8 max-w-screen-2xl mx-auto space-y-6">
      <div className="flex mb-6 justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Events</h1>
          <p className="text-muted-foreground">
            Kelola event lari dan jadwalnya.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingEvent(null);
            setIsModalOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Tambah Event
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-10">Loading events...</div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event Name</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tickets</TableHead> {/* Kolom Baru */}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                    No events found.
                  </TableCell>
                </TableRow>
              ) : (
                events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="text-base">{event.name}</span>
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {event.description || "No description"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="mr-2 h-3 w-3" />
                        {dayjs(event.start_date).format("DD MMM YYYY")}
                      </div>
                    </TableCell>
                    <TableCell>
                      {dayjs(event.created_at).format("DD/MM/YYYY")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={event.is_active}
                          disabled={updatingId === event.id}
                          onCheckedChange={(checked) =>
                            handleToggleActive(event, checked)
                          }
                        />
                        <span className="text-xs text-muted-foreground">
                          {event.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </TableCell>

                    {/* Kolom Manage Ticket Langsung */}
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => onSelectEvent(event.id)}
                      >
                        <Ticket className="h-4 w-4" />
                        Atur Tiket
                      </Button>
                    </TableCell>

                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingEvent(event);
                              setIsModalOpen(true);
                            }}
                          >
                            <Pencil className="mr-2 h-3.5 w-3.5" /> Edit Event
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(event.id)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
      <EventDialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        event={editingEvent}
        onSuccess={fetchEvents}
      />
    </div>
  );
}

// ==========================================
// VIEW 2: TICKET MANAGER (Halaman Detail)
// ==========================================
function TicketManagerView({ eventId, onBack }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  // State baru untuk menyimpan detail event saat refresh
  const [eventDetail, setEventDetail] = useState(null); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  // 1. Fetch Categories
  const fetchCategories = async () => {
    try {
      const res = await api.get(`/categories?event_id=${eventId}`);
      setCategories(res.data);
    } catch (error) {
      toast.error("Error fetching categories");
    }
  };

  // 2. Fetch Event Detail (Agar nama event tidak hilang saat refresh)
  const fetchEventDetail = async () => {
    try {
      const res = await api.get(`/events/${eventId}`);
      setEventDetail(res.data);
    } catch (error) {
      toast.error("Gagal mengambil detail event");
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchCategories(), fetchEventDetail()]);
      setLoading(false);
    };
    if(eventId) init();
  }, [eventId]);

  const handleDeleteCategory = async (id) => {
    if (!confirm("Are you sure?")) return;
    try {
      await api.delete(`/categories/${id}`);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      toast.warning("Category deleted");
    } catch (error) {
      toast.error("Failed to delete category");
    }
  };

  if (loading) return <div className="p-10 text-center">Loading ticket data...</div>;
  if (!eventDetail) return <div className="p-10 text-center text-red-500">Event not found</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <Button variant="outline" className="w-fit" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4"/> Back to Events
        </Button>
        <div className="flex justify-between items-center mt-2">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Ticket Management</h1>
                {/* Gunakan data dari fetch eventDetail */}
                <p className="text-muted-foreground text-lg">Event: <span className="font-semibold text-foreground">{eventDetail.name}</span></p>
            </div>
            <Button onClick={() => { setEditingCategory(null); setIsModalOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Category
            </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {categories.map((cat) => (
          <CategoryCard
            key={cat.id}
            category={cat}
            event={eventDetail} 
            onDelete={() => handleDeleteCategory(cat.id)}
            onEdit={() => { setEditingCategory(cat); setIsModalOpen(true); }}
          />
        ))}
      </div>

      <CategoryDialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        category={editingCategory}
        eventId={eventId}
        onSuccess={fetchCategories}
      />
    </div>
  );
}
// ==========================================
// SUB-COMPONENT: CATEGORY CARD
// ==========================================
function CategoryCard({ category, onDelete, onEdit }) {
  const [prices, setPrices] = useState([]);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState(null);

  const fetchPrices = async () => {
    try {
      const res = await api.get(`/prices?category_id=${category.id}`);
      setPrices(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => { fetchPrices(); }, [category.id]);

  const handleDeletePrice = async (priceId) => {
    if (!confirm("Delete this price?")) return;
    try {
      await api.delete(`/prices/${priceId}`);
      setPrices((prev) => prev.filter((p) => p.id !== priceId));
      toast.success("Price deleted");
    } catch (error) {
      toast.error("Failed delete price");
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="bg-muted/20">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Ticket className="h-5 w-5 text-primary" />{category.name}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Distance: {category.distance_km} KM</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
{category.requirements && category.requirements.length > 0 && (
          <div className="mb-6 bg-slate-50 p-3 rounded-md border border-slate-100">
            <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2 flex items-center gap-2">
              <ClipboardList className="h-3 w-3" /> Requirements
            </h4>
            <ul className="space-y-1">
              {category.requirements.map((req, index) => (
                <li key={index} className="text-sm text-slate-700 flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-slate-400 shrink-0" />
                  {req}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-sm font-semibold uppercase text-muted-foreground">Price Tiers</h4>
          <Button variant="outline" size="sm" onClick={() => { setEditingPrice(null); setIsPriceModalOpen(true); }}>
            <Plus className="mr-2 h-3 w-3" /> Add Price
          </Button>
        </div>

        {prices.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground bg-muted/10 rounded-md">No prices configured.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Quota</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prices.map((price) => (
                <TableRow key={price.id}>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${price.type === "EARLY_BIRD" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                      {price.type.replace("_", " ")}
                    </span>
                  </TableCell>
                  <TableCell>Rp {price.price.toLocaleString()}</TableCell>
                  <TableCell>{price.quota}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingPrice(price); setIsPriceModalOpen(true); }}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeletePrice(price.id)}><Trash2 className="h-3 w-3" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <PriceDialog isOpen={isPriceModalOpen} onClose={() => setIsPriceModalOpen(false)} categoryId={category.id} price={editingPrice} onSuccess={fetchPrices} />
      </CardContent>
    </Card>
  );
}

// ==========================================
// DIALOGS & FORMS
// ==========================================

function EventDialog({ isOpen, onClose, event, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "", start_date: "", end_date: "" });

  useEffect(() => {
    if (event) {
      setFormData({
        name: event.name,
        description: event.description || "",
        // dayjs untuk format input datetime-local: YYYY-MM-DDTHH:mm
        start_date: dayjs(event.start_date).format("YYYY-MM-DDTHH:mm"),
        end_date: dayjs(event.end_date).format("YYYY-MM-DDTHH:mm"),
      });
    } else {
      setFormData({ name: "", description: "", start_date: "", end_date: "" });
    }
  }, [event, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const payload = {
        ...formData,
        start_date: dayjs(formData.start_date).toISOString(),
        end_date: dayjs(formData.end_date).toISOString(),
      };
      if (event) { await api.put(`/events/${event.id}`, payload); toast.success("Event updated"); } 
      else { await api.post("/events", payload); toast.success("Event created"); }
      onSuccess(); onClose();
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
      finally { setLoading(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{event ? "Edit Event" : "New Event"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2"><Label>Name</Label><Input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
          <div className="grid gap-2"><Label>Description</Label><Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2"><Label>Start</Label><Input type="datetime-local" required value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} /></div>
            <div className="grid gap-2"><Label>End</Label><Input type="datetime-local" required value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} /></div>
          </div>
          <DialogFooter>
            {
              loading ? (
                <Button disabled>
                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                  Saving...
                </Button>
              ) : (
                <Button type="submit">{event ? "Update Event" : "Create Event"}</Button>
              )
            }
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


function PriceDialog({ isOpen, onClose, categoryId, price, onSuccess }) {
  const getInitialState = () => ({ price: 0, type: "NORMAL", quota: 100, start_at: "", end_at: "" });
  const [formData, setFormData] = useState(getInitialState());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (price) {
      setFormData({
        price: price.price, type: price.type, quota: price.quota,
        start_at: dayjs(price.start_at).format("YYYY-MM-DDTHH:mm"),
        end_at: dayjs(price.end_at).format("YYYY-MM-DDTHH:mm"),
      });
    } else setFormData(getInitialState());
  }, [price, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ticket_category_id: categoryId,
        price: parseFloat(formData.price), type: formData.type, quota: parseInt(formData.quota),
        start_at: dayjs(formData.start_at).toISOString(),
        end_at: dayjs(formData.end_at).toISOString(),
      };
      setLoading(true);
      if (price) { await api.put(`/prices/${price.id}`, payload); toast.success("Updated"); }
      else { await api.post("/prices", payload); toast.success("Created"); }
      onSuccess(); onClose();
    } catch (error) { toast.error("Error saving price"); } 
    finally { setLoading(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{price ? "Edit Price" : "Add Price"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Price</Label><Input type="number" required value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} /></div>
            <div className="space-y-2"><Label>Quota</Label><Input type="number" required value={formData.quota} onChange={(e) => setFormData({...formData, quota: e.target.value})} /></div>
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={formData.type} onValueChange={(val) => setFormData({...formData, type: val})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="NORMAL">Normal</SelectItem><SelectItem value="EARLY_BIRD">Early Bird</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Start</Label><Input type="datetime-local" required value={formData.start_at} onChange={(e) => setFormData({...formData, start_at: e.target.value})} /></div>
            <div className="space-y-2"><Label>End</Label><Input type="datetime-local" required value={formData.end_at} onChange={(e) => setFormData({...formData, end_at: e.target.value})} /></div>
          </div>
          <DialogFooter>
            {
              loading ? (
                <Button disabled>
                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                  Saving...
                </Button>
              ) : (
                <Button type="submit">{price ? "Update Price" : "Create Price"}</Button>
              )
            }
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default DashboardLayout(UnifiedEventManager);