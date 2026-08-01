import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Calendar,
  Tag,
  Percent,
  DollarSign,
  Loader2,
} from "lucide-react";
import DashboardLayout from "@/layout/DashboardLayout";
import api from "@/lib/api";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { toast } from "sonner";

dayjs.extend(utc);
dayjs.extend(timezone);

// Set default timezone
const ADMIN_TZ = "Asia/Jakarta";

const PromoDashboard = () => {
  // --- STATE ---
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Search & Filter
  // Fix 1: Separate Input Value (Immediate) vs Search Code (Debounced)
  const [searchInputValue, setSearchInputValue] = useState(""); 
  const [searchCode, setSearchCode] = useState("");
  const [filterActive, setFilterActive] = useState("all");

  // Dialog & Form
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentPromo, setCurrentPromo] = useState(null);
  const [formData, setFormData] = useState({
    code: "",
    discount_type: "FIXED",
    discount_value: "",
    max_discount: "",
    quota: "",
    start_at: "",
    end_at: "",
    is_active: true,
  });

  // --- EFFECT: Debounce Search ---
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchCode(searchInputValue);
      setPage(1); // Reset to page 1 on new search
    }, 500); // 500ms delay

    return () => clearTimeout(handler);
  }, [searchInputValue]);

  // --- EFFECT: Fetch Data ---
  useEffect(() => {
    fetchPromos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchCode, filterActive]);

  const fetchPromos = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
      });

      if (searchCode) params.append("code", searchCode);
      if (filterActive !== "all")
        params.append("is_active", filterActive === "active");

      const response = await api.get(`/promo-codes?${params}`);
      
      // Safety check for nested data
      const responseData = response.data?.data || {};
      setPromos(responseData.data || []);
      setTotalPages(responseData.total_pages || 1);
      
    } catch (error) {
      showAlert("Failed to fetch promos: " + (error.response?.data?.message || error.message), "error");
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (message, type = "success") => {
    if (type === "error") {
      toast.error(message);
      return;
    }
    toast.success(message);
  };

  // Fix 2: Cleaner Form Handler
  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const openCreateDialog = () => {
    setIsEditMode(false);
    setCurrentPromo(null);
    setFormData({
      code: "",
      discount_type: "FIXED",
      discount_value: "",
      max_discount: "",
      quota: "",
      start_at: "",
      end_at: "",
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (promo) => {
    setIsEditMode(true);
    setCurrentPromo(promo);
    setFormData({
      code: promo.code,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      max_discount: promo.max_discount,
      quota: promo.quota,
      // Format for input type="datetime-local" (YYYY-MM-DDTHH:mm)
      start_at: dayjs(promo.start_at).tz(ADMIN_TZ).format("YYYY-MM-DDTHH:mm"),
      end_at: dayjs(promo.end_at).tz(ADMIN_TZ).format("YYYY-MM-DDTHH:mm"),
      is_active: promo.is_active,
    });
    setIsDialogOpen(true);
  };

  const validateForm = () => {
    if(!formData.code) return "Code is required";
    if(!formData.discount_value) return "Discount value is required";
    if(!formData.start_at) return "Start date is required";
    if(!formData.end_at) return "End date is required";
    return null;
  }

  const handleCreate = async () => {
    const error = validateForm();
    if(error) {
        showAlert(error, "error");
        return;
    }

    try {
      const payload = {
        ...formData,
        discount_value: parseFloat(formData.discount_value),
        max_discount: parseFloat(formData.max_discount) || 0,
        quota: parseInt(formData.quota) || 0,
        min_participants: 1,
        // Convert local time string to ISO string with timezone preservation
        start_at: dayjs.tz(formData.start_at, ADMIN_TZ).toISOString(),
        end_at: dayjs.tz(formData.end_at, ADMIN_TZ).toISOString(),
      };

      await api.post("/promo-codes", payload);

      showAlert("Promo created successfully!");
      setIsDialogOpen(false);
      fetchPromos();
    } catch (error) {
      showAlert("Failed to create promo: " + (error.response?.data?.message || error.message), "error");
    }
  };

  const handleUpdate = async () => {
    const error = validateForm();
    if(error) {
        showAlert(error, "error");
        return;
    }

    try {
      const payload = {
        code: formData.code,
        discount_type: formData.discount_type,
        discount_value: parseFloat(formData.discount_value),
        max_discount: parseFloat(formData.max_discount) || 0,
        quota: parseInt(formData.quota),
        start_at: dayjs.tz(formData.start_at, ADMIN_TZ).toISOString(),
        end_at: dayjs.tz(formData.end_at, ADMIN_TZ).toISOString(),
        is_active: formData.is_active,
      };

      await api.put(`/promo-codes/${currentPromo.id}`, payload);

      showAlert("Promo updated successfully!");
      setIsDialogOpen(false);
      fetchPromos();
    } catch (error) {
      showAlert("Failed to update promo: " + (error.response?.data?.message || error.message), "error");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to archive this promo?")) return;

    setLoading(true);
    try {
      const response = await api.delete(`/promo-codes/${id}`);
      // Usually checking response.data.success or status 200
      if (response.status === 200 || response.data.success) {
        showAlert("Promo archived successfully!");
        fetchPromos();
      }
    } catch (error) {
      showAlert("Failed to archive promo: " + (error.response?.data?.message || error.message), "error");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return dayjs(dateString).tz(ADMIN_TZ).format("D MMM YYYY, HH:mm");
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8 max-w-screen-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Promo Code Management
            </h1>
            <p className="text-gray-500 ">
              Manage your promotional codes and discounts
            </p>
          </div>
          <Button
            onClick={openCreateDialog}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Promo
          </Button>
        </div>

        {/* Filters */}
          <div className="mb-6 flex flex-wrap gap-4 items-end p-4 rounded-lg border">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by code..."
                  // Fix: Bind to UI state, not Debounced state
                  value={searchInputValue}
                  onChange={(e) => setSearchInputValue(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterActive} onValueChange={setFilterActive}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Promo Codes</CardTitle>
            <CardDescription>
              A list of all your promotional codes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-sm">
                      Code
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-sm">
                      Type
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-sm">
                      Discount
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-sm">
                      Quota
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-sm">
                      Period
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-sm">
                      Status
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-sm">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center py-8 text-gray-500"
                      >
                        Loading...
                      </td>
                    </tr>
                  ) : !promos || promos.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center py-8 text-gray-500"
                      >
                        No promo codes found
                      </td>
                    </tr>
                  ) : (
                    promos.map((promo) => (
                      <tr key={promo.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 font-medium">
                            <Tag className="w-4 h-4 text-gray-400" />
                            {promo.code}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant="outline"
                            className="flex items-center gap-1 w-fit"
                          >
                            {promo.discount_type === "PERCENT" ? (
                              <Percent className="w-3 h-3" />
                            ) : (
                              <DollarSign className="w-3 h-3" />
                            )}
                            {promo.discount_type}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            {promo.discount_type === "PERCENT"
                              ? `${promo.discount_value}%`
                              : formatCurrency(promo.discount_value)}
                          </div>
                          {promo.max_discount > 0 && (
                            <div className="text-xs text-gray-500">
                              Max: {formatCurrency(promo.max_discount)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm">
                            <span className="font-medium">
                              {promo.used_quota}
                            </span>
                            <span className="text-gray-500">
                              {" "}
                              / {promo.quota}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-xs space-y-1">
                            <div className="flex items-center gap-1 text-gray-600">
                              <Calendar className="w-3 h-3" />
                              {formatDate(promo.start_at)}
                            </div>
                            <div className="text-gray-400">
                              to {formatDate(promo.end_at)}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={promo.is_active ? "default" : "secondary"}
                          >
                            {promo.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditDialog(promo)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(promo.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {isEditMode ? "Edit Promo Code" : "Create New Promo Code"}
              </DialogTitle>
              <DialogDescription>
                {isEditMode
                  ? "Update the promotional code details"
                  : "Fill in the details to create a new promotional code"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Promo Code *</Label>
                  <Input
                    id="code"
                    name="code"
                    value={formData.code}
                    onChange={(event) => {
                      setFormData({
                        ...formData,
                        code: event.target.value.toUpperCase(),
                      });
                    }}
                    placeholder="e.g., NEWYEAR2024"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discount_type">Discount Type *</Label>
                  {/* Fix 3: Handle reset logic here directly in onValueChange */}
                  <Select
                    value={formData.discount_type}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ 
                        ...prev, 
                        discount_type: value,
                        // Reset max_discount if type becomes FIXED
                        max_discount: value === "FIXED" ? "" : prev.max_discount
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FIXED">Fixed Amount</SelectItem>
                      <SelectItem value="PERCENT">Percentage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="discount_value">
                    Discount Value *{" "}
                    {formData.discount_type === "PERCENT" && "(%)"}
                  </Label>
                  <Input
                    id="discount_value"
                    name="discount_value"
                    type="number"
                    value={formData.discount_value}
                    onChange={handleFormChange}
                    placeholder={
                      "Contoh: " + (formData.discount_type === "PERCENT" ? "20" : "50000")
                    }
                  />
                </div>
                {formData.discount_type === "PERCENT" && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
                    <Label htmlFor="max_discount">Max Discount (IDR)</Label>
                    <Input
                      id="max_discount"
                      name="max_discount"
                      type="number"
                      value={formData.max_discount}
                      onChange={handleFormChange}
                      placeholder="Contoh: 50000 (Maksimal potongan)"
                    />
                    <p className="text-xs text-muted-foreground">
                      Membatasi nominal potongan jika hasil % terlalu besar.
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="quota">Quota *</Label>
                <Input
                  id="quota"
                  name="quota"
                  type="number"
                  value={formData.quota}
                  onChange={handleFormChange}
                  placeholder="100"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_at">Start Date (WIB) *</Label>
                  <Input
                    id="start_at"
                    name="start_at"
                    type="datetime-local"
                    value={formData.start_at}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_at">End Date (WIB) *</Label>
                  <Input
                    id="end_at"
                    name="end_at"
                    type="datetime-local"
                    value={formData.end_at}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  id="is_active"
                  name="is_active"
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={handleFormChange}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  Active
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
             <Button disabled={loading} onClick={isEditMode ? handleUpdate : handleCreate}>
  {loading ? (
    <>
      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      {isEditMode ? "Updating..." : "Creating..."}
    </>
  ) : (
    `${isEditMode ? "Update" : "Create"} Promo`
  )}
</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
};

export default DashboardLayout(PromoDashboard);
