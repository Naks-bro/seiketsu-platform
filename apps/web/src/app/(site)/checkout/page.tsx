import type { Metadata } from "next";
import { connection } from "next/server";
import { getMenu, getStore } from "@/lib/server/catalog";
import { CheckoutForm } from "@/components/site/checkout-form";
import { getCustomer } from "@/lib/server/customer-auth";
import { listAddresses } from "@/lib/server/addresses";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  await connection();
  const store = await getStore();
  const [menu, customer] = await Promise.all([getMenu(store.outletId), getCustomer()]);
  const saved = customer ? await listAddresses(customer.id) : [];
  return (
    <div className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
      <h1 className="mb-8 font-display text-4xl text-berry">Checkout</h1>
      <CheckoutForm store={store} menu={menu} customer={customer} saved={saved} />
    </div>
  );
}