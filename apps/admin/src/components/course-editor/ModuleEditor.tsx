import React from "react";
import { Loader2, Save } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export const ModuleEditor = ({
  moduleForm,
  setModuleForm,
  canManageCourses,
  saveModule,
  busyKey,
  isDirty,
}: {
  moduleForm: any;
  setModuleForm: any;
  canManageCourses: boolean;
  saveModule: any;
  busyKey: string;
  isDirty?: boolean;
}) => {
  return (
    <div className="mx-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-zinc-900">
            {moduleForm.id ? "Edit Unit" : "Unit Baru"}
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Konfigurasi metadata unit kompetensi
          </p>
        </div>
        {isDirty && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-sm animate-pulse">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Belum disimpan
          </span>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-700">
              Nama Unit <span className="text-rose-500">*</span>
            </Label>
            <Input
              placeholder="cth: Apa itu Emosi?"
              value={moduleForm.title}
              readOnly={!canManageCourses}
              maxLength={100}
              onChange={(e) =>
                setModuleForm((p) => ({
                  ...p,
                  title: e.target.value,
                }))
              }
              className="h-9 text-sm"
            />
            <div className="flex justify-end text-[10px] text-zinc-400">
              <span>{(moduleForm.title || "").length}/100</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-700">
              Deskripsi Capaian
            </Label>
            <Textarea
              rows={4}
              placeholder="Gambarkan garis besar unit dan objektif pembelajaran…"
              value={moduleForm.description || ""}
              readOnly={!canManageCourses}
              maxLength={5000}
              onChange={(e) =>
                setModuleForm((p) => ({
                  ...p,
                  description: e.target.value,
                }))
              }
              className="text-sm resize-none"
            />
            <div className="flex justify-end text-[10px] text-zinc-400">
              <span>{(moduleForm.description || "").length}/5000</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2.5">
              <Switch
                id="mod-publish"
                checked={!!moduleForm.is_published}
                disabled={!canManageCourses}
                onCheckedChange={(v) =>
                  setModuleForm((p) => ({ ...p, is_published: v }))
                }
              />
              <Label
                htmlFor="mod-publish"
                className="text-xs text-zinc-600 cursor-pointer"
              >
                Publish unit (dapat diakses publik)
              </Label>
            </div>
          </div>
        </div>

        {canManageCourses && (
          <div className="border-t border-zinc-100 bg-zinc-50 px-5 py-3 flex justify-end">
            <Button
              size="sm"
              onClick={saveModule}
              disabled={busyKey === "save-module"}
              className="bg-indigo-600 hover:bg-indigo-700 gap-1.5 h-8 text-xs"
            >
              {busyKey === "save-module" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Simpan Unit
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
