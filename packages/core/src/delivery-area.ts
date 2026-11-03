/** Delivery area rules shared by the browser check and the server. */

export const PINCODE_RE = /^[1-9]\d{5}$/;

export const isPincode = (pin: string) => PINCODE_RE.test(pin.trim());

/** An empty list means the outlet has not limited delivery to any pincodes. */
export function isServiceable(pin: string, pincodes: readonly string[]) {
  const p = pin.trim();
  if (!isPincode(p)) return false;
  return pincodes.length === 0 || pincodes.includes(p);
}

/** Most pincodes one outlet's list may hold. */
export const MAX_PINCODES = 5000;

/**
 * Pulls pincodes out of pasted text or spreadsheet cells, in whatever shape they arrive: "400061",
 * 400061 (a number cell), "400 061", "400061 - Versova" or several per line. Numbers that look like an
 * attempt at a pincode but are not one (5–7 digits) are returned as `invalid`; phone numbers, years and
 * counts are ignored.
 */
export function extractPincodes(values: Iterable<unknown>): { valid: string[]; invalid: string[] } {
  const valid = new Set<string>();
  const invalid = new Set<string>();
  for (const v of values) {
    if (v == null || typeof v === "boolean") continue;
    for (const m of String(v).matchAll(/(?<!\d)\d{3} \d{3}(?!\d)|\d+/g)) {
      const digits = m[0].replace(" ", "");
      if (isPincode(digits)) valid.add(digits);
      else if (digits.length >= 5 && digits.length <= 7) invalid.add(m[0]);
    }
  }
  return { valid: [...valid], invalid: [...invalid] };
}

/** The list after adding pincodes to it (or replacing it with them): unique and sorted. */
export function mergePincodes(current: readonly string[], incoming: readonly string[], mode: "add" | "replace"): string[] {
  const next = new Set(mode === "replace" ? [] : current);
  for (const p of incoming) if (isPincode(p)) next.add(p);
  return [...next].sort();
}
