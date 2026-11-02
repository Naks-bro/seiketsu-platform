import { NextResponse } from "next/server";
import { can, getStaff } from "@/lib/server/auth";
import { MAX_IMAGE_BYTES, storeImage } from "@/lib/server/menu-admin";
import { rateLimit } from "@/lib/server/rate-limit";

/** Staff upload of one dish photo (already resized in the browser). */
export async function POST(req: Request) {
  const staff = await getStaff();
  if (!staff || !can.manageMenu(staff)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  if (!(await rateLimit(`img-upload:${staff.id}`, 60, 3600))) return NextResponse.json({ error: "Too many uploads. Try later." }, { status: 429 });
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_IMAGE_BYTES + 10_000) return NextResponse.json({ error: "Photo is too large (max 1.5 MB)." }, { status: 413 });
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a photo." }, { status: 400 });
    const url = await storeImage(Buffer.from(await file.arrayBuffer()), staff.id);
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed." }, { status: 400 });
  }
}