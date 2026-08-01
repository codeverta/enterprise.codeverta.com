import { create } from "zustand";
import { persist } from "zustand/middleware";
import { GeoJsonObject, Feature } from "geojson";
import { nanoid } from "nanoid";
import { toast } from "sonner"

export type ToastType = "success" | "error" | "info";

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
}


export type MarkerType = "default" | "bencana" | "longsor";

export interface LayerData {
    id: string;
    name: string;
    data: GeoJsonObject;
    visible: boolean;
    images?: string[];
    markerType?: MarkerType;
}


export interface AppState {
    layers: LayerData[];
    selectedFeature: any;
    targetCoords: L.LatLng | null;
    isAddingMarker: MarkerType | null;
    isSidebarOpen: boolean;
    isDrawerOpen: boolean;
    cursorCoords: { lat: number; lng: number };
    toasts: Toast[];
    selectedKabs: string[];
    setSelectedKabs: (kabs: string[]) => void;
    closeDrawer: () => void;
    setSelectedFeature: (feature: Feature | null) => void;
    addLayer: (layer: LayerData) => void;
    toggleLayerVisibility: (id: string) => void;
    removeLayer: (id: string) => void;
    setLayers: (layers: LayerData[]) => void;
    setTargetCoords: (coords: L.LatLng | null) => void;
    setIsAddingMarker: (type: MarkerType | null) => void;
    toggleSidebar: () => void;
    setCursorCoords: (coords: { lat: number; lng: number }) => void;
    addToast: (message: string, type: ToastType) => void;
}

export const useMapStore = create<AppState>()(
    persist(
        (set, get) => ({
            layers: [],
            selectedFeature: null,
            targetCoords: null,
            isAddingMarker: null,
            isSidebarOpen: window.innerWidth > 768,
            cursorCoords: { lat: 0, lng: 0 },
            selectedKabs: ['all'],
            toasts: [],
            setSelectedKabs: (kabs) => {
                const finalKabs = kabs.length === 0 ? ['all'] : [...kabs]; 
                set({ selectedKabs: finalKabs });
            },
            addLayer: (layer) =>
                set((state) => ({ layers: [...state.layers, layer] })),
            toggleLayerVisibility: (id) =>
                set((state) => ({
                    layers: state.layers.map((l) =>
                        l.id === id ? { ...l, visible: !l.visible } : l
                    ),
                })),
            removeLayer: (id) =>
                set((state) => ({
                    layers: state.layers.filter((l) => l.id !== id),
                })),
            setLayers: (layers) => set({ layers }),
            setSelectedFeature: (selectedFeature) => set({ selectedFeature }),
            setTargetCoords: (coords) => set({ targetCoords: coords }),
            setIsAddingMarker: (type) => set({ isAddingMarker: type }),
            toggleSidebar: () =>
                set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
            setCursorCoords: (coords) => set({ cursorCoords: coords }),
            addToast: (message, type) => {
                const id = nanoid();
                set((state) => ({
                    toasts: [...state.toasts, { id, message, type }],
                }));
                if(type === "success") {
                    toast.success(message, {
                        duration: 3000,
                        id,
                    });
                } else if(type === "error") {
                    toast.error(message, {
                        duration: 3000,
                        id,
                    });
                }
                else {
                    toast(message, {
                        duration: 3000,
                        id,
                    });
                }
                setTimeout(() => {
                    set((state) => ({
                        toasts: state.toasts.filter((t) => t.id !== id),
                    }));
                }, 3000);
            },
            isDrawerOpen: false,            
            closeDrawer: () => set({ isDrawerOpen: false, selectedFeature: null }),
        }),
        {
            name: "web-gis-layers-storage", // localStorage key
            partialize: (state) => ({ layers: state.layers }), // Only persist layers
        }
    )
);