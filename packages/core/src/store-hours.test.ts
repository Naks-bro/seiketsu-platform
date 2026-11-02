import { describe, expect, it } from "vitest";
import { formatHours, isOpenAt, type WeeklyHours } from "./store-hours.ts";

const everyDay = (open: string, close: string): WeeklyHours => Array.from({ length: 7 }, () => ({ open, close }));
const at = (utc: string) => new Date(utc);

describe("store hours (India time)", () => {
  // 2026-11-02 is a Monday. 10:00 IST is 04:30 UTC.
  it("is open inside hours and closed outside", () => {
    const h = everyDay("09:00", "22:00");
    expect(isOpenAt(at("2026-11-02T04:30:00Z"), h)).toBe(true); // 10:00 IST
    expect(isOpenAt(at("2026-11-02T02:00:00Z"), h)).toBe(false); // 07:30 IST
    expect(isOpenAt(at("2026-11-02T16:30:00Z"), h)).toBe(false); // 22:00 IST, close is exclusive
  });

  it("handles hours that run past midnight", () => {
    expect(isOpenAt(at("2026-11-02T19:00:00Z"), everyDay("18:00", "01:00"))).toBe(true); // 00:30 IST Tue
  });

  it("respects closed days and temporary closure", () => {
    const h = everyDay("09:00", "22:00");
    h[1] = null; // Monday closed
    expect(isOpenAt(at("2026-11-02T04:30:00Z"), h)).toBe(false);
    expect(isOpenAt(at("2026-11-03T04:30:00Z"), everyDay("09:00", "22:00"), true)).toBe(false);
  });

  it("formats hours for display", () => {
    expect(formatHours({ open: "08:30", close: "22:00" })).toBe("8:30 am – 10 pm");
    expect(formatHours(null)).toBe("Closed");
  });
});
