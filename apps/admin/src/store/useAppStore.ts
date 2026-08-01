import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";
import api from "@/lib/api"; // Assuming your API instance is here

export const useAppStore = create<any>()(
    persist(
        (set, get) => ({
            categories: [],
            category: {},
            selectedCategory: null,
            // New state to manage the homepage status for categories.
            // Storing as an object keyed by categoryId is more scalable.
            homepageStatus: {},
            isCategoryLoading: false,

            // New action to fetch the category status from the API and update the store.
            fetchCategoryStatus: async (categoryId) => {
                set({ isCategoryLoading: true });
                try {
                    const response = await api.get(`/categories/${categoryId}`);
                    set((state) => ({
                        homepageStatus: {
                            ...state.homepageStatus,
                            [categoryId]: response.data.is_active || false,
                        },
                    }));
                } catch (error) {
                    console.error("Failed to fetch category status:", error);
                    toast.error("Gagal memuat status kategori.");
                } finally {
                    set({ isCategoryLoading: false });
                }
            },

            // New action to toggle the homepage display via API and update the store state.
            toggleHomepageDisplay: async (categoryId, checked) => {
                // Get the original status to revert on error
                const originalStatus = get().homepageStatus[categoryId];
                // Optimistically update the store
                set((state) => ({
                    homepageStatus: {
                        ...state.homepageStatus,
                        [categoryId]: checked,
                    },
                }));
                try {
                    await api.post(`/categories/${categoryId}/toggle-homepage-display`, {
                        show_on_homepage: checked,
                    });
                    toast.success(
                        `Laporan kategori berhasil ${
                            checked ? "ditampilkan" : "disembunyikan"
                        } di homepage.`
                    );
                } catch (error) {
                    console.error("Failed to update homepage display status:", error);
                    toast.error("Gagal memperbarui status tampilan di homepage.");
                    // Revert the state on API error
                    set((state) => ({
                        homepageStatus: {
                            ...state.homepageStatus,
                            [categoryId]: originalStatus,
                        },
                    }));
                }
            },
        }),
        {
            name: "global-app-store",
        }
    )
);
