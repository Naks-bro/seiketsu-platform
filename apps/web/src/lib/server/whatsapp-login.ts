import "server-only";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb, messageLog, webhookEvents } from "@seiketsu/db";
import { findLoginCode, incomingTexts, loginMessage, newLoginCode, phoneFromWhatsApp } from "@seiketsu/core/whatsapp-login";
import { AuthError, signInVerifiedPhone } from "./customer-auth";
import { env, sessionSecret } from "./env";
import { rateLimit } from "./rate-limit";

/**
 * "Verify on WhatsApp". The browser gets a short code in a signed cookie and sends it to our WhatsApp number;
 * Meta delivers that message to our signed webhook, which stores it. Seeing the code arrive from a number proves
 * the number belongs to whoever holds the cookie, so that browser is signed in. Received messages are free.
 */
const COOKIE = "sk_walogin";
const TTL_SECONDS = 10 * 60;
const expired = () => new AuthError("This login has expired. Please start again.", 410);

export const whatsappLoginReady = () => !!env.whatsapp.loginNumber && !!env.whatsapp.appSecret;

export async function startWhatsAppLogin(ip: string) {
  if (!whatsappLoginReady()) throw new AuthError("WhatsApp login is not available yet.", 503);
  if (!(await rateLimit(`wa-login:ip:${ip}`, 10, 600))) throw new AuthError("Too many attempts. Please wait a few minutes.", 429);
  const code = newLoginCode();
  const token = await new SignJWT({ code }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${TTL_SECONDS}s`).sign(sessionSecret());
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: env.isProd, sameSite: "lax", path: "/", maxAge: TTL_SECONDS });
  const text = loginMessage(code);
  const number = env.whatsapp.loginNumber!;
  return { text, number, link: `https://wa.me/${number}?text=${encodeURIComponent(text)}`, expiresInSeconds: TTL_SECONDS };
}

export async function checkWhatsAppLogin(ip: string) {
  if (!(await rateLimit(`wa-login-check:ip:${ip}`, 400, 600))) throw new AuthError("Too many attempts. Please wait a few minutes.", 429);
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) throw expired();
  let code: string;
  let issuedAt: number;
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    code = String(payload.code);
    issuedAt = Number(payload.iat);
  } catch {
    throw expired();
  }

  const db = await getDb();
  const rows = await db
    .select({ payload: webhookEvents.payload })
    .from(webhookEvents)
    .where(
      and(
        eq(webhookEvents.event, "whatsapp:messages:message"),
        gte(webhookEvents.receivedAt, new Date((issuedAt - 60) * 1000)),
        sql`${webhookEvents.payload}::text ilike ${`%SK-${code}%`}`,
      ),
    )
    .limit(5);

  for (const r of rows) {
    for (const m of incomingTexts(r.payload as Parameters<typeof incomingTexts>[0])) {
      if (findLoginCode(m.body) !== code) continue;
      const phone = phoneFromWhatsApp(m.from);
      if (!phone) throw new AuthError("Please use an Indian (+91) WhatsApp number.");
      (await cookies()).delete(COOKIE);
      await signInVerifiedPhone(phone);
      return { status: "signed-in" as const };
    }
  }
  return { status: "waiting" as const };
}

const CODE_LOGIN_TTL_MS = 5 * 60_000;
let codeLoginCache: { at: number; ready: boolean } | null = null;

type ChangeValue = { decision?: string; event?: string; message_template_name?: string };
const changeValue = (p: unknown) => ((p as { entry?: { changes?: { value?: ChangeValue }[] }[] })?.entry?.[0]?.changes?.[0]?.value ?? {}) as ChangeValue;

/**
 * Can the site send sign-in codes yet? Meta blocks every template, the code included, until the display name is
 * approved, and the code template itself must be approved too. Both approvals arrive as webhook events, so the
 * login screen switches over by itself; a code that was actually delivered also counts. WHATSAPP_CODE_LOGIN=on or
 * off overrides the check.
 */
export async function codeLoginReady(): Promise<boolean> {
  const forced = process.env.WHATSAPP_CODE_LOGIN?.trim();
  if (forced === "on") return true;
  if (forced === "off" || !env.messaging.meta) return false;
  if (codeLoginCache && Date.now() - codeLoginCache.at < CODE_LOGIN_TTL_MS) return codeLoginCache.ready;

  const db = await getDb();
  const latest = async (event: string, match?: string) => {
    const [row] = await db
      .select({ payload: webhookEvents.payload })
      .from(webhookEvents)
      .where(and(eq(webhookEvents.event, event), match ? sql`${webhookEvents.payload}::text like ${`%${match}%`}` : sql`true`))
      .orderBy(sql`${webhookEvents.receivedAt} desc`)
      .limit(1);
    return row ? changeValue(row.payload) : null;
  };
  const [name, template, delivered] = await Promise.all([
    latest("whatsapp:phone_number_name_update:other"),
    latest("whatsapp:message_template_status_update:other", `"${env.messaging.meta.template("otp")}"`),
    db.select({ n: sql<number>`count(*)::int` }).from(messageLog).where(and(eq(messageLog.kind, "otp"), eq(messageLog.status, "sent"), eq(messageLog.provider, "meta"))),
  ]);
  const ready = (delivered[0]?.n ?? 0) > 0 || (name?.decision === "APPROVED" && template?.event === "APPROVED");
  codeLoginCache = { at: Date.now(), ready };
  return ready;
}
