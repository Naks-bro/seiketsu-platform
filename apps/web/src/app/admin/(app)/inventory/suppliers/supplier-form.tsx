"use client";

import { useActionState } from "react";
import { btnPrimary, field, FormMessage } from "@/components/admin/ui";
import { saveSupplierAction } from "../../../inventory-actions";

type Supplier = { id?: string; name?: string; phone?: string | null; email?: string | null; notes?: string | null };

export function SupplierForm({ initial = {} }: { initial?: Supplier }) {
  const [state, action, pending] = useActionState(saveSupplierAction, undefined);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <label className="space-y-1 text-sm">
        Name
        <input name="name" required maxLength={80} defaultValue={initial.name} className={field} autoComplete="off" />
      </label>
      <label className="space-y-1 text-sm">
        Phone
        <input name="phone" type="tel" maxLength={20} defaultValue={initial.phone ?? ""} className={field} autoComplete="off" />
      </label>
      <label className="space-y-1 text-sm">
        Email
        <input name="email" type="email" maxLength={120} defaultValue={initial.email ?? ""} className={field} autoComplete="off" />
      </label>
      <label className="space-y-1 text-sm">
        Notes
        <input name="notes" maxLength={300} defaultValue={initial.notes ?? ""} className={field} placeholder="e.g. delivers Mon and Thu" />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
        <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Saving…" : initial.id ? "Save changes" : "Add supplier"}</button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
