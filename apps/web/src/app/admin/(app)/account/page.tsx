import type { Metadata } from "next";
import { requireStaff, ROLE_LABEL } from "@/lib/server/auth";
import { PageHeader, panel } from "@/components/admin/ui";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "My account" };

export default async function MyAccountPage() {
  const me = await requireStaff();
  return (
    <div className="space-y-6">
      <PageHeader title="My account" lede={`${me.name} · ${me.email} · ${ROLE_LABEL[me.role]}`} />
      <section className={panel}>
        <h2 className="mb-4 font-display text-xl">Change password</h2>
        <PasswordForm />
      </section>
    </div>
  );
}