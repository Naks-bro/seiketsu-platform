import { describe, expect, it } from "vitest";
import { findLoginCode, incomingTexts, loginMessage, newLoginCode, phoneFromWhatsApp } from "./whatsapp-login";

describe("verify on WhatsApp", () => {
  it("makes readable six-character codes that survive the round trip", () => {
    const code = newLoginCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(findLoginCode(loginMessage(code))).toBe(code);
    expect(findLoginCode(`hi! seiketsu login sk-${code.toLowerCase()} thanks`)).toBe(code);
  });

  it("ignores messages without a code", () => {
    expect(findLoginCode("Hi, what time do you open?")).toBeNull();
    expect(findLoginCode("SK-12")).toBeNull();
  });

  it("only accepts Indian mobile senders", () => {
    expect(phoneFromWhatsApp("919876543210")).toBe("9876543210");
    expect(phoneFromWhatsApp("9876543210")).toBe("9876543210");
    expect(phoneFromWhatsApp("15551234567")).toBeNull();
    expect(phoneFromWhatsApp("911234567890")).toBeNull();
  });

  it("reads text messages from a webhook delivery", () => {
    const payload = { entry: [{ changes: [{ value: { messages: [
      { from: "919876543210", type: "text", text: { body: "Seiketsu login SK-ABC234" } },
      { from: "919876543211", type: "image" },
    ] } }] }] };
    expect(incomingTexts(payload)).toEqual([{ from: "919876543210", body: "Seiketsu login SK-ABC234" }]);
  });
});
