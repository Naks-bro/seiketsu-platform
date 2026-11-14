import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { PolicyPage } from "@/components/site/policy-page";
import { getStore } from "@/lib/server/catalog";
import { businessLabel } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy policy", alternates: { canonical: "/privacy" } };

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
        <li>
          Your delivery address and its pin on the map, if you choose delivery. If you have an account you can save addresses
          to reuse; you can edit or delete them any time under Your account → Addresses. We use your phone&apos;s location only
          when you tap &ldquo;Use my current location&rdquo;, only to place the pin, and we don&apos;t keep a history of it.
          Address search goes through our own server to a free OpenStreetMap service; the map pictures themselves load from OpenFreeMap, which sees your device&apos;s internet address like any website would.
        </li>
        <li>Your order details and any notes you add.</li>
        <li>
          If you ask to be told when we deliver to your area: your name, mobile number, area, pincode and, if you give it, your email. We
          use these only to contact you about delivery to your area.
        </li>
        <li>
          If you send an enquiry about plans, bulk orders, catering or partnerships: your name, phone number, email, location, what you are
          interested in and your message. We use these only to reply to your enquiry.
        </li>
        <li>
          If you subscribe to a meal plan: your name, mobile number, email if you give it, delivery address, pincode, start date and any
          notes, plus a record of each meal delivered. We use these to run your plan.
        </li>
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
      <p>Your cart and your delivery or pickup choice are saved in your browser so they are not lost if you close the page. We do not use advertising cookies.</p>
      <h2>Contact</h2>
      <p>For privacy requests or grievances, see <Link href="/contact">Contact us</Link>.</p>
    </PolicyPage>
  );
}