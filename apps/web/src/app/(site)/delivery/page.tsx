import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { PolicyPage } from "@/components/site/policy-page";
import { getStore } from "@/lib/server/catalog";
import { formatINR } from "@/lib/format";

export const metadata: Metadata = { title: "Delivery & pickup" };

export default async function DeliveryPage() {
  await connection();
  const store = await getStore();
  const { deliveryFeePaise, freeDeliveryAbovePaise, minOrderPaise } = store.pricing;
  return (
    <PolicyPage title="Delivery & pickup">
      <p>We do not ship goods. All orders are fresh food prepared at our kitchen and either collected by you or delivered locally.</p>
      <h2>Where we are</h2>
      <address className="not-italic">
        {store.addressLines.map((l) => <span key={l} className="block">{l}</span>)}
      </address>
      <h2>Pickup</h2>
      {store.pickupEnabled ? (
        <p>Choose pickup at checkout. Your order page shows when your food is ready. Food is usually ready in about {store.prepTimeMinutes} minutes, depending on how busy the kitchen is.</p>
      ) : (
        <p>Pickup orders are not available right now.</p>
      )}
      <h2>Delivery</h2>
      {store.deliveryEnabled ? (
        <ul>
          {store.deliveryPincodes.length > 0 && <li>We deliver to these pincodes: {store.deliveryPincodes.join(", ")}.</li>}
          <li>{deliveryFeePaise > 0 ? `Delivery charge: ${formatINR(deliveryFeePaise)}` : "No delivery charge"}{freeDeliveryAbovePaise != null && deliveryFeePaise > 0 ? `, free on orders above ${formatINR(freeDeliveryAbovePaise)}` : ""}.</li>
          <li>Deliveries are usually made the same day, shortly after your food is ready. Times are estimates and can vary with traffic and weather.</li>
          <li>Your order page shows when your food is out for delivery.</li>
        </ul>
      ) : (
        <p>Delivery is not available right now. Please choose pickup, or contact us.</p>
      )}
      {minOrderPaise > 0 && <p>Minimum order value: {formatINR(minOrderPaise)}.</p>}
      <p>For refunds on undelivered orders, see our <Link href="/refunds">refund policy</Link>.</p>
    </PolicyPage>
  );
}