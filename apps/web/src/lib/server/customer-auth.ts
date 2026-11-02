import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { consentEvents, customers, getDb, messageLog, otpChallenges } from "@seiketsu/db";
import { generateOtp, hashOtp, messageCost, otpMatches } from "@seiketsu/core/messaging";
import { env, sessionSecret } from "./env";
import { rateLimit } from "./rate-limit";
import { getMessagingSettings, sendMessage } from "./messaging/send";

const COOKIE = "sk_customer";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const OTP_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
/** Hard stop against OTP-pumping fraud: total codes sent per day across the site. */
const DAILY_OTP_CAP = Number(process.env.OTP_DAILY_CAP ?? 300);

export class AuthError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export type Customer = {
  id: string;
  phone: string;
  name: string;
  email: string | null;
  marketingWhatsapp: boolean;
  marketingEmail: boolean;
};

export async function requestOtp(args: { phone: string; ip: string; channel?: "whatsapp" | "sms" }) {
  const { phone, ip } = args;
  const checks = await Promise.all([
    rateLimit(`otp:phone:${phone}`, 3, 600),
    rateLimit(`otp:phone-day:${phone}`, 10, 86_400),
    rateLimit(`otp:ip:${ip}`, 10, 3600),
    rateLimit("otp:global", DAILY_OTP_CAP, 86_400),
  ]);
  if (!checks[3]) throw new AuthError("Login by code is paused for now. Please try again later or check out as a guest.", 429);
  if (checks.includes(false)) throw new AuthError("Too many codes requested. Please wait a few minutes and try again.", 429);

  const db = await getDb();
  const code = generateOtp();
  const [c] = await db
    .insert(otpChallenges)
    .values({ phone, codeHash: "pending", channel: args.channel ?? "whatsapp", expiresAt: new Date(Date.now() + OTP_TTL_MS), ip })
    .returning({ id: otpChallenges.id });
  await db.update(otpChallenges).set({ codeHash: hashOtp(sessionSecret(), c.id, code) }).where(eq(otpChallenges.id, c.id));

  const sent = await sendMessage({ kind: "otp", to: phone, vars: { code }, channel: args.channel ?? "whatsapp" });
  if (sent.status !== "sent") {
    console.error("[otp] could not send", sent.error);
    throw new AuthError("We could not send a code right now. Please check out as a guest.", 503);
  }
  await db.update(otpChallenges).set({ channel: sent.channel }).where(eq(otpChallenges.id, c.id));
  return { challengeId: c.id, channel: sent.channel, resendAfterSeconds: 30 };
}

export async function verifyOtp(args: { challengeId: string; code: string; ip: string }) {
  if (!(await rateLimit(`otp-verify:ip:${args.ip}`, 30, 3600))) throw new AuthError("Too many attempts. Please try again later.", 429);
  const db = await getDb();
  // Count the attempt first so parallel guesses cannot all slip through.
  const [c] = await db
    .update(otpChallenges)
    .set({ attempts: sql`${otpChallenges.attempts} + 1` })
    .where(eq(otpChallenges.id, args.challengeId))
    .returning();
  if (!c || c.consumedAt || c.expiresAt < new Date()) throw new AuthError("This code has expired. Please request a new one.", 410);
  if (c.attempts > MAX_ATTEMPTS) throw new AuthError("Too many wrong codes. Please request a new one.", 429);
  if (!otpMatches(sessionSecret(), c.id, args.code, c.codeHash)) throw new AuthError("That code is not right. Please check and try again.");

  const [used] = await db
    .update(otpChallenges)
    .set({ consumedAt: new Date() })
    .where(and(eq(otpChallenges.id, c.id), sql`${otpChallenges.consumedAt} is null`))
    .returning({ id: otpChallenges.id });
  if (!used) throw new AuthError("This code has already been used.", 410);

  return signInVerifiedPhone(c.phone);
}

/** Creates the customer if new and starts a session. Only call after the phone is proven. */
async function signInVerifiedPhone(phone: string) {
  const db = await getDb();
  const [customer] = await db
    .insert(customers)
    .values({ phone, name: "", lastLoginAt: new Date() })
    .onConflictDoUpdate({ target: customers.phone, set: { lastLoginAt: new Date() } })
    .returning();
  await startCustomerSession(customer.id, customer.sessionVersion);
  return customer;
}

// ── MSG91 OTP widget ───────────────────────────────────────────────
// The browser sends and checks the code with MSG91 directly; we apply our own
// limits before it starts, and confirm MSG91's access token before signing in.

/** Called before the widget sends a code: rate limits, and records the estimated cost. */
export async function startWidgetOtp(args: { phone: string; ip: string }) {
  const { phone, ip } = args;
  const checks = await Promise.all([
    rateLimit(`otp:phone:${phone}`, 3, 600),
    rateLimit(`otp:phone-day:${phone}`, 10, 86_400),
    rateLimit(`otp:ip:${ip}`, 10, 3600),
    rateLimit("otp:global", DAILY_OTP_CAP, 86_400),
  ]);
  if (!checks[3]) throw new AuthError("Login by code is paused for now. Please try again later or check out as a guest.", 429);
  if (checks.includes(false)) throw new AuthError("Too many codes requested. Please wait a few minutes and try again.", 429);
  const db = await getDb();
  // Count it like our own OTPs so spend, alerts and the OTP-spike check include widget logins.
  await db.insert(otpChallenges).values({ phone, codeHash: "msg91-widget", channel: "sms", expiresAt: new Date(Date.now() + OTP_TTL_MS), ip });
  const settings = await getMessagingSettings(null);
  await db.insert(messageLog).values({
    channel: "sms",
    kind: "otp",
    category: "authentication",
    recipient: phone,
    provider: "msg91-widget",
    status: "sent",
    costMilliPaise: messageCost("sms", "authentication", settings.rates),
  });
}

/** Reads the verified identifier from MSG91's reply, or from the token's own claims. */
function verifiedIdentifier(reply: Record<string, unknown>, accessToken: string): string | null {
  const digits = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v).replace(/\D/g, "") : "");
  const data = (reply.data ?? {}) as Record<string, unknown>;
  for (const v of [reply.message, reply.identifier, reply.mobile, data.identifier, data.mobile]) {
    const d = digits(v);
    if (d.length >= 10) return d;
  }
  try {
    const claims = JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8")) as Record<string, unknown>;
    for (const k of ["identifier", "mobile", "phone", "requestedFor", "sub"]) {
      const d = digits(claims[k]);
      if (d.length >= 10) return d;
    }
  } catch {
    /* not a JWT */
  }
  return null;
}

export async function verifyWidgetLogin(args: { phone: string; accessToken: string; ip: string }) {
  if (!(await rateLimit(`otp-verify:ip:${args.ip}`, 30, 3600))) throw new AuthError("Too many attempts. Please try again later.", 429);
  const authkey = env.messaging.msg91.authKey;
  if (!authkey) throw new AuthError("Phone login is not set up yet.", 503);
  const res = await fetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ authkey, "access-token": args.accessToken }),
    signal: AbortSignal.timeout(10_000),
  });
  const reply = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || reply.type !== "success") {
    console.warn("[otp-widget] token rejected", res.status, JSON.stringify(reply).slice(0, 200));
    throw new AuthError("We could not confirm the code. Please try again.", 401);
  }
  const id = verifiedIdentifier(reply, args.accessToken);
  if (!id) {
    // Fail closed: never sign in a number MSG91 did not confirm.
    console.error("[otp-widget] no identifier in MSG91 reply; keys:", Object.keys(reply).join(","));
    throw new AuthError("We could not confirm your number. Please try again.", 502);
  }
  if (id.slice(-10) !== args.phone) throw new AuthError("That code was for a different number.", 401);
  return signInVerifiedPhone(args.phone);
}

async function startCustomerSession(customerId: string, sessionVersion: number) {
  const token = await new SignJWT({ v: sessionVersion, t: "customer" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(customerId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(sessionSecret());
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: env.isProd, sameSite: "lax", path: "/", maxAge: MAX_AGE_SECONDS });
}

export async function endCustomerSession() {
  (await cookies()).delete(COOKIE);
}

export const getCustomer = cache(async (): Promise<Customer | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  let sub: string;
  let v: number;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"] });
    if (payload.t !== "customer") return null;
    sub = payload.sub!;
    v = Number(payload.v);
  } catch {
    return null;
  }
  const db = await getDb();
  const [c] = await db.select().from(customers).where(eq(customers.id, sub));
  if (!c || c.sessionVersion !== v) return null;
  return { id: c.id, phone: c.phone, name: c.name, email: c.email, marketingWhatsapp: c.marketingWhatsapp, marketingEmail: c.marketingEmail };
});

/** Records an opt-in or opt-out and updates the customer's current choice. */
export async function setConsent(customerId: string, channel: "whatsapp" | "email", granted: boolean, source: string, ip: string | null) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [c] = await tx.select().from(customers).where(eq(customers.id, customerId)).for("update");
    if (!c) return;
    const current = channel === "whatsapp" ? c.marketingWhatsapp : c.marketingEmail;
    if (current === granted) return;
    await tx
      .update(customers)
      .set(channel === "whatsapp" ? { marketingWhatsapp: granted } : { marketingEmail: granted })
      .where(eq(customers.id, customerId));
    await tx.insert(consentEvents).values({ customerId, channel, granted, source, ip });
  });
}

/** Number of OTP codes sent in the last hour (for alerts). */
export async function otpCountSince(since: Date) {
  const db = await getDb();
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(otpChallenges).where(gte(otpChallenges.createdAt, since));
  return Number(r?.n ?? 0);
}

export async function recentOtp(phone: string) {
  const db = await getDb();
  const [r] = await db.select().from(otpChallenges).where(eq(otpChallenges.phone, phone)).orderBy(desc(otpChallenges.createdAt)).limit(1);
  return r ?? null;
}