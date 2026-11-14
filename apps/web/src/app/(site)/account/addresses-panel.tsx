"use client";

import { useState } from "react";
import { addressLine, MAX_SAVED_ADDRESSES } from "@seiketsu/core/address";
import { checkDelivery } from "@seiketsu/core/delivery-zones";
import { AddressPicker, type PickedAddress, type PickerStore } from "@/components/site/map/address-picker";
import { LabelIcon } from "@/components/site/delivery-address";
import type { SavedAddress } from "@/lib/server/addresses";
import { deleteAddressAction, saveAddressAction, setDefaultAddressAction, type AddressResult } from "./address-actions";

/** Saved addresses: add on the map, edit, delete, and choose the one checkout starts with. */
export function AddressesPanel({ initial, store }: { initial: SavedAddress[]; store: PickerStore }) {
  const [list, setList] = useState(initial);
  const [editing, setEditing] = useState<null | { address: SavedAddress | null }>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  function apply(r: AddressResult) {
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    setList(r.addresses);
    setError(null);
    return true;
  }

  async function save(a: PickedAddress) {
    setBusy("save");
    setSaveError(null);
    const r = await saveAddressAction(a, editing?.address?.id);
    setBusy(null);
    if (!r.ok) return setSaveError(r.error);
    apply(r);
    setEditing(null);
  }

  async function remove(a: SavedAddress) {
    if (!confirm(`Remove "${a.label}"?`)) return;
    setBusy(a.id);
    apply(await deleteAddressAction(a.id));
    setBusy(null);
  }

  async function makeDefault(a: SavedAddress) {
    setBusy(a.id);
    apply(await setDefaultAddressAction(a.id));
    setBusy(null);
  }

  return (
    <div className="space-y-4">
      {list.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line bg-white/60 px-6 py-10 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-paper text-berry">
            <LabelIcon label="Other" className="size-6" />
          </span>
          <p className="mt-3 font-semibold">No saved addresses yet</p>
          <p className="mt-1 text-sm text-muted">Save your home or work address and checkout takes one tap.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((a) => {
            const check = checkDelivery({ point: { lat: a.lat, lng: a.lng }, pincode: a.pincode, zones: store.zones, outlet: store.location, pincodes: store.deliveryPincodes, storeFeePaise: store.deliveryFeePaise, storeMinOrderPaise: store.minOrderPaise });
            return (
              <li key={a.id} className={`flex flex-col rounded-2xl border bg-white p-4 ${a.isDefault ? "border-berry/50" : "border-line"}`}>
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-paper text-berry">
                    <LabelIcon label={a.label} className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold">
                      {a.label}
                      {a.isDefault && <span className="rounded-full bg-berry/10 px-2 py-0.5 text-[11px] font-semibold text-berry">Default</span>}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">{addressLine(a)}</p>
                    {a.landmark && <p className="text-sm text-muted">Near {a.landmark}</p>}
                    <p className={`mt-2 text-xs font-medium ${check.ok ? "text-veg" : "text-nonveg"}`}>{check.ok ? "We deliver here" : "Outside our delivery area"}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3 text-sm">
                  <button type="button" onClick={() => setEditing({ address: a })} className="rounded-full border border-line px-3 py-1.5 font-medium hover:bg-paper">
                    Edit
                  </button>
                  {!a.isDefault && (
                    <button type="button" disabled={busy === a.id} onClick={() => makeDefault(a)} className="rounded-full border border-line px-3 py-1.5 font-medium hover:bg-paper disabled:opacity-50">
                      Make default
                    </button>
                  )}
                  <button type="button" disabled={busy === a.id} onClick={() => remove(a)} className="ml-auto rounded-full px-3 py-1.5 font-medium text-nonveg hover:bg-nonveg/10 disabled:opacity-50">
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {list.length < MAX_SAVED_ADDRESSES ? (
        <button
          type="button"
          onClick={() => setEditing({ address: null })}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-berry/30 bg-white/60 py-4 font-semibold text-berry transition hover:border-berry/60 hover:bg-white"
        >
          <span className="text-lg leading-none" aria-hidden="true">+</span> Add a new address
        </button>
      ) : (
        <p className="text-sm text-muted">You&apos;ve saved {MAX_SAVED_ADDRESSES} addresses, the most we keep. Remove one to add another.</p>
      )}
      {error && <p role="alert" className="rounded-xl bg-nonveg/10 p-3 text-sm text-nonveg">{error}</p>}

      {editing && (
        <AddressPicker
          mode="address"
          store={store}
          title={editing.address ? `Edit ${editing.address.label}` : "Add an address"}
          initial={editing.address}
          saving={busy === "save"}
          error={saveError}
          onClose={() => {
            setEditing(null);
            setSaveError(null);
          }}
          onConfirm={save}
        />
      )}
    </div>
  );
}
