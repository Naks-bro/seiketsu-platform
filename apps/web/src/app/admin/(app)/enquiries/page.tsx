import type { Metadata } from "next";
import { can, requirePage } from "@/lib/server/auth";
import { enquiryCounts, listEnquiries } from "@/lib/server/enquiries";
import { PageHeader } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/format";
import { interestLabel } from "@seiketsu/core/enquiry";
import { markEnquiryContactedAction } from "../../enquiry-actions";

export const metadata: Metadata = { title: "Enquiries" };

export default async function EnquiriesPage() {
  const staff = await requirePage(can.manageSettings);
  const [counts, rows] = await Promise.all([enquiryCounts(staff.outletId), listEnquiries(staff.outletId)]);

  return (
    <div className="space-y-8">
      <PageHeader title="Enquiries" lede="Sent from “Let’s find your perfect plan” on the home page: subscriptions, bulk orders, catering and more.">
        {rows.length > 0 && (
          <a href="/api/admin/enquiries" className="rounded-full border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-paper">
            Download CSV
          </a>
        )}
      </PageHeader>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-muted">
          No enquiries yet. When someone sends the plans form on the home page, it appears here.
        </p>
      ) : (
        <>
          <ul className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label="Enquiries by interest">
            {counts.map((c) => (
              <li key={c.interest} className="rounded-xl border border-line bg-white p-3">
                <p className="text-sm font-semibold">{interestLabel(c.interest)}</p>
                <p className="text-sm text-muted">
                  {c.total}
                  {c.waiting > 0 && <> · <span className="text-berry">{c.waiting} to reply</span></>}
                </p>
              </li>
            ))}
          </ul>

          <div className="relative overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-paper text-xs text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2">When</th>
                  <th scope="col" className="px-3 py-2">Interested in</th>
                  <th scope="col" className="px-3 py-2">Name</th>
                  <th scope="col" className="px-3 py-2">Contact</th>
                  <th scope="col" className="px-3 py-2">Location &amp; message</th>
                  <th scope="col" className="px-3 py-2"><span className="sr-only">Status</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-muted">{formatDateTime(r.createdAt)}</td>
                    <td className="px-3 py-2 font-medium">{interestLabel(r.interest)}</td>
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2">
                      <a href={`tel:+91${r.phone}`} className="text-berry hover:underline">{r.phone}</a>
                      <a href={`mailto:${r.email}`} className="block text-muted hover:underline">{r.email}</a>
                    </td>
                    <td className="px-3 py-2">
                      {r.location}
                      {r.message && <span className="block max-w-sm whitespace-pre-line text-xs text-muted">“{r.message}”</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {r.contactedAt ? (
                        <span className="text-xs text-veg">Replied</span>
                      ) : (
                        <form action={markEnquiryContactedAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className="rounded-full border border-line px-3 py-1.5 text-xs font-medium hover:bg-paper">
                            Mark replied<span className="sr-only">: {r.name}</span>
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
