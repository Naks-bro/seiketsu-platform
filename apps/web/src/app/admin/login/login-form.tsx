"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Email</span>
        <input name="email" type="email" autoComplete="username" required className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 outline-none focus:border-berry" />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 outline-none focus:border-berry" />
      </label>
      {state?.error && <p role="alert" className="text-sm text-nonveg">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-full bg-berry py-3 font-semibold text-cream hover:bg-berry-deep disabled:opacity-60">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}