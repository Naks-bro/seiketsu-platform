import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { PolicyPage } from "@/components/site/policy-page";
import { getStore } from "@/lib/server/catalog";
import { businessLabel } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy policy" };

export default async function PrivacyPage() {
  await connection();
  const store = await getStore();
  const who = businessLabel(store.name);
  return (
    <PolicyPage title="Privacy policy">
      <p>This policy explains what personal data {who} collects through this website and how it is used.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Your name and mobile number, to prepare your order and contact you about it.</li>
        <li>Your delivery address, if you choose delivery.</li>
        <li>Your order details and any notes you add.</li>
        <li>Payment status and reference numbers from Razorpay. We do not receive or store card numbers, UPI PINs or bank passwords.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To prepare, deliver and support your order, including order status updates.</li>
        <li>To issue bills and keep the records the law requires.</li>
        <li>To send offers by WhatsApp, SMS or email only if you have opted in. You can opt out at any time.</li>
      </ul>
      <h2>Who we share it with</h2>
      <p>Only with service providers that help us run orders, such as our payment processor (Razorpay), our hosting and database providers, and messaging providers that deliver order updates. We do not sell your data.</p>
      <h2>Your choices</h2>
      <p>You can ask us to show, correct or delete your personal data, or withdraw marketing consent, by contacting us. Some order records must be kept for tax and accounting purposes.</p>
      <h2>Cookies</h2>
      <p>Your cart is saved in your browser so it is not lost if you close the page. We do not use advertising cookies.</p>
      <h2>Contact</h2>
      <p>For privacy requests or grievances, see <Link href="/contact">Contact us</Link>.</p>
    </PolicyPage>
  );
}