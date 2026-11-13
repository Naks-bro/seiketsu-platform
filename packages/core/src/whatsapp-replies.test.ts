import { describe, expect, it } from "vitest";
import { incomingMessages, intentOf, orderUpdateText, welcomeText } from "./whatsapp-replies";

describe("whatsapp replies", () => {
  it("reads what the customer wants", () => {
    expect(intentOf("Seiketsu login SK-ABC234")).toEqual({ kind: "login" });
    expect(intentOf("Track SK-1006")).toEqual({ kind: "track", orderNumber: "SK-1006" });
    expect(intentOf("where is sk1006?")).toEqual({ kind: "track", orderNumber: "SK-1006" });
    expect(intentOf("hi")).toEqual({ kind: "hello" });
    expect(intentOf("")).toEqual({ kind: "hello" });
  });

  it("collects every incoming message, with text when there is some", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  { from: "919000000000", type: "text", text: { body: "Track SK-1006" } },
                  { from: "919000000001", type: "image" },
                  { type: "text", text: { body: "no sender" } },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(incomingMessages(payload)).toEqual([
      { from: "919000000000", text: "Track SK-1006" },
      { from: "919000000001", text: "" },
    ]);
  });

  it("writes order updates and the welcome", () => {
    const v = { name: "Asha", order: "SK-1006", total: "Rs. 300", link: "https://x/order/t", reason: "x", amount: "Rs. 300" };
    expect(orderUpdateText("order_ready", v)).toContain("*SK-1006* is packed");
    expect(orderUpdateText("otp", v)).toBeNull();
    const w = welcomeText({ siteUrl: "https://www.seiketsu.co.in", mapUrl: "https://maps", helpNumber: "919000000000" });
    expect(w).toContain("https://www.seiketsu.co.in/menu");
    expect(w).toContain("wa.me/919000000000");
  });
});
