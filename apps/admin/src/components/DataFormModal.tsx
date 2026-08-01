// src/components/DataFormModal.jsx
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

function DataFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  columns,
  title,
  description,
}) {
  const [formData, setFormData] = useState({});

  // Efek ini dijalankan ketika initialData berubah (saat membuka modal edit)
  // atau saat kolom berubah (saat pertama kali render)
  useEffect(() => {
    const defaultState = columns.reduce((acc, col) => {
      // Jangan sertakan 'id' dalam form jika itu auto-increment
      if (col.accessor.toLowerCase() !== "id") {
        acc[col.accessor] = initialData?.[col.accessor] || "";
      }
      return acc;
    }, {});
    setFormData(defaultState);
  }, [initialData, columns, isOpen]); // Reset form saat modal dibuka/tutup

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  // Filter kolom yang akan ditampilkan di form (misal, tanpa 'id')
  const formFields = columns.filter(
    (col) => col.accessor.toLowerCase() !== "id"
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {formFields.map((col) => (
              <div
                key={col.accessor}
                className="grid grid-cols-4 items-center gap-4"
              >
                <Label htmlFor={col.accessor} className="text-right">
                  {col.header}
                </Label>
                <Input
                  id={col.accessor}
                  name={col.accessor}
                  value={formData[col.accessor] || ""}
                  onChange={handleChange}
                  type={col.isNumeric ? "number" : "text"}
                  className="col-span-3"
                  required
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit">Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default DataFormModal;
