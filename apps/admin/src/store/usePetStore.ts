import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_PET_ID, PETS } from "@/features/pet/pets";

type PetState = {
  enabled: boolean;
  selectedPetId: string;
  position: { x: number; y: number } | null;
  setEnabled: (enabled: boolean) => void;
  selectPet: (petId: string) => void;
  setPosition: (position: { x: number; y: number } | null) => void;
};

export const usePetStore = create<PetState>()(
  persist(
    (set) => ({
      enabled: false,
      selectedPetId: DEFAULT_PET_ID,
      position: null,
      setEnabled: (enabled) => set({ enabled }),
      selectPet: (selectedPetId) => {
        if (PETS.some((pet) => pet.id === selectedPetId)) {
          set({ selectedPetId });
        }
      },
      setPosition: (position) => set({ position }),
    }),
    {
      name: "lms-pet-preferences",
      version: 1,
      partialize: ({ enabled, selectedPetId, position }) => ({ enabled, selectedPetId, position }),
    }
  )
);
