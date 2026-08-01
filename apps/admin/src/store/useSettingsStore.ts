// stores/useSettingsStore.js
import { create } from 'zustand';
import api from '../lib/api';

export const useSettingsStore = create((set) => ({
  settings: null,
  isLoading: false,
  lastFetched: null,
  
  fetchSettings: async ({force = false, isPublic = false} = {}) => {
    const state = useSettingsStore.getState();
    
    // Skip jika sudah ada data dan belum expired (misal: 5 menit)
    const CACHE_DURATION = 5 * 60 * 1000; // 5 menit
    if (!force && state.settings && state.lastFetched && 
        Date.now() - state.lastFetched < CACHE_DURATION) {
      return state.settings;
    }
    
    set({ isLoading: true });
    try {
      const storedUser = localStorage.getItem("user");
      const user = storedUser ? JSON.parse(storedUser) : null;
      const isAdmin = user && Number(user.role || 0) >= 99;
      
      let url = (isPublic || !isAdmin) ? "/settings" : "/settings/admin";
      const response = await api.get(url);
      const formatDT = (date) =>
        date ? new Date(date).toISOString().slice(0, 16) : "";
      
      const formattedSettings = {
        ...response.data,
        event_start_time: formatDT(response.data.event_start_time),
      };
      
      set({ 
        settings: formattedSettings, 
        isLoading: false,
        lastFetched: Date.now()
      });
      
      return formattedSettings;
    } catch (error) {
      console.error("Failed to load settings", error);
      set({ isLoading: false });
      throw error;
    }
  },
  
  updateSettings: (newSettings) => set({ settings: newSettings }),
  clearSettings: () => set({ settings: null, lastFetched: null }),
}));