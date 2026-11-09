/** Help desk against an in-memory Postgres: open, reply both ways, internal notes, statuses, assignment. */
import { beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "pglite:memory";

const { getConn, outlets, staffRoles, staffUsers, tickets } = await import("@seiketsu/db");
const { runMigrations } = await import("../../../../../packages/db/src/migrate.ts");
const { seed } = await import("../../../../../packages/db/src/seed.ts");
const { eq } = await import("drizzle-orm");
const svc = await import("./tickets");

type Db = import("@seiketsu/db").Db;
let db: Db;
let outletId: string;
let staffId: string;

const base = { name: "Asha Rao", phone: "9876543210", email: "", category: "order" as const, subject: "Dip missing", message: "My bowl came without the hummus dip." };

beforeAll(async () => {
  const conn = await getConn();
  await runMigrations(conn);
  db = conn.db;
  outletId = (await seed(db)).outletId;
  const [u] = await db.insert(staffUsers).values({ email: "desk@test.local", name: "Desk", passwordHash: "x" }).returning();
  staffId = u.id;
  await db.insert(staffRoles).values({ staffUserId: staffId, outletId, role: "manager" });
});

const open = (over: Partial<Omit<typeof base, "category">> & { category?: "order" | "payment" } = {}) =>
  svc.createTicket({ ...base, ...over, outletId, customerId: null, source: "contact" });
const row = async (id: string) => (await db.select().from(tickets).where(eq(tickets.id, id)))[0];

describe("help desk", () => {
  it("opens a numbered ticket with the first message", async () => {
    const t = await open();
    expect(t.number).toMatch(/^T-\d{4,}$/);
    expect(t.status).toBe("open");
    const view = await svc.ticketByToken(t.publicToken);
    expect(view?.messages.map((m) => m.body)).toEqual([base.message]);
  });

  it("marks payment problems urgent", async () => {
    const t = await open({ category: "payment", subject: "Charged twice" });
    expect(t.priority).toBe("high");
  });

  it("hands the ticket to the customer on a reply and back on theirs; internal notes stay hidden", async () => {
    const t = await open();
    await svc.staffReply(outletId, t.id, staffId, "Customer is a regular, refund the dip.", true);
    expect((await row(t.id)).status).toBe("open");
    await svc.staffReply(outletId, t.id, staffId, "Sorry about that! We've refunded the dip.", false);
    const after = await row(t.id);
    expect(after.status).toBe("waiting");
    expect(after.firstResponseAt).not.toBeNull();
    expect(after.assigneeId).toBe(staffId);
    const view = await svc.ticketByToken(t.publicToken);
    expect(view?.messages.map((m) => m.body)).not.toContain("Customer is a regular, refund the dip.");
    await svc.customerReply(t.publicToken, "Thank you!");
    expect((await row(t.id)).status).toBe("open");
  });

  it("refuses replies on a closed ticket and impossible status moves", async () => {
    const t = await open();
    await svc.setTicketStatus(outletId, t.id, "closed", staffId);
    await expect(svc.customerReply(t.publicToken, "hello?")).rejects.toThrow(/closed/);
    await expect(svc.setTicketStatus(outletId, t.id, "resolved", staffId)).rejects.toThrow();
  });

  it("keeps each outlet's tickets to itself", async () => {
    const t = await open();
    const [other] = await db.insert(outlets).values({ slug: "other-desk", name: "Other", addressLines: [] }).returning();
    await expect(svc.staffReply(other.id, t.id, staffId, "hi", false)).rejects.toThrow(/not found/);
    await expect(svc.assignTicket(other.id, t.id, staffId)).rejects.toThrow(/team/);
  });

  it("lists tickets needing a reply first, urgent ones on top", async () => {
    const rows = await svc.listTickets(outletId);
    const statuses = rows.map((r) => r.t.status);
    const firstWaiting = statuses.indexOf("waiting");
    expect(firstWaiting === -1 || statuses.lastIndexOf("open") < firstWaiting).toBe(true);
    expect(rows.filter((r) => r.t.status === "open")[0].t.priority).toBe("high");
    expect((await svc.listTickets(outletId, { q: "Charged" })).map((r) => r.t.subject)).toEqual(["Charged twice"]);
  });
});
