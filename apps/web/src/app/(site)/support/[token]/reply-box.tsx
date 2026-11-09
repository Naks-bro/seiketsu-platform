"use client";

import { useActionState, useEffect, useRef } from "react";
import { customerReplyAction } from "../actions";

export function ReplyBox({ token }: { token: string }) {
  const [state, action, pending] = useActionState(customerReplyAction, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state?.ok]);
  return (
    <form ref={form} action={action} className="space-y-3 rounded-2xl border border-line bg-white p-4">
      <input type="hidden" name="token" value={token} />
      <label htmlFor="reply" className="block text-sm font-medium">Add a message</label>
      <textarea id="reply" name="message" rows={3} maxLength={2000} required className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-base outline-none focus:border-berry" />
      {state?.error && <p role="alert" className="text-sm text-nonveg">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-veg">Sent. We’ll reply here.</p>}
      <button type="submit" disabled={pending} className="rounded-full bg-berry px-6 py-2.5 font-semibold text-cream hover:bg-berry-deep disabled:opacity-60">
        {pending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
