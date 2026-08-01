export type PetDefinition = {
  id: string;
  name: string;
  description: string;
  spritesheet: string;
};

export const PETS: PetDefinition[] = [
  ["doraemon", "Doraemon", "Kucing robot biru yang penuh kejutan dari kantong ajaib."],
  ["eve", "EVE", "Robot kecil yang tenang dan ekspresif."],
  ["guami", "Guami", "Teman kecil yang santai dan menggemaskan."],
  ["kirby", "Kirby", "Pet merah muda dengan semangat ceria."],
  ["nezukocoder", "NezukoCoder", "Teman belajar yang betah di depan laptop."],
  ["pikachu", "Pikachu", "Teman listrik kecil bertopi trainer."],
  ["pochita", "Pochita Mini", "Pet mungil dengan energi yang hangat."],
  ["totoro", "Totoro", "Teman hutan yang teduh dan ramah."],
  ["whaledou", "Whaledou", "Paus biru kecil yang lembut."],
  ["usagi", "Usagi", "Kelinci putih kecil yang lincah, lucu, dan penuh semangat."],
].map(([id, name, description]) => ({
  id,
  name,
  description,
  spritesheet: `/sprites/${id}/spritesheet.${id === "kirby" ? "png" : "webp"}`,
}));

export const DEFAULT_PET_ID = "pikachu";

export function getPet(id: string) {
  return PETS.find((pet) => pet.id === id) || PETS.find((pet) => pet.id === DEFAULT_PET_ID)!;
}
