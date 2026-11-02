"use client";

import { useActionState } from "react";
import { addStaffAction } from "../../staff-actions";
import { btnPrimary, field, FormMessage } from "@/components/admin/ui";

export function AddStaffForm() {
  const [state, action, pending] = useActionState(addStaffAction, undefined);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-sm">Name<input name="name" required autoComplete="off" className={field} /></label>
      <label className="space-y-1 text-sm">Email (their login)<input name="email" type="email" required autoComplete="off" className={field} /></label>
      <label className="space-y-1 text-sm">
        Role
        <select name="role" defaultValue="kitchen" className={field}>
          <option value="kitchen">Kitchen: kitchen screen only</option>
          <option value="cashier">Cashier: counter POS + orders</option>
          <option value="inventory">Inventory: stock, deliveries and suppliers</option>
          <option value="manager">Manager: everything except staff and GST</option>
          <option value="owner">Owner: everything</option>
        </select>
      </label>
      <label className="space-y-1 text-sm">
        Temporary password
        <input name="password" type="text" minLength={10} required autoComplete="new-password" className={field} />
        <span className="block text-xs text-muted">At least 10 characters. They can change it under My account.</span>
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Adding…" : "Add staff member"}</button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}