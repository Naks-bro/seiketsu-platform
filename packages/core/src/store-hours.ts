/** Opening hours, evaluated in India time regardless of server timezone. */

export type DayHours = { open: string; close: string } | null; // "HH:MM"; null = closed
/** index 0 = Sunday … 6 = Saturday */
export type WeeklyHours = DayHours[];

const DAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function istParts(at: Date): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { day: DAY_INDEX[get("weekday")], minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

/** Day of week (0 = Sunday) in India time. */
export function istDayIndex(at: Date): number {
  return istParts(at).day;
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export function isOpenAt(at: Date, hours: WeeklyHours, temporarilyClosed = false): boolean {
  if (temporarilyClosed) return false;
  const { day, minutes } = istParts(at);
  const today = hours[day];
  if (today) {
    const o = toMin(today.open);
    const c = toMin(today.close);
    if (c > o ? minutes >= o && minutes < c : minutes >= o) return true;
  }
  // Hours that run past midnight from the previous day.
  const prev = hours[(day + 6) % 7];
  if (prev) {
    const o = toMin(prev.open);
    const c = toMin(prev.close);
    if (c <= o && minutes < c) return true;
  }
  return false;
}

export function formatTime(hhmm: string): string {
  const [hh, mm] = hhmm.split(":").map(Number);
  const ampm = hh >= 12 ? "pm" : "am";
  const h12 = hh % 12 || 12;
  return mm ? `${h12}:${String(mm).padStart(2, "0")} ${ampm}` : `${h12} ${ampm}`;
}

export function formatHours(h: DayHours): string {
  return h ? `${formatTime(h.open)} – ${formatTime(h.close)}` : "Closed";
}
