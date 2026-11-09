import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { PolicyPage } from "@/components/site/policy-page";
import { getStore } from "@/lib/server/catalog";
import { whatsappLink } from "@/lib/format";
import { LEGAL, businessLabel } from "@/lib/legal";

export const metadata: Metadata = { title: "Contact us" };

export default async function ContactPage() {
  await connection();
  const store = await getStore();
  const wa = whatsappLink(store.whatsapp);
  return (
    <PolicyPage title="Contact us">
      <p>Questions about an order, a refund or our food? The quickest way is to <Link href="/support">send us a help request</Link>; you get a page to follow our reply. Or reach us any of these ways.</p>
      <h2>Business</h2>
      <p>{businessLabel(store.name)}</p>
      <address className="not-italic">
        {store.addressLines.map((l) => <span key={l} className="block">{l}</span>)}
      </address>
      <p><a href={store.mapUrl} target="_blank" rel="noreferrer">Open in Google Maps</a></p>
      <h2>Phone & WhatsApp</h2>
      <ul>
        {store.phone && <li>Phone: <a href={`tel:${store.phone.replace(/\s/g, "")}`}>{store.phone}</a></li>}
        {wa && <li>WhatsApp: <a href={wa} target="_blank" rel="noreferrer">Message us</a></li>}
        {LEGAL.supportEmail && <li>Email: <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a></li>}
        {store.instagram && <li>Instagram: <a href={`https://instagram.com/${store.instagram}`} target="_blank" rel="noreferrer">@{store.instagram}</a></li>}
      </ul>
      <p>For an order, please share your order number (it starts with SK-) so we can help quickly.</p>
    </PolicyPage>
  );
}