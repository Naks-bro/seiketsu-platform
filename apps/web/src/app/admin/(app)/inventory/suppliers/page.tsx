import type { Metadata } from "next";
import { requireStaff } from "@/lib/server/auth";
import { listIngredients, listSuppliers } from "@/lib/server/inventory";
import { PageHeader, panel } from "@/components/admin/ui";
import { SupplierForm } from "./supplier-form";

export const metadata: Metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  const staff = await requireStaff();
  const [list, ings] = await Promise.all([listSuppliers(staff.outletId), listIngredients(staff.outletId)]);
  return (
    <>
      <PageHeader title="Suppliers" lede="Who you buy from. Pick a supplier when you record a delivery so you can see what you bought from whom." />
      <section className={panel} aria-labelledby="add-h">
        <h2 id="add-h" className="mb-4 font-display text-xl">Add a supplier</h2>
        <SupplierForm />
      </section>
      {list.length === 0 ? (
        <p className={`${panel} text-sm text-muted`}>No suppliers yet.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((s) => {
            const supplies = ings.filter((i) => i.ing.supplierId === s.id).map((i) => i.ing.name);
            return (
              <li key={s.id} className={panel}>
                <details>
                  <summary className="cursor-pointer">
                    <span className="font-display text-lg">{s.name}</span>
                    <span className="ml-3 text-sm text-muted">{[s.phone, s.email].filter(Boolean).join(" · ") || "No contact details"}</span>
                    {supplies.length > 0 && <span className="block text-xs text-muted">Usually supplies: {supplies.join(", ")}</span>}
                  </summary>
                  <div className="mt-4">
                    <SupplierForm initial={s} />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
