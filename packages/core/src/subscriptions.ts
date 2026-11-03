/** Meal subscriptions: plans are set up by the owner; these rules decide what is due and when. */

export const WEEKDAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
] as const;
export type Weekday = (typeof WEEKDAYS)[number]["key"];
export const WEEKDAY_KEYS = WEEKDAYS.map((d) => d.key) as [Weekday, ...Weekday[]];

export const SUB_STATUSES = ["pending", "active", "paused", "completed", "cancelled"] as const;
export type SubStatus = (typeof SUB_STATUSES)[number];
export const SUB_STATUS_LABEL: Record<SubStatus, string> = {
  pending: "New request",
  active: "Active",
  paused: "Paused",
  completed: "Finished",
  cancelled: "Cancelled",
};

const NEXT: Record<SubStatus, SubStatus[]> = {
  pending: ["active", "cancelled"],
  active: ["paused", "completed", "cancelled"],
  paused: ["active", "cancelled"],
  completed: [],
  cancelled: [],
};
export const canMove = (from: SubStatus, to: SubStatus) => NEXT[from].includes(to);
export const nextStatuses = (from: SubStatus) => NEXT[from];

const DOW: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export const isISODate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
export const weekdayOf = (date: string): Weekday => DOW[new Date(`${date}T00:00:00Z`).getUTCDay()];

/** Today's date in India (YYYY-MM-DD). */
export const istToday = (now = new Date()) => new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
/** The last day of a plan that starts on `start` and runs `durationDays` days. */
export const endDateFor = (start: string, durationDays: number) => addDays(start, Math.max(1, durationDays) - 1);

export type DueCheck = { status: string; startDate: string; endDate: string | null; mealsUsed: number; mealsTotal: number; deliveryDays: readonly string[] };

/** Is a meal due for this subscription on `date`? An empty delivery-day list means every day. */
export function isDue(sub: DueCheck, date: string) {
  return (
    sub.status === "active" &&
    sub.startDate <= date &&
    (!sub.endDate || date <= sub.endDate) &&
    sub.mealsUsed < sub.mealsTotal &&
    (sub.deliveryDays.length === 0 || sub.deliveryDays.includes(weekdayOf(date)))
  );
}

export function progress(used: number, total: number) {
  const u = Math.min(Math.max(used, 0), total);
  return { used: u, total, left: total - u, percent: total ? Math.round((u / total) * 100) : 0 };
}

export function formatDay(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export function daysLabel(days: readonly string[]) {
  if (!days.length || days.length === 7) return "Every day";
  const keys = WEEKDAY_KEYS.filter((k) => days.includes(k));
  if (keys.join() === "mon,tue,wed,thu,fri") return "Mon to Fri";
  if (keys.join() === "mon,tue,wed,thu,fri,sat") return "Mon to Sat";
  return keys.map((k) => WEEKDAYS.find((d) => d.key === k)!.label).join(", ");
}
