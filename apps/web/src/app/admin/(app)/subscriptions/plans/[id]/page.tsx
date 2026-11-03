import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requirePage } from "@/lib/server/auth";
import { getPlan } from "@/lib/server/subscriptions";
import { PageHeader } from "@/components/admin/ui";
import { PlanForm } from "./plan-form";

export const metadata: Metadata = { title: "Edit plan" };

export default async function PlanEditPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePage(can.manageMenu);
  const { id } = await params;
  const plan = id === "new" ? null : /^[0-9a-f-]{36}$/.test(id) ? await getPlan(staff.outletId, id) : null;
  if (id !== "new" && !plan) notFound();

  return (
    <div className="space-y-6">
      <Link href="/admin/subscriptions/plans" className="text-sm text-berry hover:underline">← Plans</Link>
      <PageHeader title={plan ? `Edit ${plan.name}` : "New plan"} lede="Everything here is shown to customers exactly as you write it." />
      <PlanForm
        plan={
          plan && {
            id: plan.id,
            name: plan.name,
            slug: plan.slug,
            tagline: plan.tagline ?? "",
            description: plan.description ?? "",
            mealsTotal: plan.mealsTotal,
            durationDays: plan.durationDays,
            price: plan.pricePaise / 100,
            deliveryDays: plan.deliveryDays,
            includes: plan.includes.join("\n"),
            isActive: plan.isActive,
            sort: plan.sort,
          }
        }
      />
    </div>
  );
}
