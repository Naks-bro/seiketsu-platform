/** Saved addresses against an in-memory Postgres: defaults, the limit, and that customers only touch their own. */
import { beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "pglite:memory";

const { getConn, customers } = await import("@seiketsu/db");
const { runMigrations } = await import("../../../../../packages/db/src/migrate.ts");
const svc = await import("./addresses");

let asha: string;
let ravi: string;

const home = { label: "Home", house: "4B", building: "Sea Breeze", area: "JP Road, Versova", pincode: "400061", city: "Mumbai", lat: 19.1307, lng: 72.8195 };

beforeAll(async () => {
  const conn = await getConn();
  await runMigrations(conn);
  const rows = await conn.db.insert(customers).values([{ phone: "9876500001", name: "Asha" }, { phone: "9876500002", name: "Ravi" }]).returning();
  [asha, ravi] = rows.map((r) => r.id);
});

describe("saved addresses", () => {
  it("makes the first address the default and keeps exactly one default", async () => {
    const a = await svc.saveAddress(asha, home);
    expect(a.isDefault).toBe(true);
    const b = await svc.saveAddress(asha, { ...home, label: "Work", house: "12", isDefault: true });
    const list = await svc.listAddresses(asha);
    expect(list.filter((x) => x.isDefault).map((x) => x.id)).toEqual([b.id]);
    await svc.setDefaultAddress(asha, a.id);
    expect((await svc.listAddresses(asha))[0]).toMatchObject({ id: a.id, isDefault: true });
    await svc.deleteAddress(asha, a.id);
    expect((await svc.listAddresses(asha)).map((x) => x.isDefault)).toEqual([true]);
  });

  it("validates and limits", async () => {
    await expect(svc.saveAddress(asha, { ...home, pincode: "12" })).rejects.toThrow();
    for (let i = (await svc.listAddresses(asha)).length; i < 10; i++) await svc.saveAddress(asha, { ...home, label: `A${i}` });
    await expect(svc.saveAddress(asha, home)).rejects.toThrow(/up to 10/);
  });

  it("never lets one customer change another's address", async () => {
    const mine = (await svc.listAddresses(asha))[0];
    await expect(svc.saveAddress(ravi, { ...home, label: "Hijack" }, mine.id)).rejects.toThrow(/not found/);
    await svc.deleteAddress(ravi, mine.id);
    await expect(svc.setDefaultAddress(ravi, mine.id)).rejects.toThrow(/not found/);
    expect((await svc.listAddresses(asha)).find((x) => x.id === mine.id)?.label).toBe(mine.label);
  });
});
