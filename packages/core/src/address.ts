/** Saved delivery addresses: the shape customers fill in, and how an address reads on an order. */
import { z } from "zod";

export const MAX_SAVED_ADDRESSES = 10;
export const ADDRESS_LABELS = ["Home", "Work", "Other"] as const;

export const addressSchema = z.object({
  label: z.string().trim().min(1, "Name this address").max(40),
  house: z.string().trim().min(1, "Enter your flat or house number").max(80),
  building: z.string().trim().max(120).optional().default(""),
  area: z.string().trim().min(3, "Enter the street or area").max(160),
  landmark: z.string().trim().max(120).optional().default(""),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a 6-digit pincode"),
  city: z.string().trim().max(60).optional().default(""),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  instructions: z.string().trim().max(200).optional().default(""),
  isDefault: z.boolean().optional().default(false),
});

export type AddressInput = z.input<typeof addressSchema>;
export type AddressData = z.output<typeof addressSchema>;

/** The single delivery line the kitchen, rider and bills show: "Flat 4B, Sea Breeze, JP Road, Versova". */
export function addressLine(a: { house: string; building?: string | null; area: string; city?: string | null }): string {
  const parts = [a.house, a.building, a.area].map((p) => p?.trim()).filter(Boolean) as string[];
  const city = a.city?.trim();
  if (city && !parts.some((p) => p.toLowerCase().includes(city.toLowerCase()))) parts.push(city);
  return parts.join(", ");
}
