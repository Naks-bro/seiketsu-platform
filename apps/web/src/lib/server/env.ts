import "server-only";

const isProd = process.env.NODE_ENV === "production";

function optional(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

const razorpayKeyId = optional("RAZORPAY_KEY_ID");
const razorpayKeySecret = optional("RAZORPAY_KEY_SECRET");

/**
 * razorpay  - real Razorpay (test or live keys)
 * simulator - local-only fake gateway for development and automated tests
 * disabled  - no keys configured: customers can browse but not pay
 */
export type PaymentsMode = "razorpay" | "simulator" | "disabled";

const paymentsMode: PaymentsMode =
  razorpayKeyId && razorpayKeySecret
    ? "razorpay"
    : !isProd && process.env.PAYMENTS_MODE === "simulator"
      ? "simulator"
      : "disabled";

/**
 * live     - real messages: WhatsApp through Meta's Cloud API (WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID)
 *            and/or WhatsApp and SMS through MSG91 (MSG91_AUTH_KEY)
 * log      - development: messages are printed to the server console and logged
 * disabled - nothing is sent (production without a provider, or MESSAGING_MODE=disabled)
 */
export type MessagingMode = "live" | "log" | "disabled";
const msg91AuthKey = optional("MSG91_AUTH_KEY");
const metaWhatsApp =
  optional("WHATSAPP_ACCESS_TOKEN") && optional("WHATSAPP_PHONE_NUMBER_ID")
    ? {
        accessToken: optional("WHATSAPP_ACCESS_TOKEN")!,
        phoneNumberId: optional("WHATSAPP_PHONE_NUMBER_ID")!,
        /** Language the templates were approved in, e.g. "en" or "en_US". */
        language: optional("WHATSAPP_TEMPLATE_LANG") ?? "en",
        /** Template name for a kind: WHATSAPP_TPL_<KIND>, or "seiketsu_<kind>" by default. */
        template: (kind: string) => optional(`WHATSAPP_TPL_${kind.toUpperCase()}`) ?? `seiketsu_${kind}`,
      }
    : null;
const messagingMode: MessagingMode =
  process.env.MESSAGING_MODE === "disabled" ? "disabled" : msg91AuthKey || metaWhatsApp ? "live" : isProd ? "disabled" : "log";

const messaging = {
  mode: messagingMode,
  /** Meta WhatsApp Cloud API, when set up. Takes over WhatsApp from MSG91. */
  meta: metaWhatsApp,
  msg91: {
    authKey: msg91AuthKey,
    /** WhatsApp number connected in MSG91, with country code, e.g. 917977697408 */
    whatsappNumber: optional("MSG91_WA_NUMBER"),
    /** Shared secret in the delivery-report webhook URL (?token=...) */
    webhookToken: optional("MSG91_WEBHOOK_TOKEN"),
  },
  /** MSG91 OTP widget (public IDs). Used for phone login when set together with MSG91_AUTH_KEY. */
  otpWidget:
    msg91AuthKey && optional("NEXT_PUBLIC_MSG91_WIDGET_ID") && optional("NEXT_PUBLIC_MSG91_WIDGET_TOKEN")
      ? { widgetId: optional("NEXT_PUBLIC_MSG91_WIDGET_ID")!, tokenAuth: optional("NEXT_PUBLIC_MSG91_WIDGET_TOKEN")! }
      : null,
  /**
   * Temporary test logins that skip SMS: TEST_LOGINS="6000000001:482915,6000000002:731604".
   * For testing before MSG91 delivery works. Delete the variable before launch.
   */
  testLogins: new Map(
    (!isProd ? optional("TEST_LOGINS") ?? "" : "")
      .split(",")
      .map((pair) => pair.trim().split(":"))
      .filter(([phone, code]) => /^[6-9]\d{9}$/.test(phone ?? "") && /^\d{4,8}$/.test(code ?? ""))
      .map(([phone, code]) => [phone, code] as [string, string]),
  ),
  resendApiKey: optional("RESEND_API_KEY"),
  emailFrom: optional("EMAIL_FROM"),
  /** Template name/ID for a message kind, e.g. MSG91_WA_TPL_ORDER_PLACED / MSG91_SMS_TPL_OTP */
  template: (channel: "WA" | "SMS", kind: string) => optional(`MSG91_${channel}_TPL_${kind.toUpperCase()}`),
};

export const SIMULATOR_SECRET = "seiketsu-local-simulator-secret";

export const env = {
  isProd,
  siteUrl: (optional("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000").replace(/\/$/, ""),
  outletSlug: optional("DEFAULT_OUTLET") ?? "versova",
  paymentsMode,
  razorpay: {
    keyId: razorpayKeyId,
    keySecret: paymentsMode === "simulator" ? SIMULATOR_SECRET : razorpayKeySecret,
    webhookSecret: optional("RAZORPAY_WEBHOOK_SECRET"),
    isLive: razorpayKeyId?.startsWith("rzp_live_") ?? false,
  },
  cronSecret: optional("CRON_SECRET"),
  messaging,
  /** WhatsApp Cloud API (Meta). The verify token is any random string you also type into Meta's webhook form. */
  whatsapp: {
    verifyToken: optional("WHATSAPP_VERIFY_TOKEN"),
    appSecret: optional("WHATSAPP_APP_SECRET"),
    accessToken: optional("WHATSAPP_ACCESS_TOKEN"),
    phoneNumberId: optional("WHATSAPP_PHONE_NUMBER_ID"),
    /** Our WhatsApp number customers message to sign in (with country code, e.g. 919584758479). */
    loginNumber: optional("WHATSAPP_LOGIN_NUMBER")?.replace(/\D/g, "") || undefined,
  },
  supabase: {
    url: optional("NEXT_PUBLIC_SUPABASE_URL"),
    serviceRoleKey: optional("SUPABASE_SERVICE_ROLE_KEY"),
  },
};

export function sessionSecret(): Uint8Array {
  const s = optional("SESSION_SECRET");
  if (s && s.length >= 32) return new TextEncoder().encode(s);
  if (isProd) throw new Error("SESSION_SECRET must be set to at least 32 characters in production.");
  return new TextEncoder().encode("dev-only-session-secret-change-me-0000000000");
}