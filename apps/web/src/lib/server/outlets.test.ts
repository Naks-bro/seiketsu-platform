/** Opening a second outlet copies the first one's set-up but starts closed and delivering nowhere. */
import { beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "pglite:memory";

const { getConn, outletMenuItems, staffRoles, staffUsers, storeSettings } = await import("@seiketsu/db");
const { runMigrations } = await import("../../../../../packages/db/src/migrate.ts");
const { seed } = await import("../../../../../packages/db/src/seed.ts");
const { createOutlet, updateOutlet } = await import("./outlets");
const { eq } = await import("drizzle-orm");

let mainId = "";
let ownerId = "";

beforeAll(async () => {
  const conn = await getConn();
  await runMigrations(conn);
  mainId = (await seed(conn.db)).outletId;
  await conn.db.update(storeSettings).set({ deliveryPincodes: ["400061"], deliveryFeePaise: 4000 }).where(eq(storeSettings.outletId, mainId));
  const [u] = await conn.db.insert(staffUsers).values({ email: "o@test.local", name: "Owner", passwordHash: "x" }).returning();
  ownerId = u.id;
});

describe("outlets", () => {
  it("copies settings and menu availability, starts closed, and makes the creator its owner", async () => {
    const db = (await getConn()).db;
    const o = await createOutlet(mainId, { name: "Seiketsu Bandra", slug: "bandra", addressLines: ["Hill Road"], phone: null, whatsapp: null, instagram: null, mapUrl: null }, ownerId);
    const [s] = await db.select().from(storeSettings).where(eq(storeSettings.outletId, o.id));
    expect(s).toMatchObject({ deliveryFeePaise: 4000, temporarilyClosed: true, deliveryEnabled: false, deliveryPincodes: [] });
    const [mainCount, newCount] = await Promise.all([mainId, o.id].map(async (id) => (await db.select().from(outletMenuItems).where(eq(outletMenuItems.outletId, id))).length));
    expect(newCount).toBe(mainCount);
    expect(await db.select().from(staffRoles).where(eq(staffRoles.outletId, o.id))).toEqual([{ staffUserId: ownerId, outletId: o.id, role: "owner" }]);
    await expect(createOutlet(mainId, { name: "Again", slug: "bandra", addressLines: ["x"], phone: null, whatsapp: null, instagram: null, mapUrl: null }, ownerId)).rejects.toThrow(/already/);
  });

  it("won't hide the main outlet", async () => {
    await expect(updateOutlet(mainId, { name: "Seiketsu", addressLines: ["x"], phone: null, whatsapp: null, instagram: null, mapUrl: null, isActive: false })).rejects.toThrow(/main outlet/);
  });
});
