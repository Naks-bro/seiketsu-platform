"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { activeOutlets, OUTLET_COOKIE } from "@/lib/server/outlets";

/** Remembers which outlet this visitor orders from (set when their pincode or pickup choice picks one). */
export async function chooseOutletAction(slug: string) {
  const s = z.string().min(1).max(60).parse(slug);
  if (!(await activeOutlets()).some((o) => o.slug === s)) return;
  (await cookies()).set(OUTLET_COOKIE, s, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
}
