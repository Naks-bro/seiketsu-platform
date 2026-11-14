"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Start = { text: string; number: string; link: string; expiresInSeconds: number };
type Phase = "loading" | "waiting" | "verified" | "expired" | "error";

/** 15557742979 → +1 555-774-2979, 919876543210 → +91 98765 43210 */
function prettyNumber(n: string) {
  if (/^1\d{10}$/.test(n)) return `+1 ${n.slice(1, 4)}-${n.slice(4, 7)}-${n.slice(7)}`;
  if (/^91\d{10}$/.test(n)) return `+91 ${n.slice(2, 7)} ${n.slice(7)}`;
  return `+${n}`;
}

/** Starts a login: the code to send, and a QR code of the WhatsApp link drawn locally. */
async function requestCode(): Promise<{ s: Start; svg: string | null }> {
  const res = await fetch("/api/auth/wa/start", { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  const s = data as Start;
  const svg = await import("qrcode")
    .then((QR) => QR.toString(s.link, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#2a181e", light: "#ffffff" } }))
    .catch(() => null);
  return { s, svg };
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Sign in by sending us a code on WhatsApp ("reverse OTP"). Used until Meta lets the site send codes itself: the
 * customer's own message proves the number and costs nothing. Phones get one button that opens WhatsApp with the
 * message written; computers get a QR code to scan with the phone, drawn here so the code never leaves the page.
 */
export function WhatsAppVerify() {
  const router = useRouter();
  const [wa, setWa] = useState<Start | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [copied, setCopied] = useState(false);

  const start = useCallback(() => {
    requestCode().then(
      ({ s, svg }) => {
        setWa(s);
        setLeft(s.expiresInSeconds);
        setError(null);
        setPhase("waiting");
        setQr(svg);
      },
      (e: Error) => {
        setError(e.message);
        setPhase("error");
      },
    );
  }, []);

  useEffect(start, [start]);

  // Count down, and watch for the message to arrive.
  useEffect(() => {
    if (phase !== "waiting" || !wa) return;
    let stop = false;
    const until = Date.now() + wa.expiresInSeconds * 1000;
    const clock = setInterval(() => {
      const s = Math.max(0, Math.round((until - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) setPhase("expired");
    }, 1000);
    const tick = async () => {
      if (stop) return;
      try {
        const res = await fetch("/api/auth/wa/check", { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.status === "signed-in") {
          setPhase("verified");
          setTimeout(() => router.refresh(), 900);
          return;
        }
        if (!res.ok) {
          setError(data.error ?? "Something went wrong. Please start again.");
          setPhase("error");
          return;
        }
      } catch {
        /* offline for a moment: keep waiting */
      }
      setTimeout(tick, 2000);
    };
    const t = setTimeout(tick, 2000);
    return () => {
      stop = true;
      clearInterval(clock);
      clearTimeout(t);
    };
  }, [phase, wa, router]);

  async function copy() {
    if (!wa) return;
    try {
      await navigator.clipboard.writeText(wa.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the message is on screen to type */
    }
  }

  function again() {
    setPhase("loading");
    setQr(null);
    void start();
  }

  const code = wa?.text.match(/SK-[A-Z0-9]+/i)?.[0] ?? "";

  return (
    <div className="w-full max-w-sm md:max-w-2xl">
      <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-[0_1px_2px_rgba(42,24,30,.04),0_12px_32px_-12px_rgba(42,24,30,.18)]">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-line px-6 py-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#25d366]/15 text-[#128c4a]">
            <WhatsAppIcon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold leading-tight">Sign in with WhatsApp</p>
            <p className="text-xs text-muted">Free · instant · no password</p>
          </div>
          {phase === "waiting" && (
            <span className="ml-auto rounded-full bg-paper px-2.5 py-1 text-xs tabular-nums text-muted" aria-label={`Code valid for ${mmss(left)}`}>
              {mmss(left)}
            </span>
          )}
        </div>

        {phase === "verified" ? (
          <div role="status" className="grid place-items-center gap-3 px-6 py-14 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-veg text-white">
              <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            <p className="font-display text-2xl text-ink">You&apos;re verified</p>
            <p className="text-sm text-muted">Signing you in…</p>
          </div>
        ) : phase === "expired" || phase === "error" ? (
          <div className="space-y-4 px-6 py-10 text-center">
            <p className="font-display text-xl">{phase === "expired" ? "That code has expired" : "Something went wrong"}</p>
            <p className="text-sm text-muted">{phase === "expired" ? "Codes last 10 minutes. Get a fresh one and try again." : error}</p>
            <button type="button" onClick={again} className="rounded-full bg-berry px-6 py-3 font-semibold text-cream transition hover:bg-berry-deep">
              Get a new code
            </button>
          </div>
        ) : (
          <div className="grid gap-6 p-6 md:grid-cols-[200px_1fr] md:gap-8">
            {/* Computers: scan with the phone */}
            <div className="hidden md:block">
              <div className="aspect-square rounded-2xl border border-line bg-white p-3">
                {qr ? (
                  <div className="size-full [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} />
                ) : (
                  <div className="size-full animate-pulse rounded-xl bg-paper" />
                )}
              </div>
              <p className="mt-2 text-center text-xs text-muted">Scan with your phone&apos;s camera</p>
            </div>

            <div className="space-y-5">
              <ol className="space-y-2.5 text-sm">
                {[
                  <>
                    <span className="md:hidden">Tap the button to open WhatsApp</span>
                    <span className="hidden md:inline">Scan the code with your phone</span>
                  </>,
                  <>Press <strong>send</strong>. The message is written for you</>,
                  <>You&apos;re signed in here automatically</>,
                ].map((s, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-paper text-xs font-semibold text-berry">{i + 1}</span>
                    <span className="pt-0.5">{s}</span>
                  </li>
                ))}
              </ol>

              <div className="flex items-center justify-between gap-3 rounded-2xl bg-cream px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Your code</p>
                  <p aria-live="polite" className="font-display text-2xl tracking-wider text-berry">
                    {code || <span className="inline-block h-7 w-32 animate-pulse rounded bg-paper align-middle" />}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={copy}
                  disabled={!wa}
                  className="shrink-0 rounded-full border border-line bg-white px-3.5 py-2 text-xs font-semibold text-ink transition hover:border-berry/40 disabled:opacity-50"
                >
                  {copied ? "Copied ✓" : "Copy message"}
                </button>
              </div>

              <a
                href={wa?.link}
                target="_blank"
                rel="noreferrer"
                aria-disabled={!wa}
                className={`flex w-full items-center justify-center gap-2.5 rounded-full py-3.5 font-semibold transition ${wa ? "" : "pointer-events-none opacity-50"} bg-[#25d366] text-[#0b3d1f] shadow-sm hover:brightness-95 md:border md:border-line md:bg-white md:text-ink md:shadow-none md:hover:bg-paper md:hover:brightness-100`}
              >
                <WhatsAppIcon className="size-5" />
                <span className="md:hidden">Open WhatsApp &amp; send</span>
                <span className="hidden md:inline">Or open WhatsApp on this computer</span>
              </a>

              {wa && (
                <p className="text-center text-xs text-muted">
                  You can also send <span className="font-medium text-ink">{wa.text}</span> to <span className="whitespace-nowrap font-medium text-ink">{prettyNumber(wa.number)}</span>
                </p>
              )}

              <p role="status" className="flex items-center justify-center gap-2 text-sm text-muted">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full rounded-full bg-[#25d366] opacity-75 motion-safe:animate-ping" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-[#25d366]" />
                </span>
                {wa ? "Waiting for your message" : "Getting your code…"}
              </p>
            </div>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">We only use your number to sign you in and send updates about your orders.</p>
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
