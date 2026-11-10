import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { PolicyPage } from "@/components/site/policy-page";
import { getStore } from "@/lib/server/catalog";
import { businessLabel } from "@/lib/legal";

export const metadata: Metadata = { title: "Refunds & cancellations", alternates: { canonical: "/refunds" } };

export default async function RefundsPage() {
  await connection();
  const store = await getStore();
  const who = businessLabel(store.name);
  return (
    <PolicyPage title="Refunds & cancellations">
      <p>Every dish at {who} is made fresh to order. This page explains what happens if an order cannot go ahead.</p>
      <h2>If we cancel or decline your order</h2>
      <p>If we decline your order or cannot complete it, we refund the full amount you paid. The refund is started from our side and goes back to the payment method you used.</p>
      <h2>If you want to cancel</h2>
      <p>Please contact us right away with your order number. Once the kitchen has started preparing your food, we may not be able to cancel it.</p>
      <h2>Problems with your food</h2>
      <p>If something is missing or not right, contact us with your order number and, if possible, a photo. We will review it and may offer a replacement or a full or partial refund.</p>
      <h2>Payment failed but money was debited</h2>
      <p>If your payment failed but the amount was debited, it is usually reversed automatically by your bank or by Razorpay. If it is not, contact us with the payment details and we will help.</p>
      <h2>How long refunds take</h2>
      <p>Refunds are processed through Razorpay to your original payment method. Once started, they usually reach your account within 5 to 7 working days, depending on your bank.</p>
      <h2>Contact</h2>
      <p>See <Link href="/contact">Contact us</Link>.</p>
    </PolicyPage>
  );
}