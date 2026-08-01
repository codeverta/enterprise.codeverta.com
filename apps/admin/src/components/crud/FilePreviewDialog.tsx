// components/FilePreviewDialog.jsx

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { BASE_API_URL } from "../../lib/utils";

const FilePreviewDialog = ({ doc, isOpen, onOpenChange }) => {
  if (!doc) return null;

  const fileUrl = `${BASE_API_URL}/storage/${doc.path}`;
  const fileExtension = doc.path.split(".").pop().toLowerCase();

  const renderPreview = () => {
    switch (fileExtension) {
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
      case "webp":
        return (
          <img
            src={fileUrl}
            alt={`Pratinjau untuk ${doc.name}`}
            className="w-full h-auto rounded-md"
          />
        );
      case "pdf":
        return (
          <iframe
            src={fileUrl}
            className="w-full h-[70vh]"
            title={`Pratinjau untuk ${doc.name}`}
          />
        );
      default:
        return (
          <div className="text-center p-8">
            <p className="mb-4">
              Pratinjau tidak tersedia untuk tipe file ini (.{fileExtension}).
            </p>
            <a
              href={fileUrl}
              download
              className="text-blue-600 hover:underline"
            >
              Anda bisa langsung mengunduhnya di sini.
            </a>
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{doc.name}</DialogTitle>
          <DialogDescription>
            Pratinjau untuk file: {doc.path}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">{renderPreview()}</div>
      </DialogContent>
    </Dialog>
  );
};

export default FilePreviewDialog;
