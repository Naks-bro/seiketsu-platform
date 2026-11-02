"use client";

import { useActionState } from "react";
import { changeOwnPasswordAction } from "../../staff-actions";
import { btnPrimary, field, FormMessage } from "@/components/admin/ui";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changeOwnPasswordAction, undefined);
  return (
    <form action={action} className="max-w-sm space-y-3">
      <label className="block space-y-1 text-sm">Current password<input name="current" type="password" required autoComplete="current-password" className={field} /></label>
      <label className="block space-y-1 text-sm">New password<input name="next" type="password" minLength={10} required autoComplete="new-password" className={field} /></label>
      <label className="block space-y-1 text-sm">Repeat new password<input name="confirm" type="password" minLength={10} required autoComplete="new-password" className={field} /></label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Saving…" : "Change password"}</button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}