import { can, getStaff } from "@/lib/server/auth";
import { listEnquiries } from "@/lib/server/enquiries";
import { csvCell } from "@/lib/server/reports";
import { formatDateTime } from "@/lib/format";
import { interestLabel } from "@seiketsu/core/enquiry";

export async function GET() {
  const staff = await getStaff();
  if (!staff || !can.manageSettings(staff)) return new Response("Not allowed", { status: 403 });
  const rows = await listEnquiries(staff.outletId, 5000);
  const header = ["Date", "Interested in", "Name", "Phone", "Email", "Location", "Message", "Contacted"];
  const lines = [header.join(",")].concat(
    rows.map((r) =>
      [formatDateTime(r.createdAt), interestLabel(r.interest), r.name, r.phone, r.email, r.location, r.message, r.contactedAt ? formatDateTime(r.contactedAt) : ""]
        .map(csvCell)
        .join(","),
    ),
  );
  return new Response("\uFEFF" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="seiketsu-enquiries.csv"', "Cache-Control": "no-store" },
  });
}
