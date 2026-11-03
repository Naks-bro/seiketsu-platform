import type { Metadata } from "next";
import { can, requirePage } from "@/lib/server/auth";
import { allOutlets } from "@/lib/server/outlets";
import { env } from "@/lib/server/env";
import { PageHeader } from "@/components/admin/ui";
import { OutletForm } from "./outlet-form";

export const metadata: Metadata = { title: "Outlets" };

export default async function OutletsPage() {
  const staff = await requirePage(can.manageStaff);
  const list = await allOutlets();

  return (
    <div className="space-y-8">
      <PageHeader title="Outlets" lede="Each outlet has its own hours, delivery pincodes, menu availability, orders and team. Customers are sent to the outlet that delivers to their pincode." />
      <ul className="space-y-4">
        {list.map((o) => (
          <li key={o.id}>
            <details className="group rounded-2xl border border-line bg-white" open={list.length === 1}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
                <span>
                  <span className="font-display text-2xl">{o.name}</span>
                  <span className="block text-sm text-muted">{o.addressLines.join(", ")}</span>
                </span>
                <span className="flex items-center gap-2 text-xs">
                  {o.slug === env.outletSlug && <span className="rounded-full bg-paper px-2 py-0.5">Main</span>}
                  {o.id === staff.outletId && <span className="rounded-full bg-berry/10 px-2 py-0.5 text-berry">You’re here</span>}
                  <span className={`rounded-full px-2 py-0.5 ${o.isActive ? "bg-veg/10 text-veg" : "bg-paper text-muted"}`}>{o.isActive ? "On website" : "Hidden"}</span>
                </span>
              </summary>
              <div className="border-t border-line p-5">
                <OutletForm outlet={{ id: o.id, name: o.name, address: o.addressLines.join("\n"), phone: o.phone ?? "", whatsapp: o.whatsapp ?? "", instagram: o.instagram ?? "", mapUrl: o.mapUrl ?? "", isActive: o.isActive }} />
              </div>
            </details>
          </li>
        ))}
      </ul>
      <section aria-labelledby="new-h" className="space-y-3">
        <h2 id="new-h" className="font-display text-2xl">Open a new outlet</h2>
        <p className="max-w-2xl text-sm text-muted">
          The new outlet copies this outlet’s settings and which dishes are on, then starts closed with delivery off, so it takes no orders
          until you set its hours and pincodes and open it. You become its owner; add its team from Staff once you’ve switched to it.
        </p>
        <div className="rounded-2xl border border-line bg-white p-5">
          <OutletForm outlet={null} />
        </div>
      </section>
    </div>
  );
}
