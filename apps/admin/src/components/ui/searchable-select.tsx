import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, CheckCircle2, Plus, ExternalLink, Loader2 } from "lucide-react";

export type SearchableSelectOption = {
  value: string;
  label?: string;
  sublabel?: string;
  badge?: string;
};

export interface SearchableSelectProps {
  value: string;
  options?: (string | SearchableSelectOption)[];
  onChange: (value: string, rawOption?: SearchableSelectOption) => void;
  onSearch?: (query: string) => Promise<(string | SearchableSelectOption)[]>;
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  addNewLabel?: string;
  addNewHref?: string;
  onAddNewClick?: () => void;
}

export function SearchableSelect({
  value,
  options: initialOptions = [],
  onChange,
  onSearch,
  disabled = false,
  placeholder = "Pilih opsi...",
  searchPlaceholder = "Cari...",
  className = "",
  addNewLabel,
  addNewHref,
  onAddNewClick,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [asyncOptions, setAsyncOptions] = useState<(string | SearchableSelectOption)[]>(initialOptions);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sync initialOptions when changed outside
  useEffect(() => {
    if (!onSearch) {
      setAsyncOptions(initialOptions);
    }
  }, [initialOptions, onSearch]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle remote fetch when onSearch provided
  const handleQueryChange = (q: string) => {
    setSearch(q);
    if (!onSearch) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await onSearch(q);
        setAsyncOptions(results || []);
      } catch (err) {
        console.error("SearchableSelect remote fetch error:", err);
      } finally {
        setLoading(false);
      }
    }, 250);
  };

  // Open handler to trigger initial onSearch if needed
  const handleToggle = () => {
    if (disabled) return;
    const nextState = !open;
    setOpen(nextState);
    if (nextState) {
      setSearch("");
      if (onSearch) {
        setLoading(true);
        onSearch("")
          .then((res) => setAsyncOptions(res || []))
          .catch(() => {})
          .finally(() => setLoading(false));
      } else {
        setAsyncOptions(initialOptions);
      }
    }
  };

  const normalizedOptions: SearchableSelectOption[] = asyncOptions.map((opt) => {
    if (typeof opt === "string") {
      return { value: opt, label: opt };
    }
    return {
      value: opt.value,
      label: opt.label || opt.value,
      sublabel: opt.sublabel,
      badge: opt.badge,
    };
  });

  // Client-side filter only if onSearch is not provided
  const displayOptions = onSearch
    ? normalizedOptions
    : normalizedOptions.filter((opt) => {
        const q = search.toLowerCase();
        return (
          opt.value.toLowerCase().includes(q) ||
          (opt.label && opt.label.toLowerCase().includes(q)) ||
          (opt.sublabel && opt.sublabel.toLowerCase().includes(q))
        );
      });

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`flex h-9 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1.5 text-left text-xs font-normal text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 ${
          open ? "ring-1 ring-blue-500 border-blue-500" : ""
        }`}
      >
        <div className="truncate">
          {selectedOption ? (
            <span>
              <span className="font-medium">{selectedOption.label || selectedOption.value}</span>
              {selectedOption.sublabel && (
                <span className="ml-1.5 text-slate-400 text-[11px]">({selectedOption.sublabel})</span>
              )}
            </span>
          ) : value ? (
            <span className="font-medium">{value}</span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>
        <ChevronDown className="ml-2 size-3.5 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full min-w-[240px] rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-1.5 border-b border-slate-100 px-2 py-1.5 dark:border-slate-800">
            {loading ? (
              <Loader2 className="size-3.5 animate-spin text-blue-600" />
            ) : (
              <Search className="size-3.5 text-slate-400" />
            )}
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
            />
          </div>

          <div className="max-h-40 overflow-y-auto py-1">
            {loading && displayOptions.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-400">
                <Loader2 className="size-3.5 animate-spin" />
                <span>Mencari di database...</span>
              </div>
            ) : displayOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-400">Tidak ada opsi ditemukan di database</div>
            ) : (
              displayOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value, opt);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs hover:bg-blue-50 dark:hover:bg-slate-800 ${
                    value === opt.value
                      ? "bg-blue-50 font-medium text-blue-600 dark:bg-slate-800 dark:text-blue-400"
                      : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <div className="flex flex-col truncate">
                    <span className="truncate font-medium">{opt.label || opt.value}</span>
                    {opt.sublabel && (
                      <span className="text-[10px] text-slate-400 truncate">{opt.sublabel}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {opt.badge && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {opt.badge}
                      </span>
                    )}
                    {value === opt.value && <CheckCircle2 className="size-3.5 text-blue-600" />}
                  </div>
                </button>
              ))
            )}
          </div>

          {(addNewLabel || addNewHref || onAddNewClick) && (
            <div className="border-t border-slate-100 pt-1 dark:border-slate-800">
              {addNewHref ? (
                <a
                  href={addNewHref}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800"
                >
                  <Plus className="size-3.5" />
                  <span>{addNewLabel || "+ Tambah Baru"}</span>
                  <ExternalLink className="ml-auto size-3 opacity-60" />
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onAddNewClick?.();
                  }}
                  className="flex w-full items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800"
                >
                  <Plus className="size-3.5" />
                  <span>{addNewLabel || "+ Tambah Baru"}</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * SearchableWarehouseSelect: specialized global wrapper for Warehouses with live DB fetch
 */
export function SearchableWarehouseSelect({
  value,
  warehouses,
  onChange,
  disabled,
  placeholder = "Pilih / cari gudang...",
  className = "",
}: {
  value: string;
  warehouses?: string[];
  onChange: (val: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <SearchableSelect
      value={value}
      options={warehouses || []}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      searchPlaceholder="Cari nama gudang di DB..."
      className={className}
      addNewLabel="+ Tambah Warehouse Baru"
      addNewHref="/desk/warehouse?action=new"
    />
  );
}

export default SearchableSelect;
