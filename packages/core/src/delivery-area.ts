/** Delivery area rules shared by the browser check and the server. */

export const PINCODE_RE = /^[1-9]\d{5}$/;

export const isPincode = (pin: string) => PINCODE_RE.test(pin.trim());

/** An empty list means the outlet has not limited delivery to any pincodes. */
export function isServiceable(pin: string, pincodes: readonly string[]) {
  const p = pin.trim();
  if (!isPincode(p)) return false;
  return pincodes.length === 0 || pincodes.includes(p);
}
