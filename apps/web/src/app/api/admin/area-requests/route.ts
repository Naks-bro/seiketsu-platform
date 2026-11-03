import { can, getStaff } from "@/lib/server/auth";
import { listAreaRequests } from "@/lib/server/area-requests";
import { csvCell } from "@/lib/server/reports";
import { formatDateTime } from "@/lib/format";

export async function GET() {
  const staff = await getStaff();
  if (!staff || !can.manageSettings(staff)) return new Response("Not allowed", { status: 403 });
  const rows = await listAreaRequests(staff.outletId, 5000);
  const header = ["Date", "Pincode", "Name", "Phone", "Email", "Area", "Note", "Contacted"];
  const lines = [header.join(",")].concat(
    rows.map((r) =>
      [formatDateTime(r.createdAt), r.pincode, r.name, r.phone, r.email, r.area, r.note, r.contactedAt ? formatDateTime(r.contactedAt) : ""]
        .map(csvCell)
        .join(","),
    ),
  );
  return new Response("\uFEFF" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="seiketsu-area-requests.csv"', "Cache-Control": "no-store" },
  });
}
