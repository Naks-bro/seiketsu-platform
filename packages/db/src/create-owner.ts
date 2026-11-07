/**
 * Creates the owner account, or resets its password.
 * Usage (PowerShell):  $env:OWNER_PASSWORD="..."; npm run create-owner -w @seiketsu/db -- owner@example.com "Owner Name"
 * The password comes from OWNER_PASSWORD so it is not saved in shell history.
 */
import { eq } from "drizzle-orm";
import { hashPassword } from "@seiketsu/core/password";
import { openDb } from "./client.ts";
import * as s from "./schema.ts";

const [email, name = "Owner"] = process.argv.slice(2);
const password = process.env.OWNER_PASSWORD;
if (!email || !password) {
  console.error("Usage: set OWNER_PASSWORD, then: npm run create-owner -w @seiketsu/db -- <email> [name]");
  process.exit(1);
}

const conn = await openDb(process.env.DATABASE_MIGRATION_URL?.trim() || process.env.DATABASE_URL?.trim() || "pglite:./.data/pglite");
const db = conn.db;
const [outlet] = await db.select().from(s.outlets).limit(1);
if (!outlet) throw new Error("Run the seed first: npm run db:seed");

const passwordHash = await hashPassword(password);
const normalised = email.trim().toLowerCase();
const [existing] = await db.select().from(s.staffUsers).where(eq(s.staffUsers.email, normalised));
let userId: string;
if (existing) {
  await db
    .update(s.staffUsers)
    .set({ passwordHash, sessionVersion: existing.sessionVersion + 1, isActive: true })
    .where(eq(s.staffUsers.id, existing.id));
  userId = existing.id;
  console.log(`Password reset for ${normalised}; existing sessions signed out.`);
} else {
  const [u] = await db.insert(s.staffUsers).values({ email: normalised, name, passwordHash }).returning();
  userId = u.id;
  console.log(`Owner account created for ${normalised}.`);
}
await db
  .insert(s.staffRoles)
  .values({ staffUserId: userId, outletId: outlet.id, role: "owner" })
  .onConflictDoUpdate({ target: [s.staffRoles.staffUserId, s.staffRoles.outletId], set: { role: "owner" } });
await conn.close();