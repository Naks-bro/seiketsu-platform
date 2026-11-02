"use client";

import { useActionState, useState } from "react";
import { resetStaffPasswordAction } from "../../staff-actions";
import { btnGhost, field, FormMessage } from "@/components/admin/ui";

export function ResetPassword({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(resetStaffPasswordAction, undefined);
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className={btnGhost}>Reset password</button>;
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <label className="sr-only" htmlFor={`pw-${userId}`}>New password for {name}</label>
      <input id={`pw-${userId}`} name="password" minLength={10} required placeholder="New password" className={`${field} w-44`} autoComplete="new-password" />
      <button type="submit" disabled={pending} className={btnGhost}>{pending ? "Saving…" : "Save"}</button>
      <FormMessage state={state} />
    </form>
  );
}