import { describe, expect, it } from "vitest";
import {
  DEFAULT_MESSAGING,
  eventForStatus,
  financialYear,
  formatInvoiceNumber,
  generateOtp,
  hashOtp,
  maskPhone,
  messageCost,
  otpMatches,
  parseDeliveryStatus,
  spendLevel,
  withMessagingDefaults,
} from "./messaging.ts";

describe("messageCost", () => {
  const r = DEFAULT_MESSAGING.rates;
  it("prices by channel and WhatsApp category", () => {
    expect(messageCost("sms", "authentication", r)).toBe(29600);
    expect(messageCost("whatsapp", "utility", r)).toBe(13600);
    expect(messageCost("whatsapp", "marketing", r)).toBe(86310);
    expect(messageCost("email", "utility", r)).toBe(0);
  });
  it("matches the owner's quote: 1 SMS OTP + 4 WhatsApp ≈ ₹0.84", () => {
    const total = messageCost("sms", "authentication", r) + 4 * messageCost("whatsapp", "utility", r);
    expect(total / 100_000).toBeCloseTo(0.84, 2);
  });
});

describe("eventForStatus", () => {
  it("maps statuses to customer updates", () => {
    expect(eventForStatus("placed", "pickup")).toBe("placed");
    expect(eventForStatus("ready", "pickup")).toBe("ready");
    expect(eventForStatus("ready", "delivery")).toBeNull();
    expect(eventForStatus("out_for_delivery", "delivery")).toBe("out_for_delivery");
    expect(eventForStatus("rejected", "pickup")).toBe("cancelled");
    expect(eventForStatus("accepted", "pickup")).toBeNull();
  });
});

describe("spendLevel", () => {
  it("warns at 80% and stops at 100%", () => {
    expect(spendLevel(10, null)).toBe("ok");
    expect(spendLevel(79, 100)).toBe("ok");
    expect(spendLevel(80, 100)).toBe("warn");
    expect(spendLevel(100, 100)).toBe("over");
  });
});

describe("withMessagingDefaults", () => {
  it("fills missing nested keys", () => {
    const s = withMessagingDefaults({ rates: { sms: 25000 } as never, customerUpdates: { completed: true } as never });
    expect(s.rates.sms).toBe(25000);
    expect(s.rates.whatsappUtility).toBe(13600);
    expect(s.customerUpdates.completed).toBe(true);
    expect(s.customerUpdates.placed).toBe(true);
  });
});

describe("OTP", () => {
  it("generates 6 digits", () => {
    for (let i = 0; i < 50; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
  });
  it("verifies only the right code for the right challenge", () => {
    const h = hashOtp("secret", "c1", "123456");
    expect(otpMatches("secret", "c1", "123456", h)).toBe(true);
    expect(otpMatches("secret", "c1", " 123456 ", h)).toBe(true);
    expect(otpMatches("secret", "c1", "123457", h)).toBe(false);
    expect(otpMatches("secret", "c2", "123456", h)).toBe(false);
    expect(otpMatches("other", "c1", "123456", h)).toBe(false);
  });
});

describe("helpers", () => {
  it("masks phones", () => {
    expect(maskPhone("9876543210")).toBe("98XXXXXX10");
    expect(maskPhone("+91 98765 43210")).toBe("98XXXXXX10");
  });
  it("normalises delivery reports", () => {
    expect(parseDeliveryStatus("DELIVERED")).toBe("delivered");
    expect(parseDeliveryStatus("read")).toBe("read");
    expect(parseDeliveryStatus("Failed")).toBe("failed");
    expect(parseDeliveryStatus("Rejected by DND")).toBe("failed");
    expect(parseDeliveryStatus("sent")).toBe("sent");
    expect(parseDeliveryStatus("")).toBeNull();
  });
});

describe("invoice numbering", () => {
  it("uses the Indian financial year in IST", () => {
    expect(financialYear(new Date("2026-04-01T00:00:00+05:30"))).toBe("2026-27");
    expect(financialYear(new Date("2026-03-31T23:59:00+05:30"))).toBe("2025-26");
    // 31 Mar 19:00 UTC is already 1 April in India
    expect(financialYear(new Date("2027-03-31T19:00:00Z"))).toBe("2027-28");
  });
  it("formats within the 16-character GST limit", () => {
    expect(formatInvoiceNumber("SK", "2026-27", 42)).toBe("SK/2026-27/00042");
    expect(() => formatInvoiceNumber("SEIK", "2026-27", 1)).toThrow();
  });
});