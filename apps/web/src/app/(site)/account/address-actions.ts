"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import type { AddressInput } from "@seiketsu/core/address";
import { AddressError, deleteAddress, listAddresses, saveAddress, setDefaultAddress, type SavedAddress } from "@/lib/server/addresses";
import { getCustomer } from "@/lib/server/customer-auth";

export type AddressResult = { ok: true; address?: SavedAddress; addresses: SavedAddress[] } | { ok: false; error: string };

async function run(work: (customerId: string) => Promise<SavedAddress | void>): Promise<AddressResult> {
  const me = await getCustomer();
  if (!me) return { ok: false, error: "Please sign in to save addresses." };
  try {
    const address = (await work(me.id)) ?? undefined;
    revalidatePath("/account");
    return { ok: true, address, addresses: await listAddresses(me.id) };
  } catch (err) {
    if (err instanceof ZodError) return { ok: false, error: err.issues[0]?.message ?? "Please check the address." };
    if (err instanceof AddressError) return { ok: false, error: err.message };
    console.error("[address]", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function saveAddressAction(input: AddressInput, id?: string) {
  return run((cid) => saveAddress(cid, input, id));
}

export async function deleteAddressAction(id: string) {
  return run((cid) => deleteAddress(cid, id));
}

export async function setDefaultAddressAction(id: string) {
  return run((cid) => setDefaultAddress(cid, id));
}
