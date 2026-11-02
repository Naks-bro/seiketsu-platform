import { describe, expect, it } from "vitest";
import { checkoutSchema } from "./checkout-schema.ts";

const id = "11111111-1111-4111-8111-111111111111";
const base = {
  lines: [{ menuItemId: id, variantId: id, quantity: 1 }],
  customer: { name: "Asha", phone: "+91 98765 43210" },
  fulfilment: "pickup" as const,
};

describe("checkout validation", () => {
  it("normalises Indian mobile numbers", () => {
    expect(checkoutSchema.parse(base).customer.phone).toBe("9876543210");
  });

  it("rejects invalid mobiles", () => {
    expect(checkoutSchema.safeParse({ ...base, customer: { name: "Asha", phone: "12345" } }).success).toBe(false);
  });

  it("requires an address for delivery", () => {
    expect(checkoutSchema.safeParse({ ...base, fulfilment: "delivery" }).success).toBe(false);
    const address = { line1: "Bungalow 12, JP Road", pincode: "400061" };
    expect(checkoutSchema.safeParse({ ...base, fulfilment: "delivery", address }).success).toBe(true);
  });
});
