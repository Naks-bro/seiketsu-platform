"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const input = "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 outline-none focus:border-berry";

type Channel = "whatsapp" | "sms";
type Sent = { challengeId: string | null; channel: Channel | null; resendAfterSeconds: number };
export type WidgetConfig = { widgetId: string; tokenAuth: string };

type Cb = (data: { message?: string; type?: string } & Record<string, unknown>) => void;
type Msg91 = {
  initSendOTP?: (cfg: Record<string, unknown>) => void;
  sendOtp?: (identifier: string, ok?: Cb, fail?: Cb) => void;
  retryOtp?: (channel: string | null, ok?: Cb, fail?: Cb, reqId?: string) => void;
  verifyOtp?: (otp: string, ok?: Cb, fail?: Cb, reqId?: string) => void;
};
const w = () => window as unknown as Msg91;
const widgetError = (e: unknown) => {
  const m = (e as { message?: unknown })?.message;
  return typeof m === "string" && m ? m : "Something went wrong. Please try again.";
};
/** MSG91 retry channel codes */
const RETRY: Record<Channel, string> = { sms: "11", whatsapp: "12" };

/**
 * Phone login. With the MSG91 widget configured, MSG91 sends and checks the
 * code and our server confirms the result; otherwise our own OTP API is used.
 */
export function PhoneLogin({ widget }: { widget: WidgetConfig | null }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<Sent | null>(null);
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [widgetReady, setWidgetReady] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function post(url: string, body: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.fieldErrors ? Object.values(data.fieldErrors)[0] : data.error ?? "Something went wrong.");
    return data;
  }

  const digits = () => phone.replace(/\D/g, "").slice(-10);

  async function sendCode(channel?: Channel) {
    setBusy(true);
    setError(null);
    try {
      if (widget) {
        // Our limits first, then MSG91 sends the code.
        await post("/api/auth/otp/widget", { action: "start", phone });
        const api = w();
        await new Promise<void>((resolve, reject) => {
          const ok: Cb = (d) => {
            setSent((s) => ({ challengeId: typeof d?.message === "string" ? d.message : s?.challengeId ?? null, channel: channel ?? null, resendAfterSeconds: 30 }));
            resolve();
          };
          if (sent && api.retryOtp) api.retryOtp(channel ? RETRY[channel] : null, ok, (e) => reject(new Error(widgetError(e))), sent.challengeId ?? undefined);
          else if (api.sendOtp) api.sendOtp(`91${digits()}`, ok, (e) => reject(new Error(widgetError(e))));
          else reject(new Error("Login is still loading. Please try again in a moment."));
        });
        setCode("");
        setWait(30);
      } else {
        const r: Sent = await post("/api/auth/otp/request", { phone, channel });
        setSent(r);
        setCode("");
        setWait(r.resendAfterSeconds);
      }
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
      if (widget) {
        const accessToken = await new Promise<string>((resolve, reject) => {
          const api = w();
          if (!api.verifyOtp) return reject(new Error("Login is still loading. Please try again."));
          api.verifyOtp(
            code,
            (d) => (typeof d?.message === "string" ? resolve(d.message) : reject(new Error("Could not verify the code."))),
            (err) => reject(new Error(widgetError(err))),
            sent.challengeId ?? undefined,
          );
        });
        await post("/api/auth/otp/widget", { action: "verify", phone, accessToken });
      } else {
        await post("/api/auth/otp/verify", { challengeId: sent.challengeId, code });
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const sentBy = sent?.channel === "sms" ? "SMS" : sent?.channel === "whatsapp" ? "WhatsApp" : "WhatsApp or SMS";

  return (
    <div className="max-w-sm space-y-5">
      {widget && (
        <Script
          src="https://verify.msg91.com/otp-provider.js"
          strategy="afterInteractive"
          onLoad={() => {
            w().initSendOTP?.({
              widgetId: widget.widgetId,
              tokenAuth: widget.tokenAuth,
              exposeMethods: true,
              captchaRenderId: "msg91-captcha",
              success: () => {},
              failure: () => {},
            });
            setWidgetReady(true);
          }}
        />
      )}
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
          {widget && <div id="msg91-captcha" />}
          <button type="submit" disabled={busy || (!!widget && !widgetReady)} className="w-full rounded-full bg-berry py-3 font-semibold text-cream hover:bg-berry-deep disabled:opacity-60">
            {busy ? "Sending…" : widget ? "Send code" : "Send code on WhatsApp"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          <p className="text-sm">
            We sent a code by {sentBy} to <strong>+91 {digits()}</strong>.{" "}
            <button type="button" className="text-berry underline" onClick={() => setSent(null)}>Change</button>
          </p>
          <label htmlFor="code" className="block text-sm font-medium">Code</label>
          <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className={`${input} tracking-[0.4em]`} required autoFocus />
          <button type="submit" disabled={busy || code.length < 4} className="w-full rounded-full bg-berry py-3 font-semibold text-cream hover:bg-berry-deep disabled:opacity-60">
            {busy ? "Checking…" : "Sign in"}
          </button>
          <div className="flex justify-between text-sm">
            <button type="button" disabled={wait > 0 || busy} onClick={() => sendCode(sent.channel ?? undefined)} className="text-berry disabled:text-muted">
              {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
            </button>
            {sent.channel !== "sms" && (
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