import "server-only";
import { and, eq, inArray, like } from "drizzle-orm";
import { z } from "zod";
import { addonGroups, getDb, menuItemAddonGroups, menuItems, menuItemVariants, menuImages, outletMenuItems } from "@seiketsu/db";
import { slugify } from "@seiketsu/core/menu-parse";

const optInt = (max: number) =>
  z.union([z.literal(""), z.null(), z.coerce.number().int().min(0).max(max)]).transform((v) => (v === "" || v === null ? null : v));

export const variantInput = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().max(40).transform((v) => v || null),
  portionAmount: optInt(5000),
  portionUnit: z.enum(["g", "ml", ""]).transform((v) => v || null),
  priceRupees: z.coerce.number({ message: "Enter a price" }).min(0).max(100_000),
  kcal: optInt(5000),
  proteinG: optInt(500),
  carbsG: optInt(500),
  fatG: optInt(500),
  fibreG: optInt(500),
  isActive: z.boolean(),
});

export const itemInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Enter the dish name").max(80),
  categoryId: z.string().uuid("Choose a category"),
  description: z.string().trim().max(600).transform((v) => v || null),
  diet: z.enum(["veg", "egg", "non_veg", ""]).transform((v) => v || null),
  imageUrl: z
    .string()
    .trim()
    .regex(/^(\/api\/images\/[0-9a-f-]{36}|https:\/\/\S+)?$/, "Photo link is not valid")
    .transform((v) => v || null),
  offersExtras: z.boolean(),
  showOnMenu: z.boolean(),
  variants: z.array(variantInput).min(1, "Add at least one size/price").max(10),
});

export type ItemInput = z.input<typeof itemInput>;

async function uniqueSlug(name: string) {
  const db = await getDb();
  const base = slugify(name) || "dish";
  const taken = new Set((await db.select({ s: menuItems.slug }).from(menuItems).where(like(menuItems.slug, `${base}%`))).map((r) => r.s));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

/**
 * Creates or updates a dish with its sizes. Sizes removed in the editor are
 * switched off rather than deleted, because past orders still point at them.
 */
export async function saveMenuItem(raw: unknown, outletId: string) {
  const input = itemInput.parse(raw);
  if (!input.variants.some((v) => v.isActive)) throw new z.ZodError([{ code: "custom", path: ["variants"], message: "Keep at least one size on sale" }]);
  const db = await getDb();
  const extraGroups = await db.select({ id: addonGroups.id }).from(addonGroups).where(eq(addonGroups.isExtra, true));
  const slug = input.id ? undefined : await uniqueSlug(input.name);

  return db.transaction(async (tx) => {
    const fields = {
      name: input.name,
      categoryId: input.categoryId,
      description: input.description,
      diet: input.diet,
      imageUrl: input.imageUrl,
      ...(input.showOnMenu ? { needsReview: false, reviewNotes: null } : {}),
    };
    let itemId = input.id;
    if (itemId) {
      const [u] = await tx.update(menuItems).set(fields).where(eq(menuItems.id, itemId)).returning({ id: menuItems.id });
      if (!u) throw new Error("Dish not found.");
    } else {
      const [c] = await tx.insert(menuItems).values({ ...fields, slug: slug!, needsReview: !input.showOnMenu }).returning({ id: menuItems.id });
      itemId = c.id;
    }

    const existing = await tx.select({ id: menuItemVariants.id }).from(menuItemVariants).where(eq(menuItemVariants.menuItemId, itemId));
    const owned = new Set(existing.map((e) => e.id));
    const kept = new Set<string>();
    for (const [sort, v] of input.variants.entries()) {
      const values = {
        label: v.label,
        portionAmount: v.portionAmount,
        portionUnit: v.portionAmount ? v.portionUnit : null,
        pricePaise: Math.round(v.priceRupees * 100),
        kcal: v.kcal,
        proteinG: v.proteinG,
        carbsG: v.carbsG,
        fatG: v.fatG,
        fibreG: v.fibreG,
        isActive: v.isActive,
        sort,
      };
      if (v.id && owned.has(v.id)) {
        await tx.update(menuItemVariants).set(values).where(eq(menuItemVariants.id, v.id));
        kept.add(v.id);
      } else {
        await tx.insert(menuItemVariants).values({ ...values, menuItemId: itemId });
      }
    }
    const dropped = [...owned].filter((id) => !kept.has(id));
    if (dropped.length) await tx.update(menuItemVariants).set({ isActive: false }).where(inArray(menuItemVariants.id, dropped));

    if (extraGroups.length) {
      const ids = extraGroups.map((g) => g.id);
      await tx.delete(menuItemAddonGroups).where(and(eq(menuItemAddonGroups.menuItemId, itemId), inArray(menuItemAddonGroups.groupId, ids)));
      if (input.offersExtras) await tx.insert(menuItemAddonGroups).values(ids.map((groupId) => ({ menuItemId: itemId, groupId })));
    }
    await tx
      .insert(outletMenuItems)
      .values({ outletId, menuItemId: itemId, isAvailable: input.showOnMenu })
      .onConflictDoUpdate({ target: [outletMenuItems.outletId, outletMenuItems.menuItemId], set: input.showOnMenu ? { isAvailable: true } : {} });
    return itemId;
  });
}

// ── Photos ─────────────────────────────────────────────────────────

export const MAX_IMAGE_BYTES = 1_500_000;

/** Checks the file really is an image by its first bytes, not its name or claimed type. */
export function sniffImageType(b: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function storeImage(data: Buffer, staffId: string) {
  if (data.length > MAX_IMAGE_BYTES) throw new Error("Photo is too large (max 1.5 MB).");
  const contentType = sniffImageType(data);
  if (!contentType) throw new Error("Upload a JPG, PNG or WebP photo.");
  const db = await getDb();
  const [row] = await db.insert(menuImages).values({ contentType, bytes: data.length, data, createdBy: staffId }).returning({ id: menuImages.id });
  return `/api/images/${row.id}`;
}