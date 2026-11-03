/** Plans enquiries: validation, the bot trap and the rate limit. */
import { beforeAll, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL = "pglite:memory";
vi.mock("@/lib/server/request", () => ({ clientIp: async () => "203.0.113.7" }));

const { getConn, enquiries } = await import("@seiketsu/db");
const { runMigrations } = await import("../../../../../packages/db/src/migrate.ts");
const { seed } = await import("../../../../../packages/db/src/seed.ts");
const { sendEnquiryAction } = await import("./plans-actions");

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const good = { name: "Asha", phone: "+91 98765 43210", email: "asha@example.com", location: "Bandra West", interest: "subscriptions", message: "Weekday lunches" };

beforeAll(async () => {
  const conn = await getConn();
  await runMigrations(conn);
  await seed(conn.db);
});

describe("plans enquiries", () => {
  it("saves a valid enquiry with a normalised phone number", async () => {
    expect(await sendEnquiryAction(undefined, form(good))).toEqual({ ok: true });
    const rows = await (await getConn()).db.select().from(enquiries);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ phone: "9876543210", email: "asha@example.com", interest: "subscriptions", message: "Weekday lunches" });
  });

  it("requires every starred field and a known interest", async () => {
    const r = await sendEnquiryAction(undefined, form({ ...good, email: "", location: "", interest: "free-food", message: "" }));
    expect(r?.ok).toBeUndefined();
    expect(Object.keys(r?.fields ?? {}).sort()).toEqual(["email", "interest", "location"]);
    expect(r?.values?.name).toBe("Asha"); // the form keeps what was typed
  });

  it("quietly drops bot submissions", async () => {
    expect(await sendEnquiryAction(undefined, form({ ...good, website: "http://spam.example" }))).toEqual({ ok: true });
    expect(await (await getConn()).db.select().from(enquiries)).toHaveLength(1);
  });

  it("limits how often one address can send", async () => {
    for (let i = 0; i < 4; i++) await sendEnquiryAction(undefined, form(good));
    expect((await sendEnquiryAction(undefined, form(good)))?.error).toMatch(/received/);
    expect(await (await getConn()).db.select().from(enquiries)).toHaveLength(5);
  });
});
