import { describe, expect, it } from "vitest";
import { canMove, daysLabel, endDateFor, isDue, istToday, progress, weekdayOf } from "./subscriptions.ts";

const sub = { status: "active", startDate: "2026-11-02", endDate: "2026-11-29", mealsUsed: 3, mealsTotal: 20, deliveryDays: ["mon", "tue", "wed", "thu", "fri"] };

describe("subscriptions", () => {
  it("knows the weekday and India's date", () => {
    expect(weekdayOf("2026-11-02")).toBe("mon");
    expect(istToday(new Date("2026-11-03T20:00:00Z"))).toBe("2026-11-04"); // 1:30 am in India
  });

  it("runs a plan for its number of days", () => {
    expect(endDateFor("2026-11-02", 28)).toBe("2026-11-29");
    expect(endDateFor("2026-11-30", 2)).toBe("2026-12-01");
  });

  it("is due only on delivery days, inside the dates, while active and with meals left", () => {
    expect(isDue(sub, "2026-11-03")).toBe(true);
    expect(isDue(sub, "2026-11-08")).toBe(false); // Sunday
    expect(isDue(sub, "2026-11-01")).toBe(false); // before start
    expect(isDue(sub, "2026-11-30")).toBe(false); // after end
    expect(isDue({ ...sub, status: "paused" }, "2026-11-03")).toBe(false);
    expect(isDue({ ...sub, mealsUsed: 20 }, "2026-11-03")).toBe(false);
    expect(isDue({ ...sub, deliveryDays: [] }, "2026-11-08")).toBe(true);
  });

  it("moves only between sensible states", () => {
    expect(canMove("pending", "active")).toBe(true);
    expect(canMove("paused", "active")).toBe(true);
    expect(canMove("completed", "active")).toBe(false);
    expect(canMove("cancelled", "paused")).toBe(false);
  });

  it("describes progress and delivery days", () => {
    expect(progress(25, 20)).toEqual({ used: 20, total: 20, left: 0, percent: 100 });
    expect(daysLabel(["mon", "tue", "wed", "thu", "fri"])).toBe("Mon to Fri");
    expect(daysLabel([])).toBe("Every day");
    expect(daysLabel(["sat", "mon"])).toBe("Mon, Sat");
  });
});
