import {create} from "zustand";
import {persist} from "zustand/middleware";
import {toast} from "sonner"
import api from "../lib/api";

export interface Category {
    id: string;
    name: string;
    description?: string;
}
export interface CategoryState {
    categories: {
        data: Category[];
    };
    fetchCategories: () => void;
    isLoading?: boolean;
}

export const useCategoryStore = create<CategoryState>()(
    persist(
        (set, get) => ({
            categories: {
                data: [],
            },
            isLoading: false,
            fetchCategories: async () => {
                try {
                    set({isLoading: true});
                    const response = await api.get('/categories');
                    set({categories: response.data});
                    return response.data;
                } catch (error) {
                    toast.error("Failed to fetch categories");
                } finally {
                    set({isLoading: false});
                }
            },
        }),
        {
            name: "category-storage",
        }
    )
);
