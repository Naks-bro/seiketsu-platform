import { can, getStaff } from "@/lib/server/auth";
import { listCustomers } from "@/lib/server/crm";
import { csvCell } from "@/lib/server/reports";
import { formatDateTime } from "@/lib/format";

export async function GET(req: Request) {
  const staff = await getStaff();
  if (!staff || !can.reports(staff)) return new Response("Not allowed", { status: 403 });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const rows = await listCustomers(staff.outletId, q, 20000);
  const header = ["Name", "Phone", "Email", "Paid orders", "Spent (Rs)", "Last order", "Points", "WhatsApp offers", "Email offers", "Tags"];
  const lines = [header.join(",")].concat(
    rows.map((r) =>
      [r.name, r.phone, r.email, r.orders, (r.spentPaise / 100).toFixed(2), r.lastOrderAt ? formatDateTime(new Date(r.lastOrderAt)) : "", r.points, r.marketingWhatsapp ? "yes" : "no", r.marketingEmail ? "yes" : "no", r.tags.join(" ")]
        .map(csvCell)
        .join(","),
    ),
  );
  return new Response("\uFEFF" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="seiketsu-customers.csv"', "Cache-Control": "no-store" },
  });
}
