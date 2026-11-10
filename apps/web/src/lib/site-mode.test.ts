import { describe, expect, it } from "vitest";
import { isOrderingPath } from "./site-mode";

describe("landing-only mode", () => {
  it("switches off ordering pages but keeps the rest", () => {
    for (const p of ["/menu", "/checkout", "/account", "/subscribe/weekly", "/subscription/abc", "/support", "/support/abc", "/order/abc"]) expect(isOrderingPath(p)).toBe(true);
    for (const p of ["/", "/privacy", "/terms", "/refunds", "/delivery", "/contact", "/admin", "/api/webhooks/whatsapp", "/bill/abc", "/menus"]) expect(isOrderingPath(p)).toBe(false);
  });
});
