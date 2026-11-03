"use client";

import { useActionState } from "react";
import { WEEKDAYS } from "@seiketsu/core/subscriptions";
import { btnPrimary, field, panel } from "@/components/admin/ui";
import { savePlanAction } from "../../../../subscription-actions";

type PlanFields = {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  mealsTotal: number;
  durationDays: number;
  price: number;
  deliveryDays: string[];
  includes: string;
  isActive: boolean;
  sort: number;
};

export function PlanForm({ plan }: { plan: PlanFields | null }) {
  const [state, action, pending] = useActionState(savePlanAction, undefined);
  const err = (k: string) => state?.fields?.[k];
  const days = plan?.deliveryDays ?? ["mon", "tue", "wed", "thu", "fri"];
  const label = (k: string, text: string, el: React.ReactNode, hint?: string) => (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{text}</span>
      {el}
      {err(k) ? <span className="block text-nonveg">{err(k)}</span> : hint ? <span className="block text-xs text-muted">{hint}</span> : null}
    </label>
  );

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      {plan && <input type="hidden" name="id" value={plan.id} />}
      <section className={`${panel} space-y-4`}>
        {label("name", "Plan name", <input name="name" defaultValue={plan?.name} required className={field} />, "For example: Weekday Lunch, 20 meals")}
        {label("tagline", "Short line", <input name="tagline" defaultValue={plan?.tagline} maxLength={140} className={field} />, "One sentence under the name")}
        {label("description", "Description", <textarea name="description" defaultValue={plan?.description} rows={5} className={field} />)}
        {label("includes", "What’s included (one per line)", <textarea name="includes" defaultValue={plan?.includes} rows={5} className={field} />)}
      </section>
      <aside className="space-y-6">
        <section className={`${panel} space-y-4`}>
          <div className="grid grid-cols-2 gap-3">
            {label("mealsTotal", "Meals", <input name="mealsTotal" type="number" min={1} defaultValue={plan?.mealsTotal ?? ""} className={field} />)}
            {label("durationDays", "Runs for (days)", <input name="durationDays" type="number" min={1} defaultValue={plan?.durationDays ?? ""} className={field} />)}
          </div>
          {label("price", "Price (₹)", <input name="price" type="number" min={1} step="1" defaultValue={plan?.price ?? ""} className={field} />, "The full price of the plan")}
          <fieldset>
            <legend className="text-sm font-medium">Delivery days</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => (
                <label key={d.key} className="relative cursor-pointer">
                  <input type="checkbox" name="days" value={d.key} defaultChecked={days.includes(d.key)} className="peer sr-only" />
                  <span className="block rounded-full border border-line px-3 py-1.5 text-sm peer-checked:border-berry peer-checked:bg-berry peer-checked:text-cream peer-focus-visible:ring-2 peer-focus-visible:ring-berry/40">{d.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {label("slug", "Web address", <input name="slug" defaultValue={plan?.slug} placeholder="made from the name" className={field} />, "The last part of the plan’s web address")}
          {label("sort", "Order on the website", <input name="sort" type="number" min={0} defaultValue={plan?.sort ?? 0} className={field} />, "Lower numbers show first")}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={plan?.isActive ?? false} className="mt-0.5 size-4 accent-[var(--color-berry)]" />
            <span>
              <strong>Show on the website</strong>
              <span className="block text-muted">Leave off while you are still writing it.</span>
            </span>
          </label>
        </section>
        {state?.error && <p role="alert" className="rounded-xl bg-nonveg/10 px-4 py-3 text-sm text-nonveg">{state.error}</p>}
        <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>{pending ? "Saving…" : "Save plan"}</button>
      </aside>
    </form>
  );
}
