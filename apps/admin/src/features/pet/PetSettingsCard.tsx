import { LocateFixed, PawPrint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { PETS } from "./pets";
import { PetSprite } from "./PetSprite";
import { usePetStore } from "@/store/usePetStore";

export function PetSettingsCard() {
  const enabled = usePetStore((state) => state.enabled);
  const selectedPetId = usePetStore((state) => state.selectedPetId);
  const setEnabled = usePetStore((state) => state.setEnabled);
  const selectPet = usePetStore((state) => state.selectPet);
  const setPosition = usePetStore((state) => state.setPosition);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PawPrint className="h-4 w-4" />
          Pet pendamping
        </CardTitle>
        <CardDescription>
          Pilih teman kecil yang menemani aktivitasmu. Perubahan tersimpan otomatis di browser ini.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-start justify-between gap-4 rounded-xl border bg-muted/30 p-4">
          <div className="space-y-1">
            <Label htmlFor="pet-enabled" className="text-sm font-medium">Tampilkan pet</Label>
            <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
              Saat pet aktif, tombol chat mengambang akan disembunyikan. Nonaktifkan pet untuk menampilkan chat kembali.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPosition(null)}
              title="Kembalikan pet ke kanan bawah"
            >
              <LocateFixed className="h-4 w-4" />
              <span className="hidden sm:inline">Reset posisi</span>
            </Button>
            <Switch id="pet-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">Pilih karakter</h3>
            <p className="text-xs text-muted-foreground">Klik karakter untuk langsung mengganti pet. Di dashboard, klik pet untuk melihat seluruh reaksi atau geser untuk membuatnya berjalan.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {PETS.map((pet) => {
              const selected = pet.id === selectedPetId;
              return (
                <button
                  key={pet.id}
                  type="button"
                  onClick={() => selectPet(pet.id)}
                  aria-pressed={selected}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border bg-background p-3 text-left outline-none transition-all hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 motion-reduce:transform-none",
                    selected && "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500"
                  )}
                >
                  <div className="flex h-24 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-b from-sky-50 to-slate-100">
                    <PetSprite pet={pet} size={72} />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">{pet.name}</span>
                    {selected && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{pet.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
