import { describe, expect, it } from "vitest";
import { csvCell, istDay, parseRange } from "./reports";

describe("parseRange", () => {
  const now = new Date("2026-11-02T20:00:00Z"); // 3 Nov 01:30 in India
  it("uses the India date for today", () => {
    const r = parseRange({}, now);
    expect(r.fromDay).toBe("2026-11-03");
    expect(r.from.toISOString()).toBe("2026-11-02T18:30:00.000Z");
    expect(r.to.toISOString()).toBe("2026-11-03T18:30:00.000Z");
  });
  it("covers the last 7 days including today", () => {
    const r = parseRange({ range: "7d" }, now);
    expect(r.fromDay).toBe("2026-10-28");
    expect(r.toDay).toBe("2026-11-03");
  });
  it("accepts custom ranges in either order", () => {
    const r = parseRange({ from: "2026-10-10", to: "2026-10-01" }, now);
    expect(r.fromDay).toBe("2026-10-01");
    expect(r.toDay).toBe("2026-10-10");
    expect(istDay(r.to)).toBe("2026-10-11");
  });
});

describe("csvCell", () => {
  it("quotes and defuses formulas", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-12.5")).toBe("-12.5");
    expect(csvCell(null)).toBe("");
  });
});