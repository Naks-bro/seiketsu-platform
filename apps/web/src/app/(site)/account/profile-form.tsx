"use client";

import { useActionState } from "react";
import { saveProfileAction, type ProfileState } from "./actions";

const input = "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 outline-none focus:border-berry";

export function ProfileForm({ name, email }: { name: string; email: string | null }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfileAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="name" className="block text-sm font-medium">Name</label>
        <input id="name" name="name" defaultValue={name} autoComplete="name" className={input} required />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium">Email <span className="text-muted">(optional, for bills and offers)</span></label>
        <input id="email" name="email" type="email" defaultValue={email ?? ""} autoComplete="email" className={input} />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-full bg-berry px-6 py-2.5 font-semibold text-cream hover:bg-berry-deep disabled:opacity-60">
          {pending ? "Saving…" : "Save"}
        </button>
        {state?.ok && <span className="text-sm text-olive-ink">{state.ok}</span>}
        {state?.error && <span role="alert" className="text-sm text-nonveg">{state.error}</span>}
      </div>
    </form>
  );
}