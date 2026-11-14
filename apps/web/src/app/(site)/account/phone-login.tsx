"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const CODE_LENGTH = 6;

type Sent = { challengeId: string; resendAfterSeconds: number };

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.fieldErrors ? Object.values(data.fieldErrors)[0] : data.error ?? "Something went wrong.");
  return data;
}

/**
 * Phone login: the customer enters their mobile number, gets a 6-digit code on WhatsApp, and types it here.
 */
export function PhoneLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<Sent | null>(null);
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const digits = phone.replace(/\D/g, "").slice(-10);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const r: Sent = await post("/api/auth/otp/request", { phone: digits });
      setSent(r);
      setCode("");
      setWait(r.resendAfterSeconds);
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(value = code) {
    if (!sent || value.length < CODE_LENGTH) return;
    setBusy(true);
    setError(null);
    try {
      await post("/api/auth/otp/verify", { challengeId: sent.challengeId, code: value });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setCode("");
      setBusy(false);
      codeRef.current?.focus();
    }
  }

  return (
    <div className="max-w-sm">
      <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
        {!sent ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendCode();
            }}
            className="space-y-4 p-6"
          >
            <div>
              <label htmlFor="phone" className="block text-sm font-semibold">Mobile number</label>
              <p className="mt-0.5 text-xs text-muted">We&apos;ll send a 6-digit code to this number on WhatsApp.</p>
            </div>
            <div className="flex overflow-hidden rounded-2xl border border-line bg-cream focus-within:border-berry">
              <span className="grid place-items-center border-r border-line px-4 text-sm font-medium text-muted">+91</span>
              <input
                id="phone"
                inputMode="numeric"
                autoComplete="tel-national"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, ""))}
                className="w-full bg-transparent px-4 py-3.5 text-lg tracking-wide outline-none"
                placeholder="98765 43210"
                maxLength={12}
                required
              />
            </div>
            <button
              type="submit"
              disabled={busy || digits.length !== 10}
              className="flex w-full items-center justify-center gap-2.5 rounded-full bg-[#25d366] py-3.5 font-semibold text-[#0b3d1f] shadow-sm transition hover:brightness-95 disabled:opacity-50"
            >
              <WhatsAppIcon className="size-5" />
              {busy ? "Sending…" : "Send code on WhatsApp"}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void verify();
            }}
            className="space-y-5 p-6"
          >
            <div>
              <p className="text-sm font-semibold">Enter the code</p>
              <p className="mt-0.5 text-sm text-muted">
                Sent on WhatsApp to <span className="font-medium text-ink">+91 {digits.slice(0, 5)} {digits.slice(5)}</span>{" "}
                <button type="button" className="text-berry hover:underline" onClick={() => { setSent(null); setError(null); }}>
                  Change
                </button>
              </p>
            </div>

            <label htmlFor="code" className="sr-only">6-digit code</label>
            <div className="group relative">
              <input
                ref={codeRef}
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={CODE_LENGTH}
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
                  setCode(v);
                  if (v.length === CODE_LENGTH) void verify(v);
                }}
                disabled={busy}
                className="absolute inset-0 z-10 w-full cursor-text opacity-0"
                autoFocus
              />
              <div aria-hidden="true" className="grid grid-cols-6 gap-2">
                {Array.from({ length: CODE_LENGTH }, (_, i) => {
                  const active = i === Math.min(code.length, CODE_LENGTH - 1);
                  return (
                    <span
                      key={i}
                      className={`grid aspect-[4/5] place-items-center rounded-xl border-2 bg-cream font-display text-2xl text-ink transition ${active ? "border-line group-focus-within:border-berry" : code[i] ? "border-ink/30" : "border-line"}`}
                    >
                      {code[i] ?? ""}
                    </span>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={busy || code.length < CODE_LENGTH}
              className="w-full rounded-full bg-berry py-3.5 font-semibold text-cream transition hover:bg-berry-deep disabled:opacity-50"
            >
              {busy ? "Checking…" : "Sign in"}
            </button>

            <p className="text-center text-sm text-muted">
              Didn&apos;t get it?{" "}
              <button type="button" disabled={wait > 0 || busy} onClick={() => void sendCode()} className="font-medium text-berry hover:underline disabled:text-muted disabled:no-underline">
                {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
              </button>
            </p>
          </form>
        )}
      </div>
      {error && <p role="alert" className="mt-3 rounded-xl bg-nonveg/10 p-3 text-sm text-nonveg">{error}</p>}
    </div>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.79-1.31l-.34-.2-3.56.93.95-3.47-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.44-9.43 2.52 0 4.89.98 6.67 2.77a9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.23 9.43-9.43 9.43m8.03-17.46A11.27 11.27 0 0 0 12.05.72C5.79.72.7 5.8.7 12.07c0 2 .52 3.95 1.52 5.67L.6 23.65l6.05-1.59a11.3 11.3 0 0 0 5.4 1.38h.01c6.26 0 11.35-5.09 11.35-11.35 0-3.03-1.18-5.88-3.33-8.03" />
    </svg>
  );
}
