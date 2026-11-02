import { describe, expect, it } from "vitest";
import { hmacHex, verifyPaymentSignature, verifyWebhookSignature } from "./razorpay-signature.ts";

describe("Razorpay signatures", () => {
  const secret = "test_secret";

  it("accepts a correct payment signature and rejects tampering", () => {
    const signature = hmacHex("order_ABC|pay_XYZ", secret);
    const ok = { razorpayOrderId: "order_ABC", razorpayPaymentId: "pay_XYZ", signature, keySecret: secret };
    expect(verifyPaymentSignature(ok)).toBe(true);
    expect(verifyPaymentSignature({ ...ok, razorpayPaymentId: "pay_OTHER" })).toBe(false);
    expect(verifyPaymentSignature({ ...ok, signature: "short" })).toBe(false);
  });

  it("matches a known HMAC-SHA256 vector", () => {
    expect(hmacHex("The quick brown fox jumps over the lazy dog", "key")).toBe(
      "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8",
    );
  });

  it("verifies webhook bodies byte for byte", () => {
    const body = JSON.stringify({ event: "payment.captured", id: 1 });
    const sig = hmacHex(body, "whsec");
    expect(verifyWebhookSignature(body, sig, "whsec")).toBe(true);
    expect(verifyWebhookSignature(body + " ", sig, "whsec")).toBe(false);
  });
});
