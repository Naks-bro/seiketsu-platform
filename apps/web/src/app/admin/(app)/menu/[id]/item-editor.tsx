"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { archiveMenuItemAction, saveMenuItemAction } from "../../../menu-actions";
import { btnGhost, btnPrimary, field, panel } from "@/components/admin/ui";

type Variant = {
  id?: string;
  label: string;
  portionAmount: string;
  portionUnit: "g" | "ml";
  priceRupees: string;
  kcal: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  fibreG: string;
  isActive: boolean;
};

export type EditorItem = {
  id?: string;
  name: string;
  categoryId: string;
  description: string;
  diet: "" | "veg" | "egg" | "non_veg";
  imageUrl: string;
  offersExtras: boolean;
  showOnMenu: boolean;
  reviewNotes: string | null;
  variants: Variant[];
};

const NUTRITION: [keyof Variant, string][] = [
  ["kcal", "kcal"],
  ["proteinG", "Protein g"],
  ["carbsG", "Carbs g"],
  ["fatG", "Fat g"],
  ["fibreG", "Fibre g"],
];

/** Shrinks a photo in the browser to at most 1200px and WebP, so uploads stay small. */
async function resize(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read the photo."))), "image/webp", 0.82));
}

export function ItemEditor({ item, categories }: { item: EditorItem; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [form, setForm] = useState(item);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();

  const set = <K extends keyof EditorItem>(k: K, v: EditorItem[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setVariant = (i: number, patch: Partial<Variant>) =>
    setForm((f) => ({ ...f, variants: f.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) }));
  const err = (k: string) => errors[k];

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.append("file", await resize(file), "photo.webp");
      const res = await fetch("/api/admin/menu-image", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      set("imageUrl", data.url);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setMessage(null);
    start(async () => {
      const r = await saveMenuItemAction({ ...form, reviewNotes: undefined });
      if (r.ok) {
        router.push("/admin/menu");
        router.refresh();
      } else {
        setErrors(r.fieldErrors ?? {});
        setMessage(r.error ?? "Could not save.");
      }
    });
  }

  function archive() {
    if (!form.id || !confirm(`Remove "${form.name}" from the menu? Past orders and bills keep showing it.`)) return;
    start(async () => {
      const r = await archiveMenuItemAction(form.id!);
      if (r.ok) {
        router.push("/admin/menu");
        router.refresh();
      } else setMessage(r.error ?? "Could not remove.");
    });
  }

  return (
    <form onSubmit={save} className="grid gap-5 lg:grid-cols-[1fr_320px]" noValidate>
      <div className="space-y-5">
        {item.reviewNotes && (
          <p className="rounded-xl border border-orange/50 bg-orange/10 p-3 text-sm">
            <strong>Hidden because:</strong> {item.reviewNotes} Fix the details below, then tick “Show on the menu”.
          </p>
        )}
        <section className={`${panel} space-y-4`}>
          <label className="block space-y-1 text-sm">
            Dish name
            <input value={form.name} onChange={(e) => set("name", e.target.value)} className={field} aria-invalid={!!err("name")} required />
            {err("name") && <span className="text-nonveg">{err("name")}</span>}
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              Category
              <select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={field}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              Veg / non-veg mark
              <select value={form.diet} onChange={(e) => set("diet", e.target.value as EditorItem["diet"])} className={field}>
                <option value="">Not shown</option>
                <option value="veg">Veg</option>
                <option value="egg">Contains egg</option>
                <option value="non_veg">Non-veg</option>
              </select>
            </label>
          </div>
          <label className="block space-y-1 text-sm">
            Description
            <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} className={field} maxLength={600} />
          </label>
        </section>

        <section className={`${panel} space-y-4`}>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl">Sizes and prices</h2>
            <button
              type="button"
              className={btnGhost}
              onClick={() => set("variants", [...form.variants, { label: "", portionAmount: "", portionUnit: "g", priceRupees: "", kcal: "", proteinG: "", carbsG: "", fatG: "", fibreG: "", isActive: true }])}
            >
              Add a size
            </button>
          </div>
          {err("variants") && <p className="text-sm text-nonveg">{err("variants")}</p>}
          {form.variants.map((v, i) => (
            <fieldset key={v.id ?? `new-${i}`} className="space-y-3 rounded-xl border border-line p-3">
              <legend className="px-1 text-sm font-medium">Size {i + 1}</legend>
              <div className="grid gap-3 sm:grid-cols-4">
                <label className="block space-y-1 text-sm">
                  Name <span className="text-muted">(e.g. Small)</span>
                  <input value={v.label} onChange={(e) => setVariant(i, { label: e.target.value })} className={field} placeholder="Regular" />
                </label>
                <label className="block space-y-1 text-sm">
                  Portion
                  <span className="flex gap-1">
                    <input inputMode="numeric" value={v.portionAmount} onChange={(e) => setVariant(i, { portionAmount: e.target.value })} className={field} aria-label={`Size ${i + 1} portion amount`} />
                    <select value={v.portionUnit} onChange={(e) => setVariant(i, { portionUnit: e.target.value as "g" | "ml" })} className="rounded-lg border border-line bg-white px-2 text-sm" aria-label={`Size ${i + 1} portion unit`}>
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                    </select>
                  </span>
                </label>
                <label className="block space-y-1 text-sm">
                  Price (₹)
                  <input inputMode="decimal" value={v.priceRupees} onChange={(e) => setVariant(i, { priceRupees: e.target.value })} className={field} aria-invalid={!!err(`variants.${i}.priceRupees`)} required />
                  {err(`variants.${i}.priceRupees`) && <span className="text-nonveg">{err(`variants.${i}.priceRupees`)}</span>}
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    className={`${btnGhost} w-full`}
                    disabled={form.variants.length === 1}
                    onClick={() => set("variants", form.variants.filter((_, j) => j !== i))}
                  >
                    Remove size
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {NUTRITION.map(([k, label]) => (
                  <label key={k} className="block space-y-1 text-xs text-muted">
                    {label}
                    <input inputMode="numeric" value={v[k] as string} onChange={(e) => setVariant(i, { [k]: e.target.value } as Partial<Variant>)} className={field} />
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <p className="text-xs text-muted">Leave nutrition empty if you do not have verified numbers; it is simply not shown.</p>
        </section>
      </div>

      <aside className="space-y-5">
        <section className={`${panel} space-y-3`}>
          <h2 className="font-display text-xl">Photo</h2>
          {form.imageUrl ? (
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-paper">
              <Image src={form.imageUrl} alt={`Photo of ${form.name || "the dish"}`} fill sizes="320px" className="object-cover" unoptimized />
            </div>
          ) : (
            <p className="grid aspect-[4/3] place-items-center rounded-xl bg-paper text-sm text-muted">No photo yet</p>
          )}
          <label className={`${btnGhost} w-full cursor-pointer`}>
            {uploading ? "Uploading…" : form.imageUrl ? "Replace photo" : "Upload photo"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} disabled={uploading} />
          </label>
          {form.imageUrl && <button type="button" className="text-sm text-nonveg hover:underline" onClick={() => set("imageUrl", "")}>Remove photo</button>}
        </section>

        <section className={`${panel} space-y-3 text-sm`}>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={form.showOnMenu} onChange={(e) => set("showOnMenu", e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-berry)]" />
            <span><strong>Show on the menu</strong><span className="block text-muted">Untick to hide it from customers without deleting it.</span></span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={form.offersExtras} onChange={(e) => set("offersExtras", e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-berry)]" />
            <span><strong>Offer extras</strong><span className="block text-muted">Avocado, feta, chicken and the other add-ons.</span></span>
          </label>
        </section>

        <div className="space-y-2">
          <button type="submit" disabled={pending || uploading} className={`${btnPrimary} w-full`}>{pending ? "Saving…" : "Save dish"}</button>
          {message && <p role="alert" className="text-sm text-nonveg">{message}</p>}
          {form.id && (
            <button type="button" onClick={archive} disabled={pending} className={`${btnGhost} w-full text-nonveg`}>Remove from menu</button>
          )}
        </div>
      </aside>
    </form>
  );
}