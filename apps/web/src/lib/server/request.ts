import "server-only";
import { headers } from "next/headers";

/**
 * The visitor's IP, for rate limiting. Prefer headers set by the hosting
 * platform (a client cannot forge them); X-Forwarded-For is only a fallback
 * for local development, because callers can put anything in it.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-nf-client-connection-ip") ||
    h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  );
}