"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const input = "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 outline-none focus:border-berry";

type Sent = { challengeId: string; channel: "whatsapp" | "sms"; resendAfterSeconds: number };

export function PhoneLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<Sent | null>(null);
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function post(url: string, body: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.fieldErrors ? Object.values(data.fieldErrors)[0] : data.error ?? "Something went wrong.");
    return data;
  }

  async function sendCode(channel?: "sms") {
    setBusy(true);
    setError(null);
    try {
      const r: Sent = await post("/api/auth/otp/request", { phone, channel });
      setSent(r);
      setCode("");
      setWait(r.resendAfterSeconds);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!sent) return;
    setBusy(true);
    setError(null);
    try {
      await post("/api/auth/otp/verify", { challengeId: sent.challengeId, code });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="max-w-sm space-y-5">
      {!sent ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendCode();
          }}
          className="space-y-3"
        >
          <label htmlFor="phone" className="block text-sm font-medium">Mobile number</label>
          <div className="flex gap-2">
            <span className="grid place-items-center rounded-xl border border-line bg-paper px-3 text-sm text-muted">+91</span>
            <input id="phone" inputMode="numeric" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} placeholder="10-digit mobile" required />
          </div>
          <button type="submit" disabled={busy} className="w-full rounded-full bg-berry py-3 font-semibold text-cream hover:bg-berry-deep disabled:opacity-60">
            {busy ? "Sending…" : "Send code on WhatsApp"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          <p className="text-sm">
            We sent a 6-digit code by {sent.channel === "whatsapp" ? "WhatsApp" : "SMS"} to <strong>+91 {phone}</strong>.{" "}
            <button type="button" className="text-berry underline" onClick={() => setSent(null)}>Change</button>
          </p>
          <label htmlFor="code" className="block text-sm font-medium">Code</label>
          <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className={`${input} tracking-[0.4em]`} required autoFocus />
          <button type="submit" disabled={busy || code.length !== 6} className="w-full rounded-full bg-berry py-3 font-semibold text-cream hover:bg-berry-deep disabled:opacity-60">
            {busy ? "Checking…" : "Sign in"}
          </button>
          <div className="flex justify-between text-sm">
            <button type="button" disabled={wait > 0 || busy} onClick={() => sendCode()} className="text-berry disabled:text-muted">
              {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
            </button>
            {sent.channel === "whatsapp" && (
              <button type="button" disabled={wait > 0 || busy} onClick={() => sendCode("sms")} className="text-berry disabled:text-muted">
                Send by SMS instead
              </button>
            )}
          </div>
        </form>
      )}
      {error && <p role="alert" className="rounded-lg bg-nonveg/10 p-3 text-sm text-nonveg">{error}</p>}
    </div>
  );
}