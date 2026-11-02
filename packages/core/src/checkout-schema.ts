import { z } from "zod";

export const cartLineSchema = z.object({
  menuItemId: z.string().uuid(),
  variantId: z.string().uuid(),
  addOnIds: z.array(z.string().uuid()).max(20).default([]),
  quantity: z.number().int().min(1).max(20),
  note: z.string().trim().max(200).optional(),
});

/** Indian mobile: 10 digits starting 6-9, with optional +91 / 91 / 0 prefix. */
export const indianMobile = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number"));

export const checkoutSchema = z
  .object({
    lines: z.array(cartLineSchema).min(1, "Your cart is empty").max(40),
    customer: z.object({
      name: z.string().trim().min(2, "Enter your name").max(80),
      phone: indianMobile,
      email: z.union([z.literal(""), z.string().trim().email("Enter a valid email").max(120)]).optional(),
    }),
    fulfilment: z.enum(["pickup", "delivery"]),
    address: z
      .object({
        line1: z.string().trim().min(5, "Enter your address").max(200),
        landmark: z.string().trim().max(120).optional(),
        pincode: z.string().trim().regex(/^\d{6}$/, "Enter a 6-digit pincode"),
        instructions: z.string().trim().max(200).optional(),
      })
      .optional(),
    notes: z.string().trim().max(300).optional(),
    source: z.enum(["web", "qr"]).default("web"),
    /** Marketing opt-ins; order updates do not need consent. */
    marketing: z.object({ whatsapp: z.boolean().default(false), email: z.boolean().default(false) }).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.fulfilment === "delivery" && !v.address) {
      ctx.addIssue({ code: "custom", path: ["address"], message: "Delivery address is required" });
    }
  });

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutData = z.output<typeof checkoutSchema>;
