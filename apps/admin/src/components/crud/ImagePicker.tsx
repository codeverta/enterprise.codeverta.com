import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { BASE_API_URL } from "@/lib/utils";

export function ImagePicker({
  existingImages = [],
  onImagesUpdate,
  onImagesDelete,
}) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    setSelectedFiles((prev) => [...prev, ...files]);
    onImagesUpdate(files);
  };

  const removeSelectedFile = (index) => {
    const newFiles = [...selectedFiles];
    newFiles.splice(index, 1);
    setSelectedFiles(newFiles);
    onImagesUpdate(newFiles);
  };

  const removeExistingImage = (id) => {
    onImagesDelete(id);
  };

  return (
    <div>
      <Button type="button" onClick={() => fileInputRef.current.click()}>
        Pilih Gambar
      </Button>
      <input
        type="file"
        multiple
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
        {existingImages.map((image) => (
          <div key={image.id} className="relative group">
            <img
              src={`${BASE_API_URL}/storage/${image.path}`}
              alt="Existing"
              className="w-full h-24 object-cover rounded-md"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => removeExistingImage(image.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {selectedFiles.map((file, index) => (
          <div key={index} className="relative group">
            <img
              src={URL.createObjectURL(file)}
              alt="Preview"
              className="w-full h-24 object-cover rounded-md"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => removeSelectedFile(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
