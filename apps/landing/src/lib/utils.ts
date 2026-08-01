import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export const BASE_API_URL = import.meta.env.VITE_BASE_API_URL || "http://localhost:8000";
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