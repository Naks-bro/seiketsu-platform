/** "Coming to your area" requests: validation, the bot trap and the rate limit. */
import { beforeAll, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL = "pglite:memory";
vi.mock("@/lib/server/request", () => ({ clientIp: async () => "203.0.113.9" }));

const { getConn, areaRequests } = await import("@seiketsu/db");
const { runMigrations } = await import("../../../../../../packages/db/src/migrate.ts");
const { seed } = await import("../../../../../../packages/db/src/seed.ts");
const { requestAreaAction } = await import("./actions");

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const good = { pincode: "400050", name: "Asha", phone: "+91 98765 43210", email: "", area: "Bandra West", note: "" };

beforeAll(async () => {
  const conn = await getConn();
  await runMigrations(conn);
  await seed(conn.db);
});

describe("area requests", () => {
  it("saves a valid request with a normalised phone number", async () => {
    expect(await requestAreaAction(undefined, form(good))).toEqual({ ok: true });
    const rows = await (await getConn()).db.select().from(areaRequests);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ pincode: "400050", phone: "9876543210", area: "Bandra West", email: null });
  });

  it("points at each bad field", async () => {
    const r = await requestAreaAction(undefined, form({ ...good, pincode: "4000", phone: "12345", area: "" }));
    expect(r?.ok).toBeUndefined();
    expect(Object.keys(r?.fields ?? {}).sort()).toEqual(["area", "phone", "pincode"]);
  });

  it("quietly drops bot submissions", async () => {
    expect(await requestAreaAction(undefined, form({ ...good, website: "http://spam.example" }))).toEqual({ ok: true });
    expect(await (await getConn()).db.select().from(areaRequests)).toHaveLength(1);
  });

  it("limits how often one address can send", async () => {
    for (let i = 0; i < 4; i++) await requestAreaAction(undefined, form(good));
    const r = await requestAreaAction(undefined, form(good));
    expect(r?.error).toMatch(/already/);
    expect(await (await getConn()).db.select().from(areaRequests)).toHaveLength(5);
  });
});
