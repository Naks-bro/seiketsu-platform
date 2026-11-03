"use client";

import { useActionState } from "react";
import { btnPrimary, field } from "@/components/admin/ui";
import { createOutletAction, updateOutletAction } from "../../outlet-actions";

type Fields = { id: string; name: string; address: string; phone: string; whatsapp: string; instagram: string; mapUrl: string; isActive: boolean };

export function OutletForm({ outlet }: { outlet: Fields | null }) {
  const [state, action, pending] = useActionState(outlet ? updateOutletAction : createOutletAction, undefined);
  const L = (text: string, el: React.ReactNode, hint?: string) => (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{text}</span>
      {el}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      {outlet && <input type="hidden" name="id" value={outlet.id} />}
      {L("Name", <input name="name" required defaultValue={outlet?.name} placeholder="Seiketsu Bandra" className={field} />)}
      {!outlet && L("Short name for links (optional)", <input name="slug" placeholder="bandra" className={field} />, "Made from the name if left empty")}
      {L("Address (one line per row)", <textarea name="address" required rows={3} defaultValue={outlet?.address} className={field} />)}
      <div className="grid gap-4 sm:grid-cols-2">
        {L("Phone", <input name="phone" defaultValue={outlet?.phone} placeholder="+91 95847 58479" className={field} />)}
        {L("WhatsApp number", <input name="whatsapp" defaultValue={outlet?.whatsapp} placeholder="919584758479" className={field} />, "With country code, digits only")}
        {L("Instagram", <input name="instagram" defaultValue={outlet?.instagram} placeholder="https://instagram.com/…" className={field} />)}
        {L("Google Maps link", <input name="mapUrl" defaultValue={outlet?.mapUrl} placeholder="https://maps.app.goo.gl/…" className={field} />)}
      </div>
      {outlet && (
        <label className="flex items-start gap-2 text-sm md:col-span-2">
          <input type="checkbox" name="isActive" defaultChecked={outlet.isActive} className="mt-0.5 size-4 accent-[var(--color-berry)]" />
          <span><strong>Show on the website</strong><span className="block text-muted">Hidden outlets keep their orders and data but customers can’t choose them.</span></span>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Saving…" : outlet ? "Save outlet" : "Create outlet"}</button>
        {state?.ok && <p role="status" className="text-sm text-veg">{state.ok}</p>}
        {state?.error && <p role="alert" className="text-sm text-nonveg">{state.error}</p>}
      </div>
    </form>
  );
}
