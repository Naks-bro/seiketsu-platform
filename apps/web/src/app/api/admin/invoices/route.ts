import { INVOICE_KIND_LABEL, istMonth, istMonthRange, type InvoiceKind } from "@seiketsu/core/invoices";
import { can, getStaff } from "@/lib/server/auth";
import { invoiceRegister } from "@/lib/server/invoices";
import { csvCell } from "@/lib/server/reports";
import { formatDateTime } from "@/lib/format";

const rupees = (paise: number) => (paise / 100).toFixed(2);

/** The month's invoice register for the accountant. Amounts in rupees; credit notes negative. */
export async function GET(req: Request) {
  const staff = await getStaff();
  if (!staff || !can.reports(staff)) return new Response("Not allowed", { status: 403 });
  const url = new URL(req.url);
  const m = url.searchParams.get("month") ?? "";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : istMonth();
  const k = url.searchParams.get("kind");
  const kind = k && k in INVOICE_KIND_LABEL ? (k as InvoiceKind) : undefined;
  const rows = await invoiceRegister(staff.outletId, { ...istMonthRange(month), kind, limit: 10000 });
  const header = ["Number", "Date", "Type", "Against", "Customer", "Phone", "GSTIN", "Taxable value", "Tax", "Total"];
  const lines = [header.join(",")].concat(
    rows.map((r) =>
      [r.number, formatDateTime(r.issuedAt), INVOICE_KIND_LABEL[r.kind], r.againstNumber ?? "", r.customerName, r.customerPhone ?? "", r.gstin ?? "", rupees(r.taxablePaise), rupees(r.taxPaise), rupees(r.totalPaise)]
        .map(csvCell)
        .join(","),
    ),
  );
  return new Response("﻿" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="seiketsu-invoices-${month}.csv"`, "Cache-Control": "no-store" },
  });
}
