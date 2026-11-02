import { redirect } from "next/navigation";
import { homeFor, requireStaff } from "@/lib/server/auth";

export default async function AdminHome() {
  redirect(homeFor(await requireStaff()));
}
