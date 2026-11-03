import { eq } from "drizzle-orm";
import { getDb, storeSettings } from "@seiketsu/db";
import { can, getStaff } from "@/lib/server/auth";

/** The delivery pincodes as a CSV (or, with ?template=1, an example sheet to fill in). Opens in Excel. */
export async function GET(req: Request) {
  const staff = await getStaff();
  if (!staff || !can.manageSettings(staff)) return new Response("Not allowed", { status: 403 });
  const template = new URL(req.url).searchParams.get("template") === "1";
  let pins: string[] = [];
  if (!template) {
    const db = await getDb();
    const [s] = await db.select({ pins: storeSettings.deliveryPincodes }).from(storeSettings).where(eq(storeSettings.outletId, staff.outletId));
    pins = s?.pins ?? [];
  }
  const body = ["Pincode", ...(template ? ["400061", "400053"] : pins)].join("\r\n");
  return new Response("\uFEFF" + body + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${template ? "seiketsu-pincodes-template" : "seiketsu-delivery-pincodes"}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
