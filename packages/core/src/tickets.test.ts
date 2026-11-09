import { describe, expect, it } from "vitest";
import { canSetStatus, newTicketSchema, statusAfterCustomerReply, statusAfterStaffReply } from "./tickets.ts";

const good = { name: "Asha", phone: "98765 43210", email: "", category: "order", subject: "Missing dip", message: "My order came without the hummus dip." };

describe("ticket rules", () => {
  it("accepts a complete request and normalises the phone", () => {
    const r = newTicketSchema.parse(good);
    expect(r.phone).toBe("9876543210");
  });
  it("asks for enough detail", () => {
    expect(newTicketSchema.safeParse({ ...good, message: "help" }).success).toBe(false);
    expect(newTicketSchema.safeParse({ ...good, category: "nonsense" }).success).toBe(false);
  });
  it("reopens on a customer reply unless closed", () => {
    expect(statusAfterCustomerReply("waiting")).toBe("open");
    expect(statusAfterCustomerReply("resolved")).toBe("open");
    expect(statusAfterCustomerReply("closed")).toBeNull();
  });
  it("hands an open ticket to the customer on a visible reply only", () => {
    expect(statusAfterStaffReply("open", false)).toBe("waiting");
    expect(statusAfterStaffReply("open", true)).toBe("open");
    expect(statusAfterStaffReply("resolved", false)).toBe("resolved");
  });
  it("allows only sensible status moves", () => {
    expect(canSetStatus("open", "resolved")).toBe(true);
    expect(canSetStatus("closed", "resolved")).toBe(false);
    expect(canSetStatus("closed", "open")).toBe(true);
  });
});
