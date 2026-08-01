// src/hooks/use-debounce.js
import { useState, useEffect } from 'react';

export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup function untuk membatalkan timeout jika value berubah
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]); // Hanya re-run efek jika value atau delay berubah

  return debouncedValue;
}