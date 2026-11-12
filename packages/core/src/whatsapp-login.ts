/**
 * "Verify on WhatsApp": the customer sends us a short code from their own WhatsApp, which proves the number is
 * theirs. Messages a business receives are free, so this login needs no paid template.
 */
import { randomInt } from "node:crypto";

/** No 0/O, 1/I/L: easy to read back if someone types it by hand. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_RE = /\bSK-([A-HJ-NP-Z2-9]{6})\b/i;

export function newLoginCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

/** The text pre-filled in WhatsApp. */
export const loginMessage = (code: string) => `Seiketsu login SK-${code}`;

/** The code in a received message, if there is one. */
export function findLoginCode(text: string): string | null {
  const m = CODE_RE.exec(text);
  return m ? m[1].toUpperCase() : null;
}

/** WhatsApp's sender id ("919876543210") as a 10-digit Indian mobile, or null for anything else. */
export function phoneFromWhatsApp(from: string): string | null {
  const d = from.replace(/\D/g, "");
  const m = /^(?:91)?([6-9]\d{9})$/.exec(d);
  return m ? m[1] : null;
}

type Payload = { entry?: { changes?: { value?: { messages?: { from?: string; type?: string; text?: { body?: string } }[] } }[] }[] };

/** Text messages in one webhook delivery, as sender and body. */
export function incomingTexts(payload: Payload): { from: string; body: string }[] {
  const out: { from: string; body: string }[] = [];
  for (const e of payload.entry ?? [])
    for (const c of e.changes ?? [])
      for (const m of c.value?.messages ?? []) if (m.type === "text" && m.from && m.text?.body) out.push({ from: m.from, body: m.text.body });
  return out;
}
