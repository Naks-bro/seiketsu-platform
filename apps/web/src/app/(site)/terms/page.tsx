import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { PolicyPage } from "@/components/site/policy-page";
import { getStore } from "@/lib/server/catalog";
import { businessLabel } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms & conditions", alternates: { canonical: "/terms" } };

export default async function TermsPage() {
  await connection();
  const store = await getStore();
  const who = businessLabel(store.name);
  return (
    <PolicyPage title="Terms & conditions">
      <p>These terms apply when you browse this website or place an order with {who}. By placing an order you agree to them.</p>
      <h2>Orders</h2>
      <ul>
        <li>An order is confirmed only after your payment succeeds and you see an order number on the order page.</li>
        <li>Prices are in Indian Rupees and are shown on the menu and at checkout. The amount charged is the total shown at checkout.</li>
        <li>We may decline an order, for example if an item runs out or the kitchen cannot fulfil it. If we do, you get a full refund as described in our <Link href="/refunds">refund policy</Link>.</li>
        <li>Preparation and delivery times shown are estimates.</li>
      </ul>
      <h2>Food information</h2>
      <ul>
        <li>Nutrition values shown are approximate and are provided for general information.</li>
        <li>Our kitchen handles common allergens. If you have an allergy, please contact us before ordering.</li>
        <li>Photos and artwork are illustrative.</li>
      </ul>
      <h2>Payments</h2>
      <p>Online payments are processed by Razorpay. We never see or store your full card, UPI PIN or bank login details.</p>
      <h2>Your responsibilities</h2>
      <p>Please give a correct name, mobile number and, for delivery, a complete address. We are not responsible for delays caused by incorrect details.</p>
      <h2>Contact</h2>
      <p>Questions about these terms? See <Link href="/contact">Contact us</Link>.</p>
    </PolicyPage>
  );
}