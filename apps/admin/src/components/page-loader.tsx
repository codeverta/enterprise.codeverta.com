import { Loader2 } from "lucide-react";

// Fallback Loader for Suspense
export const PageLoader = () => (
  <div className="fixed inset-0 z-50 bg-background/10 backdrop-blur-sm flex items-center justify-center">
    <div className="flex flex-col items-center gap-2">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="font-semibold">Memuat halaman...</p>
    </div>
  </div>
);
