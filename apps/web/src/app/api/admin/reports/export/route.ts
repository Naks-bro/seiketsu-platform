import { can, getStaff } from "@/lib/server/auth";
import { csvCell, istDay, ordersForExport, parseRange } from "@/lib/server/reports";
import { formatDateTime } from "@/lib/format";

const rupees = (p: number) => (p / 100).toFixed(2);

export async function GET(req: Request) {
  const staff = await getStaff();
  if (!staff || !can.reports(staff)) return new Response("Not allowed", { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const range = parseRange(sp);
  const rows = await ordersForExport(staff.outletId, range);
  const header = ["Date", "Order", "Bill no", "Channel", "Payment", "Customer", "Phone", "Subtotal", "Discount", "Delivery", "Tax", "Total", "Status", "Payment status"];
  const lines = [header.join(",")].concat(
    rows.map(({ o, provider }) =>
      [
        formatDateTime(o.placedAt ?? o.createdAt),
        o.orderNumber,
        o.invoiceNumber,
        o.source,
        provider,
        o.customerName,
        o.customerPhone,
        rupees(o.subtotalPaise),
        rupees(o.discountPaise),
        rupees(o.deliveryFeePaise),
        rupees(o.taxPaise),
        rupees(o.totalPaise),
        o.status,
        o.paymentState,
      ]
        .map(csvCell)
        .join(","),
    ),
  );
  const name = `seiketsu-sales-${range.fromDay}${range.toDay !== range.fromDay ? `_to_${range.toDay}` : ""}.csv`;
  return new Response("\uFEFF" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store", "X-Generated": istDay(new Date()) },
  });
}