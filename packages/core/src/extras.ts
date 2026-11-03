/**
 * How the owner's extras are grouped on the customer menu (Subway-style),
 * plus the small icon set staff can pick from. Names and prices come from the
 * menu data; this file only says which shelf each extra sits on.
 */

export const ADDON_ICONS = [
  "protein",
  "paneer",
  "tofu",
  "chicken",
  "cheese",
  "tomato",
  "olive",
  "broccoli",
  "avocado",
  "leaf",
  "sauce",
  "dip",
  "spice",
] as const;
export type AddonIcon = (typeof ADDON_ICONS)[number];

export type ExtraGroup = { name: string; maxSelect: number; extras: { name: string; icon: AddonIcon }[] };

export const EXTRA_GROUPS: ExtraGroup[] = [
  {
    name: "Proteins",
    maxSelect: 3,
    extras: [
      { name: "Tandoori Paneer", icon: "paneer" },
      { name: "Chilli Tofu", icon: "tofu" },
      { name: "Tandoori Chicken", icon: "chicken" },
    ],
  },
  { name: "Cheese", maxSelect: 1, extras: [{ name: "Feta Cheese", icon: "cheese" }] },
  {
    name: "Veggies & toppings",
    maxSelect: 4,
    extras: [
      { name: "Cherry Tomatoes", icon: "tomato" },
      { name: "Olives", icon: "olive" },
      { name: "Broccoli", icon: "broccoli" },
      { name: "Avocado", icon: "avocado" },
    ],
  },
  {
    name: "Sauces & dips",
    maxSelect: 6,
    extras: [
      { name: "Pesto Sauce", icon: "sauce" },
      { name: "Italian Herb Dressing", icon: "leaf" },
      { name: "Honey Musterd Dip", icon: "dip" },
      { name: "Russian Dressing", icon: "sauce" },
      { name: "Peri Peri Dip", icon: "spice" },
      { name: "Guacamole", icon: "avocado" },
    ],
  },
];

/** Group for extras not listed above (added later in the admin). */
export const FALLBACK_EXTRA_GROUP = "Sauces & dips";

export function extraPlacement(name: string): { group: string; icon: AddonIcon | null } {
  for (const g of EXTRA_GROUPS) {
    const hit = g.extras.find((e) => e.name.toLowerCase() === name.toLowerCase());
    if (hit) return { group: g.name, icon: hit.icon };
  }
  return { group: FALLBACK_EXTRA_GROUP, icon: null };
}

export const isAddonIcon = (v: unknown): v is AddonIcon => typeof v === "string" && (ADDON_ICONS as readonly string[]).includes(v);
