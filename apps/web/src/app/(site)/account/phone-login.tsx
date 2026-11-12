"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const input = "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 outline-none focus:border-berry";

type Channel = "whatsapp" | "sms";
type Sent = { challengeId: string | null; channel: Channel | null; resendAfterSeconds: number; test?: boolean };
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

type WaStart = { text: string; number: string; link: string };

/**
 * "Verify on WhatsApp": the customer sends a pre-filled code to our number from their own WhatsApp; this page
 * waits for it to arrive and signs them in. Free for both sides, and nothing to type.
 */
function WhatsAppLogin() {
  const router = useRouter();
  const [wa, setWa] = useState<WaStart | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wa) return;
    let stop = false;
    const started = Date.now();
    const tick = async () => {
      if (stop) return;
      if (Date.now() - started > 10 * 60_000) {
        setWa(null);
        setError("That took too long. Please start again.");
        return;
      }
      try {
        const res = await fetch("/api/auth/wa/check", { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.status === "signed-in") {
          router.refresh();
          return;
        }
        if (!res.ok) {
          setWa(null);
          setError(data.error ?? "Something went wrong. Please start again.");
          return;
        }
      } catch {
        /* offline for a moment: keep waiting */
      }
      setTimeout(tick, 2500);
    };
    const t = setTimeout(tick, 2500);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [wa, router]);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/wa/start", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setWa(data as WaStart);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {!wa ? (
        <button type="button" onClick={start} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-veg py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60">
          {busy ? "One moment…" : "Verify on WhatsApp"}
        </button>
      ) : (
        <div role="status" className="space-y-3 rounded-2xl border border-line bg-white p-4 text-sm">
          <p>Tap below to open WhatsApp, then press <strong>send</strong>. The message is already written for you.</p>
          <a href={wa.link} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center rounded-full bg-veg py-3 font-semibold text-white hover:opacity-90">
            Open WhatsApp and send
          </a>
          <p className="text-muted">
            Or send <strong className="text-ink">{wa.text}</strong> to <strong className="text-ink">+{wa.number}</strong> on WhatsApp. Waiting for your message…
          </p>
          <button type="button" className="text-berry underline" onClick={() => setWa(null)}>Cancel</button>
        </div>
      )}
      {error && <p role="alert" className="rounded-lg bg-nonveg/10 p-3 text-sm text-nonveg">{error}</p>}
    </div>
  );
}

/**
 * Phone login. "Verify on WhatsApp" when set up; codes by WhatsApp or SMS when a sender is set up. With the
 * MSG91 widget configured, MSG91 sends and checks the code and our server confirms the result.
 */
export function PhoneLogin({ widget, whatsapp = false, codes = true }: { widget: WidgetConfig | null; whatsapp?: boolean; codes?: boolean }) {
  if (whatsapp && !codes) {
    return (
      <div className="max-w-sm">
        <WhatsAppLogin />
      </div>
    );
  }
  return (
    <div className="max-w-sm space-y-5">
      {whatsapp && (
        <>
          <WhatsAppLogin />
          <p className="text-center text-sm text-muted">or get a code</p>
        </>
      )}
      <CodeLogin widget={widget} />
    </div>
  );
}

function CodeLogin({ widget }: { widget: WidgetConfig | null }) {
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
        const start = await post("/api/auth/otp/widget", { action: "start", phone });
        if (start.test) {
          setSent({ challengeId: null, channel: null, resendAfterSeconds: 30, test: true });
          setCode("");
          return;
        }
        const api = w();
        const report = (ok: boolean, error?: string) => void post("/api/auth/otp/widget", { action: "sent", phone, ok, error }).catch(() => {});
        await new Promise<void>((resolve, reject) => {
          const ok: Cb = (d) => {
            report(true);
            setSent((s) => ({ challengeId: typeof d?.message === "string" ? d.message : s?.challengeId ?? null, channel: channel ?? null, resendAfterSeconds: 30 }));
            resolve();
          };
          const fail: Cb = (e) => {
            report(false, widgetError(e));
            reject(new Error(widgetError(e)));
          };
          if (sent && api.retryOtp) api.retryOtp(channel ? RETRY[channel] : null, ok, fail, sent.challengeId ?? undefined);
          else if (api.sendOtp) api.sendOtp(`91${digits()}`, ok, fail);
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
      if (sent.test) {
        await post("/api/auth/otp/widget", { action: "verify-test", phone, code });
      } else if (widget) {
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

  const sentBy = sent?.test ? "test login (no SMS — use your test code)" : sent?.channel === "sms" ? "SMS" : sent?.channel === "whatsapp" ? "WhatsApp" : "WhatsApp or SMS";

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