import { describe, expect, it } from "vitest";
import { checkTransition, staffActions } from "./order-status.ts";

describe("order status rules", () => {
  it("only the system can mark an order paid", () => {
    expect(checkTransition({ from: "pending_payment", to: "placed", actor: "system", fulfilment: "pickup" }).ok).toBe(true);
    expect(checkTransition({ from: "pending_payment", to: "placed", actor: "staff", fulfilment: "pickup" }).ok).toBe(false);
  });

  it("staff cannot skip steps", () => {
    expect(checkTransition({ from: "placed", to: "ready", actor: "staff", fulfilment: "pickup" }).ok).toBe(false);
  });

  it("rejecting needs a reason", () => {
    expect(checkTransition({ from: "placed", to: "rejected", actor: "staff", fulfilment: "pickup" }).ok).toBe(false);
    expect(
      checkTransition({ from: "placed", to: "rejected", actor: "staff", fulfilment: "pickup", reason: "Out of avocado" }).ok,
    ).toBe(true);
  });

  it("pickup and delivery finish differently", () => {
    expect(staffActions("ready", "pickup").map((r) => r.to)).toEqual(["completed"]);
    expect(staffActions("ready", "delivery").map((r) => r.to)).toEqual(["out_for_delivery"]);
  });

  it("a late payment on an expired order is still accepted", () => {
    expect(checkTransition({ from: "expired", to: "placed", actor: "system", fulfilment: "pickup" }).ok).toBe(true);
  });

  it("finished orders are final", () => {
    expect(staffActions("completed", "pickup")).toEqual([]);
    expect(staffActions("cancelled", "pickup")).toEqual([]);
  });
});
