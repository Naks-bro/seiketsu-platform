import { describe, expect, it } from "vitest";
import { allowedAddon, allowedVariants, itemDiets, matchesDiet } from "./diet-filter";
import { isServiceable } from "./delivery-area";
import { EXTRA_GROUPS, extraPlacement } from "./extras";

const bowl = { diet: null, variants: [{ id: "p", diet: "veg" as const }, { id: "c", diet: "non_veg" as const }] };
const juice = { diet: null, variants: [{ id: "j", diet: null }] };
const wrap = { diet: "non_veg" as const, variants: [{ id: "w", diet: null }] };
const all = { vegOnly: false, diet: null };
const veg = { vegOnly: true, diet: null };

describe("diet filter", () => {
  it("knows a two-way bowl is both veg and non-veg", () => {
    expect([...itemDiets(bowl)].sort()).toEqual(["non_veg", "veg"]);
    expect([...itemDiets(wrap)]).toEqual(["non_veg"]);
    expect(itemDiets(juice).size).toBe(0);
  });

  it("shows only explicitly veg dishes under Veg only", () => {
    expect(matchesDiet(bowl, veg)).toBe(true);
    expect(matchesDiet(wrap, veg)).toBe(false);
    expect(matchesDiet(juice, veg)).toBe(false); // unmarked is never assumed veg
    expect(matchesDiet(juice, all)).toBe(true);
    expect(matchesDiet(wrap, { vegOnly: false, diet: "non_veg" })).toBe(true);
  });

  it("offers only the matching size", () => {
    expect(allowedVariants(bowl, veg).map((v) => v.id)).toEqual(["p"]);
    expect(allowedVariants(bowl, all).map((v) => v.id)).toEqual(["p", "c"]);
  });

  it("hides non-veg and unmarked extras under Veg only", () => {
    expect(allowedAddon({ diet: "veg" }, veg)).toBe(true);
    expect(allowedAddon({ diet: "non_veg" }, veg)).toBe(false);
    expect(allowedAddon({ diet: null }, veg)).toBe(false);
    expect(allowedAddon({ diet: null }, all)).toBe(true);
  });
});

describe("delivery area", () => {
  it("accepts any valid pincode when no list is set", () => {
    expect(isServiceable("400061", [])).toBe(true);
    expect(isServiceable("40006", [])).toBe(false);
    expect(isServiceable("012345", [])).toBe(false);
  });
  it("limits to the listed pincodes", () => {
    expect(isServiceable(" 400061 ", ["400061"])).toBe(true);
    expect(isServiceable("400001", ["400061"])).toBe(false);
  });
});

describe("extras groups", () => {
  it("places every extra exactly once", () => {
    const names = EXTRA_GROUPS.flatMap((g) => g.extras.map((e) => e.name));
    expect(new Set(names).size).toBe(names.length);
    expect(names).toHaveLength(14);
    expect(extraPlacement("tandoori chicken")).toEqual({ group: "Proteins", icon: "chicken" });
    expect(extraPlacement("Something new").group).toBe("Sauces & dips");
  });
});
