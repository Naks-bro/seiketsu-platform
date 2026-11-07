import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/server/auth";
import { orderIssuer } from "@/lib/server/order-view";
import { getStore } from "@/lib/server/catalog";
import { loadOrder } from "@/lib/server/order-view";
import { businessLabel } from "@/lib/legal";
import { formatDateTime, formatINR } from "@/lib/format";
import { AutoPrint } from "./auto-print";

const PAY_LABEL: Record<string, string> = { cash: "Cash", counter_upi: "UPI", counter_card: "Card", razorpay: "Paid online" };

/** 80 mm thermal receipt. Monospace-friendly, no colours, fits 72 mm print width. */
export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ print?: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  const { print } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const view = await loadOrder({ id });
  if (!view || view.order.outletId !== staff.outletId) notFound();
  const store = orderIssuer(view.order, await getStore(view.order.outletId));
  const { order, items, payments } = view;
  const paid = payments.find((p) => p.status === "captured" || p.status === "refunded");
  const tax = order.taxSnapshot;

  return (
    <div className="receipt mx-auto w-[72mm] bg-white p-2 font-mono text-[12px] leading-tight text-black">
      <style>{`@page { size: 80mm auto; margin: 4mm; } @media print { body { background: white } .receipt { width: 72mm } }`}</style>
      <AutoPrint enabled={print === "1"} />
      <div className="text-center">
        <p className="text-[15px] font-bold">{businessLabel(store.name)}</p>
        {store.addressLines.map((l) => <p key={l}>{l}</p>)}
        {store.phone && <p>Ph {store.phone}</p>}
        {tax.enabled && tax.gstin && <p>GSTIN {tax.gstin}</p>}
      </div>
      <p className="my-1 border-t border-dashed border-black" />
      <p className="text-center font-bold">{tax.enabled && tax.gstin ? "TAX INVOICE" : "BILL"}</p>
      <p>Bill no: {order.invoiceNumber}</p>
      <p>Order: {order.orderNumber}{order.tableLabel ? ` · ${order.tableLabel}` : ""}</p>
      <p>{formatDateTime(order.placedAt ?? order.createdAt)}</p>
      {order.customerName !== "Walk-in" && <p>Name: {order.customerName}</p>}
      <p className="my-1 border-t border-dashed border-black" />
      {items.map((i) => (
        <div key={i.id} className="mb-1">
          <p>{i.itemName}{i.variantLabel ? ` (${i.variantLabel})` : ""}</p>
          {i.addons.map((a) => <p key={a.id} className="pl-2">+ {a.name}</p>)}
          <p className="flex justify-between">
            <span>{i.quantity} x {formatINR(i.unitPricePaise + i.addons.reduce((s, a) => s + a.pricePaise, 0))}</span>
            <span>{formatINR(i.lineTotalPaise)}</span>
          </p>
        </div>
      ))}
      <p className="my-1 border-t border-dashed border-black" />
      <p className="flex justify-between"><span>Subtotal</span><span>{formatINR(order.subtotalPaise)}</span></p>
      {order.discountPaise > 0 && <p className="flex justify-between"><span>Discount</span><span>-{formatINR(order.discountPaise)}</span></p>}
      {order.deliveryFeePaise > 0 && <p className="flex justify-between"><span>Delivery</span><span>{formatINR(order.deliveryFeePaise)}</span></p>}
      {tax.enabled && order.taxPaise > 0 && (
        <>
          <p className="flex justify-between"><span>CGST {tax.rateBps / 200}%</span><span>{formatINR(Math.floor(order.taxPaise / 2))}</span></p>
          <p className="flex justify-between"><span>SGST {tax.rateBps / 200}%</span><span>{formatINR(Math.ceil(order.taxPaise / 2))}</span></p>
        </>
      )}
      <p className="flex justify-between text-[14px] font-bold"><span>TOTAL</span><span>{formatINR(order.totalPaise)}</span></p>
      {paid && <p>Paid: {PAY_LABEL[paid.provider] ?? paid.provider}</p>}
      {order.paymentState === "refunded" && <p className="font-bold">REFUNDED</p>}
      <p className="my-1 border-t border-dashed border-black" />
      <p className="text-center">Thank you! Eat clean, feel good.</p>
      {store.instagram && <p className="text-center">@{store.instagram}</p>}
    </div>
  );
}