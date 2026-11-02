import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/server/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Staff sign in", robots: { index: false } };

export default async function LoginPage() {
  if (await getStaff()) redirect("/admin/orders");
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-line bg-cream p-8 shadow-[var(--shadow-lift)]">
        <div>
          <p className="font-display text-3xl text-berry">seiketsu</p>
          <h1 className="mt-1 text-sm font-medium text-muted">Staff sign in</h1>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}