"use client";

import Image from "next/image";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useState } from "react";
import { ENQUIRY_INTERESTS } from "@seiketsu/core/enquiry";
import { sendEnquiryAction } from "@/app/(site)/plans-actions";
import { LANDING_ONLY } from "@/lib/site-mode";

const PICK = "seiketsu:interest";
const box = "w-full rounded-xl border border-line bg-white px-3.5 py-3 outline-none focus:border-berry aria-[invalid=true]:border-nonveg";

/** A link to the plans form that also ticks the matching interest. */
export function PlanLink({ interest, className, children }: { interest: string; className: string; children: React.ReactNode }) {
  return (
    <a href="#plans" className={className} onClick={() => window.dispatchEvent(new CustomEvent(PICK, { detail: interest }))}>
      {children}
    </a>
  );
}

export function Plans() {
  const [state, action, pending] = useActionState(sendEnquiryAction, undefined);
  const [interest, setInterest] = useState("");

  useEffect(() => {
    const pick = (e: Event) => setInterest(String((e as CustomEvent).detail));
    window.addEventListener(PICK, pick);
    return () => window.removeEventListener(PICK, pick);
  }, []);

  const err = (k: string) => state?.fields?.[k];
  const a = (k: string) => ({ "aria-invalid": !!err(k), "aria-describedby": err(k) ? `plan-${k}-err` : undefined });
  const v = (k: string) => state?.values?.[k];
  const field = (k: string, label: string, el: React.ReactNode) => (
    <div className="space-y-1.5">
      <label htmlFor={`plan-${k}`} className="block text-sm font-medium">{label}</label>
      {el}
      {err(k) && <p id={`plan-${k}-err`} className="text-sm text-nonveg">{err(k)}</p>}
    </div>
  );

  return (
    <section id="plans" className="scroll-mt-20 bg-paper" aria-labelledby="plans-h">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-[0.85fr_1.15fr] md:gap-14">
        <div className="space-y-5">
          <p className="text-sm font-semibold text-olive-ink">The Seiketsu plans</p>
          <h2 id="plans-h" data-reveal className="font-display text-4xl leading-[1.04] text-ink sm:text-5xl">
            Let’s Find Your <em className="italic text-berry">Perfect Plan.</em>
          </h2>
          <p data-reveal className="max-w-md text-ink/70">
            Looking to eat better, order regularly or explore Seiketsu for your workplace? Tell us a little about what you’re looking for,
            and we’ll help you get started.
          </p>
          <div className="relative hidden aspect-[4/3] max-w-sm overflow-hidden rounded-[2rem] shadow-[var(--shadow-lift)] md:block">
            <Image src="/landing/cafe-standee.webp" alt="The Seiketsu counter with our menu standee" fill sizes="384px" className="object-cover" />
          </div>
        </div>

        {state?.ok ? (
          <div role="status" className="animate-sheet-up self-start rounded-3xl border border-veg/30 bg-white p-8 text-center shadow-[var(--shadow-card)]">
            <p className="mx-auto grid size-14 place-items-center rounded-full bg-veg/10 text-2xl text-veg" aria-hidden>✓</p>
            <h3 className="mt-4 font-display text-3xl text-berry">Thank you, we’ve got your enquiry.</h3>
            <p className="mx-auto mt-2 max-w-sm text-muted">We’ll get in touch with you soon.</p>
            {!LANDING_ONLY && (
              <Link href="/menu" className="mt-6 inline-block rounded-full bg-berry px-6 py-3 font-semibold text-cream hover:bg-berry-deep">
                Explore our menu
              </Link>
            )}
          </div>
        ) : (
          <form
            action={action}
            // Submit by hand so a failed attempt keeps what was typed and the chosen interest (an action-driven reset would clear them).
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              startTransition(() => action(data));
            }}
            noValidate
            className="relative space-y-4 rounded-3xl border border-line bg-white p-6 shadow-[var(--shadow-card)] sm:p-8">
            {/* Honeypot: hidden from people and screen readers. */}
            <div className="absolute -left-[9999px] size-px overflow-hidden" aria-hidden>
              <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("name", "Full Name*", <input id="plan-name" name="name" autoComplete="name" required defaultValue={v("name")} className={box} {...a("name")} />)}
              {field("phone", "Phone Number*", <input id="plan-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required defaultValue={v("phone")} className={box} {...a("phone")} />)}
              {field("email", "Email Address*", <input id="plan-email" name="email" type="email" autoComplete="email" required defaultValue={v("email")} className={box} {...a("email")} />)}
              {field("location", "Your Location*", <input id="plan-location" name="location" autoComplete="address-level2" required defaultValue={v("location")} className={box} {...a("location")} />)}
            </div>
            <fieldset aria-describedby={err("interest") ? "plan-interest-err" : undefined}>
              <legend className="text-sm font-medium">What are you interested in?*</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {ENQUIRY_INTERESTS.map((o) => (
                  <label key={o.key} className="relative cursor-pointer">
                    <input type="radio" name="interest" value={o.key} checked={interest === o.key} onChange={() => setInterest(o.key)} className="peer sr-only" />
                    <span className="block rounded-full border border-line bg-white px-4 py-2 text-sm transition peer-checked:border-berry peer-checked:bg-berry peer-checked:text-cream peer-focus-visible:ring-2 peer-focus-visible:ring-berry/40 hover:border-berry/60">
                      {o.label}
                    </span>
                  </label>
                ))}
              </div>
              {err("interest") && <p id="plan-interest-err" className="mt-1.5 text-sm text-nonveg">{err("interest")}</p>}
            </fieldset>
            {field("message", "Tell us a little more.", <textarea id="plan-message" name="message" rows={3} maxLength={1000} defaultValue={v("message")} className={box} />)}
            {state?.error && <p role="alert" className="rounded-xl bg-nonveg/10 px-4 py-3 text-sm text-nonveg">{state.error}</p>}
            <button type="submit" disabled={pending} className="w-full rounded-full bg-berry py-3.5 font-semibold text-cream shadow-[var(--shadow-float)] hover:bg-berry-deep disabled:opacity-60">
              {pending ? "Sending…" : "Submit enquiry"}
            </button>
            <p className="text-xs text-muted">
              We’ll only use these details to reply to your enquiry. See our <Link href="/privacy" className="underline">privacy policy</Link>.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
