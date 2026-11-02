export { formatINR } from "@seiketsu/core/money";

export function whatsappLink(number: string | null | undefined, text?: string) {
  if (!number) return null;
  const digits = number.replace(/\D/g, "");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function fromPrice(prices: number[]) {
  return Math.min(...prices);
}

const dt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const t = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });

export const formatDateTime = (d: Date | string) => dt.format(new Date(d));
export const formatTimeOnly = (d: Date | string) => t.format(new Date(d));