import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export const BASE_API_URL = import.meta.env.VITE_BASE_API_URL || "http://localhost:8084";

export const BASE_STORAGE_URL = import.meta.env.VITE_COS_CDN_BASE_URL || "https://cdn.codeverta.com";

export function getStorageUrl(path?: string | null): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  const baseUrl = BASE_STORAGE_URL.endsWith("/") ? BASE_STORAGE_URL.slice(0, -1) : BASE_STORAGE_URL;
  return `${baseUrl}/${cleanPath}`;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const debounce = (callback, wait=300) => {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      callback(...args);
    }, wait);
  };
}

  // Fix LaTeX delimiters: \[...\] → $$...$$, \(...\) → $...$
export const renderBody = (body) => {
    let s = body || "";
    s = s.replace(/\\\[/g, "\x00\x00").replace(/\\\]/g, "\x00\x00"); // \[ → placeholder
    s = s.replace(/\\\(/g, "\x01").replace(/\\\)/g, "\x01");         // \( → placeholder
    s = s.replace(/\x00\x00/g, "$$").replace(/\x01/g, "$");           // placeholder → actual delimiters
    return s;
  };



export const formatCurrency = (amount) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);

export const generateGoogleCalendarUrl = (event) => {
  // Format tanggal harus: YYYYMMDDTHHmmssZ (UTC)
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toISOString().replace(/-|:|\.\d\d\d/g, "");
  };

  const start = formatDate(event.start_time);
  const end = formatDate(event.end_time);
  
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Latihan Komunitas: ${event.title}`,
    dates: `${start}/${end}`,
    details: event.description || "Latihan rutin komunitas.",
    location: event.location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export const markdownPreview = (value) => {
  if (!value) return "";
  return value
    .replace(
      /```(\w*)\n([\s\S]*?)```/gm,
      (_, lang, code) =>
        `<pre class="bg-zinc-900 text-zinc-100 rounded-lg p-4 overflow-x-auto my-4 text-xs font-mono border border-zinc-700"><code class="language-${lang}">${code
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</code></pre>`
    )
    .replace(
      /\$\$([\s\S]*?)\$\$/gm,
      (_, math) =>
        `<div class="math-block my-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-center" data-math="${encodeURIComponent(
          math.trim()
        )}"></div>`
    )
    .replace(
      /\$([^$\n]+?)\$/g,
      (_, math) =>
        `<span class="math-inline bg-indigo-50 text-indigo-700 px-1 rounded text-sm" data-math="${encodeURIComponent(
          math.trim()
        )}"></span>`
    )
    .replace(
      /^# (.*$)/gim,
      "<h1 class='text-2xl font-bold mt-6 mb-3 text-zinc-900 border-b pb-2'>$1</h1>"
    )
    .replace(
      /^## (.*$)/gim,
      "<h2 class='text-xl font-semibold mt-5 mb-2 text-zinc-800'>$1</h2>"
    )
    .replace(
      /^### (.*$)/gim,
      "<h3 class='text-base font-semibold mt-4 mb-1.5 text-zinc-700'>$1</h3>"
    )
    .replace(
      /^> (.*$)/gim,
      "<blockquote class='border-l-4 border-indigo-400 pl-4 my-3 text-zinc-600 italic bg-zinc-50 py-2 pr-3 rounded-r-lg'>$1</blockquote>"
    )
    .replace(/^---$/gim, "<hr class='my-6 border-zinc-200' />")
    .replace(
      /\*\*(.*?)\*\*/gim,
      "<strong class='font-semibold text-zinc-900'>$1</strong>"
    )
    .replace(/\*(.*?)\*/gim, "<em class='italic'>$1</em>")
    .replace(
      /`([^`]+)`/gim,
      "<code class='font-mono bg-zinc-100 border border-zinc-200 text-rose-600 px-1.5 py-0.5 rounded text-[0.85em]'>$1</code>"
    )
    .replace(
      /\[(.*?)\]\((.*?)\)/gim,
      '<a href="$2" target="_blank" rel="noreferrer" class="text-indigo-600 underline underline-offset-2 hover:text-indigo-800">$1</a>'
    )
    .replace(
      /^\- (.*$)/gim,
      "<li class='ml-4 list-disc my-0.5 text-sm text-zinc-700'>$1</li>"
    )
    .replace(/\n/g, "<br />");
};
