import Link from "next/link";
import { formatQty, type StockUnit } from "@seiketsu/core/inventory";
import { formatDateTime, formatINR } from "@/lib/format";

export const KIND_LABEL: Record<string, string> = {
  purchase: "Delivery",
  sale: "Sold",
  wastage: "Wasted",
  count: "Shelf count",
  adjustment: "Adjustment",
  return: "Put back (order rejected)",
};

type Row = {
  m: { id: number; kind: string; deltaMilli: number; stockAfterMilli: number; totalPaise: number | null; reference: string | null; note: string | null; createdAt: Date; orderId: string | null; ingredientId: string };
  ingredient: string;
  unit: StockUnit;
  supplier: string | null;
  orderNumber: string | null;
};

export function MovementTable({ rows, showIngredient = true }: { rows: Row[]; showIngredient?: boolean }) {
  if (!rows.length) return <p className="rounded-xl border border-line bg-white p-4 text-sm text-muted">Nothing recorded yet.</p>;
  return (
    <div className="relative overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-paper text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th scope="col" className="px-3 py-2">When</th>
            {showIngredient && <th scope="col" className="px-3 py-2">Ingredient</th>}
            <th scope="col" className="px-3 py-2">What</th>
            <th scope="col" className="px-3 py-2 text-right">Change</th>
            <th scope="col" className="px-3 py-2 text-right">Stock after</th>
            <th scope="col" className="px-3 py-2">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map(({ m, ingredient, unit, supplier, orderNumber }) => {
            const details = [
              orderNumber && m.orderId ? <Link key="o" href={`/admin/orders/${m.orderId}`} className="underline">{orderNumber}</Link> : null,
              supplier,
              m.totalPaise !== null ? formatINR(m.totalPaise) : null,
              m.reference ? `Bill ${m.reference}` : null,
              m.note,
            ].filter(Boolean);
            return (
              <tr key={m.id}>
                <td className="whitespace-nowrap px-3 py-2 text-muted">{formatDateTime(m.createdAt)}</td>
                {showIngredient && (
                  <td className="px-3 py-2"><Link href={`/admin/inventory/${m.ingredientId}`} className="hover:text-berry hover:underline">{ingredient}</Link></td>
                )}
                <td className="px-3 py-2">{KIND_LABEL[m.kind] ?? m.kind}</td>
                <td className={`tabular px-3 py-2 text-right ${m.deltaMilli < 0 ? "text-nonveg" : "text-veg"}`}>
                  {m.deltaMilli > 0 ? "+" : ""}
                  {formatQty(m.deltaMilli, unit)}
                </td>
                <td className="tabular px-3 py-2 text-right">{formatQty(m.stockAfterMilli, unit)}</td>
                <td className="px-3 py-2 text-muted">
                  {details.map((x, i) => (
                    <span key={i}>
                      {i > 0 && " · "}
                      {x}
                    </span>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
