import React from "react";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

function Pagination({ currentPage, lastPage, onPageChange }) {
  if (lastPage <= 1) return null;

  const handlePageChange = (page) => {
    if (page >= 1 && page <= lastPage) {
      onPageChange(page);
    }
  };

  return (
    <div className="flex items-center justify-end space-x-2 py-4">
      <span className="text-sm text-slate-600">
        Halaman {currentPage} dari {lastPage}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePageChange(1)}
        disabled={currentPage === 1}
        aria-label="first page" // Added aria-label
      >
        <ChevronsLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="previous page" // Added aria-label
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === lastPage}
        aria-label="next page" // Added aria-label
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePageChange(lastPage)}
        disabled={currentPage === lastPage}
        aria-label="last page" // Added aria-label
      >
        <ChevronsRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default Pagination;
