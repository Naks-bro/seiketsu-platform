/**
 * The SQL connection URL: DATABASE_URL, or POSTGRES_URL as provided by the Supabase-Vercel integration. Query
 * parameters some providers add for other drivers (e.g. supa=base-pooler.x) are removed.
 */
export function databaseUrlFrom(source: Record<string, string | undefined>) {
  const raw = source.DATABASE_URL?.trim() || source.POSTGRES_URL?.trim() || "";
  if (!/^postgres(?:ql)?:\/\//.test(raw)) return raw;
  try {
    const u = new URL(raw);
    for (const k of ["supa", "pgbouncer"]) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return raw;
  }
}

/** Names only in errors: never echo configuration values or credentials. */
export function productionConfigErrors(source: Record<string, string | undefined>) {
  const errors: string[] = [];
  const value = (name: string) => source[name]?.trim() ?? "";
  if (!/^postgres(?:ql)?:\/\//.test(databaseUrlFrom(source))) errors.push("DATABASE_URL (or the Supabase integration's POSTGRES_URL) must be a PostgreSQL connection URL in production.");
  if (value("SESSION_SECRET").length < 32 || value("SESSION_SECRET").startsWith("dev-only-")) errors.push("SESSION_SECRET must contain at least 32 random characters.");
  if (value("CRON_SECRET").length < 32) errors.push("CRON_SECRET must contain at least 32 random characters.");
  try {
    const url = new URL(value("NEXT_PUBLIC_SITE_URL"));
    if (url.protocol !== "https:" || ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error();
  } catch { errors.push("NEXT_PUBLIC_SITE_URL must be the HTTPS site origin."); }
  if (value("TEST_LOGINS")) errors.push("TEST_LOGINS must be empty in production.");
  if (value("PAYMENTS_MODE") === "simulator") errors.push("PAYMENTS_MODE=simulator is only permitted locally.");
  const paymentKeys = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"];
  if (paymentKeys.some((name) => value(name))) {
    for (const name of paymentKeys) if (!value(name)) errors.push(`${name} is required when Razorpay is configured.`);
  }
  const realtimeKeys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  if (realtimeKeys.some((name) => value(name))) {
    for (const name of realtimeKeys) if (!value(name)) errors.push(`${name} is required when Realtime is configured.`);
  }
  return errors;
}

export function assertProductionConfig(source: Record<string, string | undefined>) {
  const errors = productionConfigErrors(source);
  if (errors.length) throw new Error(`Production configuration is incomplete:\n${errors.join("\n")}`);
}
