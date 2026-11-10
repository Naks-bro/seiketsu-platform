import type { Metadata } from "next";
import { connection } from "next/server";
import type { TicketCategory } from "@seiketsu/core/tickets";
import { getCustomer } from "@/lib/server/customer-auth";
import { getStore } from "@/lib/server/catalog";
import { loadOrder } from "@/lib/server/order-view";
import { getSubscriptionByToken } from "@/lib/server/subscriptions";
import { whatsappLink } from "@/lib/format";
import { SupportForm } from "./support-form";

export const metadata: Metadata = { title: "Help & support", alternates: { canonical: "/support" } };

const safe = (v: string | undefined) => (v && /^[\w-]{10,100}$/.test(v) ? v : null);

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ order?: string; subscription?: string }> }) {
  await connection();
  const sp = await searchParams;
  const [me, store] = await Promise.all([getCustomer(), getStore()]);
  const order = safe(sp.order) ? await loadOrder({ token: sp.order! }) : null;
  const sub = safe(sp.subscription) ? await getSubscriptionByToken(sp.subscription!) : null;
  const o = order?.order;
  const s = sub?.sub;
  const defaults = {
    name: o?.customerName ?? s?.name ?? me?.name ?? "",
    phone: o?.customerPhone ?? s?.phone ?? me?.phone ?? "",
    email: o?.customerEmail ?? s?.email ?? me?.email ?? "",
    category: (o ? "order" : s ? "subscription" : "other") as TicketCategory,
    subject: o ? `Order ${o.orderNumber}` : s ? `${s.planName} subscription` : "",
  };
  const wa = whatsappLink(store.whatsapp, "Hi Seiketsu, I need some help.");

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-4">
        <p className="text-sm font-semibold text-olive-ink">Help & support</p>
        <h1 className="font-display text-4xl text-berry sm:text-5xl">How can we help?</h1>
        <p className="text-ink/75">
          Tell us what happened and our team will reply on your request page. You get a link to come back to, and you can keep the conversation going there.
        </p>
        <ul className="space-y-2 text-sm text-ink/75">
          <li>• Problems with an order or a refund are looked at first.</li>
          <li>• For anything urgent about a live order, call us{store.phone ? ` on ${store.phone}` : ""}.</li>
        </ul>
        {wa && (
          <p className="text-sm">
            Prefer chat? <a href={wa} target="_blank" rel="noreferrer" className="font-medium text-berry underline">Message us on WhatsApp</a>.
          </p>
        )}
      </div>
      <SupportForm
        defaults={defaults}
        orderToken={o ? o.publicToken : null}
        subscriptionToken={s ? s.publicToken : null}
        linkedTo={o ? `order ${o.orderNumber}` : s ? `your ${s.planName} subscription` : null}
      />
    </div>
  );
}
