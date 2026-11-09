import type { Metadata } from "next";
import { can, requirePage } from "@/lib/server/auth";
import { areaDemand, listAreaRequests } from "@/lib/server/area-requests";
import { PageHeader } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/format";
import { markContactedAction } from "../../area-actions";
import { addPincodeAction } from "../../delivery-area-actions";
import { getStore } from "@/lib/server/catalog";

export const metadata: Metadata = { title: "Area requests" };

export default async function AreaRequestsPage() {
  const staff = await requirePage(can.manageSettings);
  const [demand, rows, store] = await Promise.all([areaDemand(staff.outletId), listAreaRequests(staff.outletId), getStore(staff.outletId)]);
  const served = new Set(store.deliveryPincodes);

  return (
    <div className="space-y-8">
      <PageHeader title="Area requests" lede="People outside your delivery pincodes who asked to be told when you reach them.">
        {rows.length > 0 && (
          <a href="/api/admin/area-requests" className="rounded-full border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-paper">
            Download CSV
          </a>
        )}
      </PageHeader>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-muted">
          No requests yet. When someone checks a pincode you don&apos;t deliver to, their details appear here.
        </p>
      ) : (
        <>
          <section aria-labelledby="demand-h">
            <h2 id="demand-h" className="mb-3 font-display text-2xl">Demand by pincode</h2>
            <ul className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {demand.map((d) => (
                <li key={d.pincode} className="rounded-xl border border-line bg-white p-3">
                  <p className="tabular text-lg font-semibold">{d.pincode}</p>
                  <p className="text-sm text-muted">
                    {d.total} request{d.total === 1 ? "" : "s"}
                    {d.waiting > 0 && <> · <span className="text-berry">{d.waiting} to contact</span></>}
                  </p>
                  {served.has(d.pincode) ? (
                    <p className="mt-1 text-xs text-veg">Now delivering</p>
                  ) : (
                    <form action={addPincodeAction} className="mt-1">
                      <input type="hidden" name="pin" value={d.pincode} />
                      <button type="submit" className="text-xs font-medium text-berry hover:underline">
                        Start delivering here<span className="sr-only">: {d.pincode}</span>
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">Adding a pincode here or in Delivery areas starts delivery there straight away.</p>
          </section>

          <section aria-labelledby="list-h">
            <h2 id="list-h" className="mb-3 font-display text-2xl">All requests</h2>
            <div className="relative overflow-x-auto rounded-xl border border-line bg-white">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-paper text-xs text-muted">
                  <tr>
                    <th scope="col" className="px-3 py-2">When</th>
                    <th scope="col" className="px-3 py-2">Pincode</th>
                    <th scope="col" className="px-3 py-2">Name</th>
                    <th scope="col" className="px-3 py-2">Contact</th>
                    <th scope="col" className="px-3 py-2">Area</th>
                    <th scope="col" className="px-3 py-2"><span className="sr-only">Status</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => (
                    <tr key={r.id} className="align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-muted">{formatDateTime(r.createdAt)}</td>
                      <td className="tabular px-3 py-2 font-medium">{r.pincode}</td>
                      <td className="px-3 py-2">{r.name}</td>
                      <td className="px-3 py-2">
                        <a href={`tel:+91${r.phone}`} className="text-berry hover:underline">{r.phone}</a>
                        {r.email && <span className="block text-muted">{r.email}</span>}
                      </td>
                      <td className="px-3 py-2">
                        {r.area}
                        {r.note && <span className="block text-xs text-muted">“{r.note}”</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {r.contactedAt ? (
                          <span className="text-xs text-veg">Contacted</span>
                        ) : (
                          <form action={markContactedAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <button type="submit" className="rounded-full border border-line px-3 py-1.5 text-xs font-medium hover:bg-paper">
                              Mark contacted<span className="sr-only">: {r.name}</span>
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
