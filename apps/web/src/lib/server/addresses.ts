import "server-only";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { customerAddresses, getDb } from "@seiketsu/db";
import { addressSchema, MAX_SAVED_ADDRESSES, type AddressInput } from "@seiketsu/core/address";

export type SavedAddress = {
  id: string;
  label: string;
  house: string;
  building: string;
  area: string;
  landmark: string;
  pincode: string;
  city: string;
  lat: number;
  lng: number;
  instructions: string;
  isDefault: boolean;
};

export class AddressError extends Error {}

const toSaved = (r: typeof customerAddresses.$inferSelect): SavedAddress => ({
  id: r.id,
  label: r.label,
  house: r.house,
  building: r.building ?? "",
  area: r.area,
  landmark: r.landmark ?? "",
  pincode: r.pincode,
  city: r.city ?? "",
  lat: r.lat,
  lng: r.lng,
  instructions: r.instructions ?? "",
  isDefault: r.isDefault,
});

/** The customer's addresses, default first, then most recently used or edited. */
export async function listAddresses(customerId: string): Promise<SavedAddress[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(customerAddresses)
    .where(eq(customerAddresses.customerId, customerId))
    .orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.updatedAt), asc(customerAddresses.createdAt));
  return rows.map(toSaved);
}

/** Adds an address, or updates one of the customer's own. The first address becomes the default. */
export async function saveAddress(customerId: string, input: AddressInput, id?: string): Promise<SavedAddress> {
  const a = addressSchema.parse(input);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(customerAddresses).where(eq(customerAddresses.customerId, customerId));
    if (!id && n >= MAX_SAVED_ADDRESSES) throw new AddressError(`You can save up to ${MAX_SAVED_ADDRESSES} addresses. Remove one first.`);
    const makeDefault = a.isDefault || n === 0;
    const values = {
      label: a.label,
      house: a.house,
      building: a.building || null,
      area: a.area,
      landmark: a.landmark || null,
      pincode: a.pincode,
      city: a.city || null,
      lat: a.lat,
      lng: a.lng,
      instructions: a.instructions || null,
      ...(makeDefault ? { isDefault: true } : {}),
    };
    const [row] = id
      ? await tx.update(customerAddresses).set(values).where(and(eq(customerAddresses.id, id), eq(customerAddresses.customerId, customerId))).returning()
      : await tx.insert(customerAddresses).values({ ...values, customerId }).returning();
    if (!row) throw new AddressError("That address was not found.");
    if (row.isDefault) {
      await tx.update(customerAddresses).set({ isDefault: false }).where(and(eq(customerAddresses.customerId, customerId), ne(customerAddresses.id, row.id)));
    }
    return toSaved(row);
  });
}

export async function deleteAddress(customerId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [gone] = await tx.delete(customerAddresses).where(and(eq(customerAddresses.id, id), eq(customerAddresses.customerId, customerId))).returning();
    if (!gone?.isDefault) return;
    // Keep one default while any address remains.
    const [next] = await tx.select({ id: customerAddresses.id }).from(customerAddresses).where(eq(customerAddresses.customerId, customerId)).orderBy(desc(customerAddresses.updatedAt)).limit(1);
    if (next) await tx.update(customerAddresses).set({ isDefault: true }).where(eq(customerAddresses.id, next.id));
  });
}

export async function setDefaultAddress(customerId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [row] = await tx.update(customerAddresses).set({ isDefault: true }).where(and(eq(customerAddresses.id, id), eq(customerAddresses.customerId, customerId))).returning({ id: customerAddresses.id });
    if (!row) throw new AddressError("That address was not found.");
    await tx.update(customerAddresses).set({ isDefault: false }).where(and(eq(customerAddresses.customerId, customerId), ne(customerAddresses.id, id)));
  });
}
