import React, { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import L from "leaflet";
import { useMap } from "react-leaflet";
import { NavigationIcon } from "lucide-react";


export const TrackLocationControl = () => {
  const map = useMap();
  const [isTracking, setIsTracking] = useState(false);
  const [locationMarker, setLocationMarker] = useState<L.Marker | null>(null);

  // Gunakan useRef untuk memastikan event listener hanya ditambahkan sekali
  const listenersAttached = useRef(false);
  useEffect(() => {
    if (map && !listenersAttached.current) {
      map.on("locationfound", (e) => {
        toast.success("Lokasi ditemukan!");
        map.flyTo(e.latlng, 16);

        if (locationMarker) {
          map.removeLayer(locationMarker);
        }

        // --- BAGIAN YANG DIPERBARUI DIMULAI DI SINI ---
        const lat = e.latlng.lat.toFixed(5);
        const lng = e.latlng.lng.toFixed(5);

        // 2. Buat konten popup dengan HTML sederhana
        const popupContent = `
                    <div style="font-family: sans-serif; text-align: center;">
                        <strong style="font-size: 14px;">Anda di sini</strong>
                        <hr style="margin: 4px 0;">
                        <div style="font-size: 12px;">
                            Lat: ${lat}<br>
                            Lon: ${lng}
                        </div>
                    </div>
                `;

        // 3. Gunakan konten baru di .bindPopup()
        const newMarker = L.marker(e.latlng, {
          icon: L.divIcon({
            html: `<svg viewBox="0 0 24 24" fill="#2563EB" class="w-8 h-8"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="white"/></svg>`,
            className: "bg-transparent border-none",
            iconSize: [32, 32],
          }),
        })
          .bindPopup(popupContent)
          .addTo(map);

        // --- BAGIAN YANG DIPERBARUI SELESAI ---

        setLocationMarker(newMarker);
        map.stopLocate();
        setIsTracking(false);
      });

      map.on("locationerror", (e) => {
        let message = "";
        switch (e.code) {
          case 1: // PERMISSION_DENIED
            message =
              "Akses lokasi ditolak. Silakan izinkan akses di pengaturan browser Anda.";
            break;
          case 2: // POSITION_UNAVAILABLE
            message = "Informasi lokasi tidak tersedia saat ini.";
            break;
          case 3: // TIMEOUT
            message = "Waktu pencarian lokasi habis (timeout).";
            break;
          default:
            message = `Terjadi galat saat mencari lokasi: ${e.message}`;
            break;
        }
        toast.error(message);
        setIsTracking(false);
      });

      listenersAttached.current = true;
    }
  }, [map, locationMarker]);

  const handleTrackLocation = () => {
    if (isTracking) {
      map.stopLocate();
      setIsTracking(false);
      toast.info("Pelacakan lokasi dihentikan.");
      return;
    }

    setIsTracking(true);
    toast.info("Mencari lokasi Anda...");
    map.locate({ setView: true, maxZoom: 16 });
  };

  return (
      <div className="leaflet-control leaflet-bar bg-white dark:bg-gray-800 rounded-md shadow">
        <a
          href="#"
          title="Lacak Lokasi Saat Ini"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleTrackLocation();
          }}
          className="flex! items-center justify-center w-8 h-8"
        >
          <NavigationIcon
            className={`h-5 w-5 ${
              isTracking ? "animate-pulse text-blue-500" : ""
            }`}
          />
        </a>
      </div>
  );
};
