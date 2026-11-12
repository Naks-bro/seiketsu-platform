import { describe, expect, it } from "vitest";
import { ldJson, llmsText, menuJsonLd, openingHours, restaurantJsonLd, splitAddress } from "./seo";
import type { CategoryDTO, StoreDTO } from "./types";

const store = {
  name: "Seiketsu Versova",
  addressLines: ["Bungalow 95, JP Road", "Versova, Andheri West", "Mumbai 400061"],
  phone: "+91 00000 00000",
  instagram: "example",
  mapUrl: "https://maps.example/x",
  hours: [null, { open: "09:00", close: "22:00" }, { open: "09:00", close: "22:00" }, null, null, null, { open: "10:00", close: "23:00" }],
  pickupEnabled: true,
  deliveryEnabled: false,
} as unknown as StoreDTO;

const menu: CategoryDTO[] = [
  {
    id: "c", slug: "salads", name: "Salads",
    items: [{
      id: "i", slug: "test", name: "Test bowl", description: "Leaves </script>", diet: "veg", imageUrl: "/menu/test.webp",
      isFeatured: false, isBestseller: false, categorySlug: "salads", addonGroups: [],
      variants: [{ id: "v", label: null, portion: "300 g", pricePaise: 25000, diet: "veg", nutrition: { kcal: 320, proteinG: 12, carbsG: 30, fatG: 10, fibreG: 6 } }],
    }],
  },
];

describe("seo", () => {
  it("splits city and PIN off the last address line", () => {
    expect(splitAddress(store.addressLines)).toEqual({ streetAddress: "Bungalow 95, JP Road, Versova, Andheri West", addressLocality: "Mumbai", postalCode: "400061" });
    expect(splitAddress(["Somewhere"])).toEqual({ streetAddress: "Somewhere" });
    expect(splitAddress(["Bungalow 95, JP Rd", "Mumbai, Maharashtra 400061"])).toEqual({ streetAddress: "Bungalow 95, JP Rd", addressLocality: "Mumbai", addressRegion: "Maharashtra", postalCode: "400061" });
  });

  it("groups days with the same hours and skips closed days", () => {
    expect(openingHours(store.hours)).toEqual([
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday"], opens: "09:00", closes: "22:00" },
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Saturday"], opens: "10:00", closes: "23:00" },
    ]);
  });

  it("describes the restaurant from stored details only", () => {
    const r = restaurantJsonLd(store, "https://x.in");
    expect(r.address).toMatchObject({ postalCode: "400061", addressCountry: "IN" });
    expect(r.sameAs).toEqual(["https://www.instagram.com/example/"]);
    expect(r.hasMenu).toBe("https://x.in/menu");
  });

  it("lists menu prices in rupees with nutrition and absolute image URLs", () => {
    const item = menuJsonLd(menu, "https://x.in").hasMenuSection[0].hasMenuItem[0];
    expect(item.offers).toEqual([{ "@type": "Offer", name: undefined, price: "250.00", priceCurrency: "INR" }]);
    expect(item.nutrition?.calories).toBe("320 calories");
    expect(item.image).toBe("https://x.in/menu/test.webp");
    expect(item.suitableForDiet).toBe("https://schema.org/VegetarianDiet");
  });

  it("never lets text close the script tag", () => {
    expect(ldJson(menuJsonLd(menu, "https://x.in"))).not.toContain("</script>");
  });

  it("writes a plain-text summary with hours, prices and pickup only", () => {
    const t = llmsText(store, menu, "https://x.in", []);
    expect(t).toContain("# Seiketsu Versova");
    expect(t).toContain("- Sunday: Closed");
    expect(t).toContain("- Test bowl (veg): Leaves </script>");
    expect(t).toContain("  - 300 g: ₹250, 320 kcal, 12 g protein");
    expect(t).toContain("Order online for pickup: https://x.in/menu");
    expect(t).not.toContain("Meal subscriptions");
  });
});
