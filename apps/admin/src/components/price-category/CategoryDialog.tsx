import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { Plus, X, Trash2 } from "lucide-react"; // Pastikan install lucide-react
import api from "../../lib/api";

function CategoryDialog({ isOpen, onClose, category, eventId, onSuccess }) {
  // State form utama
  const [formData, setFormData] = useState({
    name: "",
    distance_km: 0,
    requirements: [] // Array string
  });

  // State sementara untuk input requirement baru
  const [newReq, setNewReq] = useState("");

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        distance_km: category.distance_km,
        // Pastikan ada fallback array kosong jika null
        requirements: category.requirements || [] 
      });
    } else {
      setFormData({ name: "", distance_km: 0, requirements: [] });
    }
    setNewReq(""); // Reset input requirement
  }, [category, isOpen]);

  // Handle tambah requirement ke list
  const handleAddRequirement = () => {
    if (!newReq.trim()) return;
    setFormData((prev) => ({
      ...prev,
      requirements: [...prev.requirements, newReq]
    }));
    setNewReq("");
  };

  // Handle hapus requirement dari list
  const handleRemoveRequirement = (index) => {
    setFormData((prev) => ({
      ...prev,
      requirements: prev.requirements.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        distance_km: parseFloat(formData.distance_km),
        event_id: eventId,
        // requirements sudah berupa array string, jadi aman dikirim
      };

      if (category) {
        await api.put(`/categories/${category.id}`, payload);
        toast.success("Category updated successfully");
      } else {
        await api.post("/categories", payload);
        toast.success("Category created successfully");
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Error saving category");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{category ? "Edit Category" : "New Category"}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nama Kategori */}
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input
              placeholder="Contoh: 42 KM - Master"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          {/* Jarak */}
          <div className="grid gap-2">
            <Label>Distance (KM)</Label>
            <Input
              type="number"
              step="0.1"
              required
              value={formData.distance_km}
              onChange={(e) => setFormData({ ...formData, distance_km: e.target.value })}
            />
          </div>

          {/* Dynamic Requirements Section */}
          <div className="grid gap-2">
            <Label>Requirements & Notes</Label>
            
            {/* Input untuk menambah requirement baru */}
            <div className="flex gap-2">
              <Input
                placeholder="Tulis syarat (misal: Wajib bawa water bladder)"
                value={newReq}
                onChange={(e) => setNewReq(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault(); // Mencegah form submit saat tekan enter di field ini
                    handleAddRequirement();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={handleAddRequirement}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* List Requirements yang sudah ditambahkan */}
            <div className="flex flex-col gap-2 mt-2 max-h-40 overflow-y-auto">
              {formData.requirements.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Belum ada persyaratan.</p>
              )}
              
              {formData.requirements.map((req, index) => (
                <div key={index} className="flex items-center justify-between bg-slate-50 border p-2 rounded-md text-sm">
                  <span className="truncate mr-2 text-slate-700">{index + 1}. {req}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveRequirement(index)}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CategoryDialog;