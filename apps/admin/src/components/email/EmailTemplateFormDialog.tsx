import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit, Plus, Eye, Search, Loader2 } from "lucide-react";
import DashboardLayout from "../../layout/DashboardLayout";
import api from "@/lib/api";

// --- Sub-Component: Dialog Form & Preview ---
// Dipisah agar kode utama lebih rapi
const TemplateFormDialog = ({ 
  isOpen, 
  onOpenChange, 
  formData, 
  setFormData, 
  onSubmit, 
  isSubmitting 
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-[90vw] h-[95vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 border-b">
          <DialogTitle>
            {formData.id ? "Edit Template" : "Template Baru"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
          {/* Left Column: Form Editor */}
          <div className="p-6 overflow-y-auto space-y-5 border-r bg-slate-50/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Input Name */}
              <div className="space-y-2">
                <Label>
                  Nama Template <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Contoh: Invoice Payment"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Email Pengirim <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.from_email}
                  onChange={(e) =>
                    setFormData({ ...formData, from_email: e.target.value })
                  }
                  placeholder="Contoh: noreply@domain.com"
                />
              </div>

              {/* Input Type (Dropdown) - INTEGRASI BARU DISINI */}
              <div className="space-y-2">
                <Label>
                  Tipe Template <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.type}
                  onValueChange={(val) =>
                    setFormData({ ...formData, type: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Tipe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PAYMENT_LINK">Payment Link</SelectItem>
                    <SelectItem value="PAYMENT_SUCCESS">Payment Success</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Input Subject */}
            <div className="space-y-2">
              <Label>
                Subject Email <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.subject}
                onChange={(e) =>
                  setFormData({ ...formData, subject: e.target.value })
                }
                placeholder="Subject yang akan muncul di email client"
              />
            </div>

            {
              formData.type == "PAYMENT_SUCCESS" && (
            <div className="space-y-2">
              <Label>Logo Path (Set by root admin only)</Label>
              <Input
                value={formData.logo_path}
                onChange={(e) =>
                  setFormData({ ...formData, logo_path: e.target.value })
                }
                placeholder="Logo Path (hanya di set oleh root admin)"
              />
            </div>
              )
            }

            {/* Input Tencent ID */}
            <div className="space-y-2">
              <Label>Tencent Template ID</Label>
              <Input
                value={formData.tencent_template_id}
                onChange={(e) =>
                  setFormData({ ...formData, tencent_template_id: e.target.value })
                }
                placeholder="ID dari Tencent Cloud (Optional saat create)"
              />
            </div>

            {/* Input HTML Body */}
            <div className="flex-1 flex flex-col space-y-2">
              <Label>HTML Body Code</Label>
              <Textarea
                className="flex-1 font-mono text-xs min-h-[300px] leading-relaxed resize-none"
                value={formData.body}
                onChange={(e) =>
                  setFormData({ ...formData, body: e.target.value })
                }
                placeholder="<html>..."
              />
              <p className="text-xs text-muted-foreground">
                Gunakan syntax <code>{"{{Variable}}"}</code> untuk data dinamis.
              </p>
            </div>
          </div>

          {/* Right Column: Live Preview */}
          <div className="flex flex-col bg-white overflow-hidden h-full">
            <div className="bg-slate-100 p-3 border-b text-xs font-semibold text-slate-600 flex items-center gap-2 shadow-sm z-10">
              <Eye className="w-3 h-3" /> Live Preview
            </div>
            <div className="flex-1 overflow-auto p-0 w-full h-full bg-slate-200/50">
              <div className="w-full p-4 md:p-8 flex justify-center">
                <div
                  className="bg-white shadow-lg w-full max-w-[600px] min-h-[500px] overflow-hidden rounded-md"
                  dangerouslySetInnerHTML={{
                    __html: formData.body,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t flex justify-end gap-3 bg-white">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {formData.id ? "Simpan Perubahan" : "Buat Template"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TemplateFormDialog;