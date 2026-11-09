"use client";

import { useActionState, useEffect, useRef } from "react";
import { staffReplyAction } from "../../../ticket-actions";

export function StaffReply({ id, phone }: { id: string; phone: string }) {
  const [state, action, pending] = useActionState(staffReplyAction, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state?.ok]);
  return (
    <form ref={form} action={action} className="space-y-3 rounded-2xl border border-line bg-white p-4">
      <input type="hidden" name="id" value={id} />
      <label htmlFor="staff-reply" className="block text-sm font-medium">Reply</label>
      <textarea id="staff-reply" name="message" rows={4} maxLength={2000} required className="w-full rounded-xl border border-line px-3.5 py-3 text-sm outline-none focus:border-berry" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="internal" /> Internal note (only the team sees it)
        </label>
        <button type="submit" disabled={pending} className="rounded-full bg-berry px-5 py-2 text-sm font-semibold text-cream hover:bg-berry-deep disabled:opacity-60">
          {pending ? "Sending…" : "Send"}
        </button>
      </div>
      {state?.error && <p role="alert" className="text-sm text-nonveg">{state.error}</p>}
      <p className="text-xs text-muted">
        The customer sees replies on their request page. Automatic WhatsApp/SMS alerts start once messaging is set up; until then, let them know on{" "}
        <a href={`https://wa.me/91${phone}`} target="_blank" rel="noreferrer" className="underline">WhatsApp</a>.
      </p>
    </form>
  );
}
