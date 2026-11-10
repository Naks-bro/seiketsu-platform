import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyMetaSignature, webhookChallenge, whatsappEventId, whatsappEventLabel } from "./whatsapp-webhook";

const q = (s: string) => new URLSearchParams(s);

describe("whatsapp webhook", () => {
  it("echoes the challenge only for the right token", () => {
    expect(webhookChallenge(q("hub.mode=subscribe&hub.verify_token=abc&hub.challenge=42"), "abc")).toBe("42");
    expect(webhookChallenge(q("hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42"), "abc")).toBeNull();
    expect(webhookChallenge(q("hub.mode=unsubscribe&hub.verify_token=abc&hub.challenge=42"), "abc")).toBeNull();
    expect(webhookChallenge(q("hub.mode=subscribe&hub.verify_token=abc&hub.challenge=42"), undefined)).toBeNull();
  });

  it("accepts Meta's signature and rejects anything else", () => {
    const raw = '{"object":"whatsapp_business_account"}';
    const sig = "sha256=" + createHmac("sha256", "secret").update(raw).digest("hex");
    expect(verifyMetaSignature(raw, sig, "secret")).toBe(true);
    expect(verifyMetaSignature(raw + " ", sig, "secret")).toBe(false);
    expect(verifyMetaSignature(raw, sig, "other")).toBe(false);
    expect(verifyMetaSignature(raw, null, "secret")).toBe(false);
    expect(verifyMetaSignature(raw, sig.slice(7), "secret")).toBe(false);
  });

  it("gives the same id to a resent delivery", () => {
    expect(whatsappEventId("x")).toBe(whatsappEventId("x"));
    expect(whatsappEventId("x")).not.toBe(whatsappEventId("y"));
  });

  it("labels message and status events", () => {
    expect(whatsappEventLabel({ entry: [{ changes: [{ field: "messages", value: { statuses: [{}] } }] }] })).toBe("whatsapp:messages:status");
    expect(whatsappEventLabel({ entry: [{ changes: [{ field: "messages", value: { messages: [{}] } }] }] })).toBe("whatsapp:messages:message");
    expect(whatsappEventLabel({})).toBe("whatsapp:unknown:other");
  });
});
