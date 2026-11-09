/**
 * Invoice arithmetic shared by subscription invoices and credit notes. Tax is
 * applied only when the owner has switched it on in Settings; nothing here
 * assumes a GST registration or a rate.
 */
import type { TaxSettings } from "./pricing.ts";
import { addDays } from "./subscriptions.ts";

export type InvoiceKind = "order" | "subscription" | "credit_note";
export const INVOICE_KIND_LABEL: Record<InvoiceKind, string> = { order: "Order bill", subscription: "Subscription", credit_note: "Credit note" };

/** Bills and subscription invoices share one series; credit notes run their own. */
export const SERIES = { invoice: "SK", credit: "CN" } as const;
/** Key in invoice_counters. Plain financial year for the main series, kept as it was. */
export const counterKey = (prefix: string, fy: string) => (prefix === SERIES.invoice ? fy : `${prefix}:${fy}`);

export type Amounts = { taxablePaise: number; taxPaise: number; totalPaise: number };

/**
 * Splits a price into taxable value, tax and total. With inclusive pricing the
 * customer pays the price; otherwise tax is added on top, as it is for orders.
 */
export function priceWithTax(pricePaise: number, tax: TaxSettings): Amounts {
  if (!Number.isInteger(pricePaise) || pricePaise < 0) throw new Error("Price must be whole paise");
  if (!tax.enabled || tax.rateBps <= 0) return { taxablePaise: pricePaise, taxPaise: 0, totalPaise: pricePaise };
  if (tax.inclusive) {
    const taxable = Math.round((pricePaise * 10000) / (10000 + tax.rateBps));
    return { taxablePaise: taxable, taxPaise: pricePaise - taxable, totalPaise: pricePaise };
  }
  const taxPaise = Math.round((pricePaise * tax.rateBps) / 10000);
  return { taxablePaise: pricePaise, taxPaise, totalPaise: pricePaise + taxPaise };
}

/** Credit note amounts for a refund of `refundPaise` against an invoice, in the invoice's own tax proportion. */
export function creditFor(refundPaise: number, original: Amounts): Amounts {
  if (refundPaise <= 0 || refundPaise > original.totalPaise) throw new Error("Refund must be between 1 paisa and the invoice total");
  const taxPaise = original.totalPaise === 0 ? 0 : Math.round((original.taxPaise * refundPaise) / original.totalPaise);
  return { taxablePaise: refundPaise - taxPaise, taxPaise, totalPaise: refundPaise };
}

export type Cycle = { startDate: string; endDate: string | null; status: string; mealsTotal: number };

/**
 * What one more paid cycle does to a subscription: the meals are added and the
 * end date moves on by the plan's length, counted from today if it had ended.
 */
export function renewCycle(sub: Cycle, plan: { mealsTotal: number; durationDays: number }, today: string) {
  const from = sub.endDate && sub.endDate >= today ? addDays(sub.endDate, 1) : today;
  return {
    mealsTotal: sub.mealsTotal + plan.mealsTotal,
    endDate: addDays(from, Math.max(1, plan.durationDays) - 1),
    status: sub.status === "completed" ? "active" : sub.status,
  };
}

/** Renewal is offered once a plan is paid and running, or finished, but not while it waits or after cancelling. */
export const canRenew = (status: string, paid: boolean) => paid && ["active", "paused", "completed"].includes(status);

/** "2026-11" for a date, in India time. */
export const istMonth = (at = new Date()) => new Date(at.getTime() + 330 * 60_000).toISOString().slice(0, 7);

/** The start and end (exclusive) of an India-time calendar month, as instants. */
export function istMonthRange(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Month must look like 2026-11");
  const [y, m] = month.split("-").map(Number);
  const offset = 330 * 60_000;
  return { from: new Date(Date.UTC(y, m - 1, 1) - offset), to: new Date(Date.UTC(y, m, 1) - offset) };
}
