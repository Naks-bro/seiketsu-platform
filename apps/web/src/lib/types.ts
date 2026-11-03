/** Data shapes passed from server to client components. */
import type { Diet } from "@seiketsu/core/menu-parse";
import type { WeeklyHours } from "@seiketsu/core/store-hours";
import type { PricingSettings } from "@seiketsu/core/pricing";

export type { Diet };

export type VariantDTO = {
  id: string;
  label: string | null;
  portion: string | null;
  pricePaise: number;
  diet: Diet | null;
  nutrition: { kcal: number; proteinG: number; carbsG: number; fatG: number; fibreG: number } | null;
};

export type AddonDTO = { id: string; name: string; pricePaise: number; diet: Diet | null; icon: string | null };

export type AddonGroupDTO = { id: string; name: string; minSelect: number; maxSelect: number; sort: number; addons: AddonDTO[] };

export type MenuItemDTO = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  diet: Diet | null;
  imageUrl: string | null;
  isFeatured: boolean;
  isBestseller: boolean;
  categorySlug: string;
  variants: VariantDTO[];
  addonGroups: AddonGroupDTO[];
};

export type CategoryDTO = { id: string; slug: string; name: string; items: MenuItemDTO[] };

export type StoreDTO = {
  outletId: string;
  name: string;
  addressLines: string[];
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  mapUrl: string;
  hours: WeeklyHours | null;
  isOpenNow: boolean;
  closureMessage: string | null;
  announcement: string | null;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryPincodes: string[];
  prepTimeMinutes: number;
  pricing: PricingSettings;
  paymentsMode: "razorpay" | "simulator" | "disabled";
};