import { isAddonIcon, type AddonIcon } from "@seiketsu/core/extras";

/** Line icons for extras, drawn on a 24px grid in the current text colour. */
const PATHS: Record<AddonIcon, React.ReactNode> = {
  protein: (
    <>
      <path d="M6 15c-1.5-3 .5-8 5-9.5S19 6 19 10s-3 8-8 8c-2.4 0-4.2-1.2-5-3Z" />
      <path d="M10 10.5c1-.8 2.6-.9 3.6 0" />
    </>
  ),
  paneer: (
    <>
      <path d="M4 9.5 12 5l8 4.5v6L12 20l-8-4.5Z" />
      <path d="M4 9.5 12 14l8-4.5M12 14v6" />
    </>
  ),
  tofu: (
    <>
      <rect x="4.5" y="7" width="15" height="11" rx="2" />
      <path d="M8 4.5c1 .8 1 1.7 0 2.5M12 4c1 .8 1 1.7 0 2.5M16 4.5c1 .8 1 1.7 0 2.5" />
    </>
  ),
  chicken: (
    <>
      <path d="M14.5 4.5a5 5 0 0 1 1.7 8.3L11 18l-2.5-2.5-3 1.2.9-2.6L6 12.7l5.2-5.2a5 5 0 0 1 3.3-3Z" />
      <circle cx="14.5" cy="9" r="1" />
    </>
  ),
  cheese: (
    <>
      <path d="M3.5 16 18 7.5l2.5 3V18h-17Z" />
      <circle cx="9" cy="14.5" r="1.2" />
      <circle cx="15" cy="13.5" r="1" />
      <circle cx="17.5" cy="16" r=".6" />
    </>
  ),
  tomato: (
    <>
      <circle cx="12" cy="13.5" r="6.5" />
      <path d="M12 7V4.5M9 7.5l3 1 3-1M10 5.5c1 .4 3 .4 4 0" />
    </>
  ),
  olive: (
    <>
      <ellipse cx="10" cy="14" rx="4" ry="5.5" transform="rotate(-25 10 14)" />
      <circle cx="10.7" cy="12.8" r="1.3" />
      <path d="M13.5 8.5c1.5-2.5 3.5-3.5 6-3.5-.5 2.5-2.5 4-5 4.5" />
    </>
  ),
  broccoli: (
    <>
      <path d="M10 20v-6M14 20v-6M9 20h6" />
      <path d="M7.5 14a3 3 0 0 1-.5-5.8 3.5 3.5 0 0 1 6.3-2.6A3 3 0 0 1 18 9a3 3 0 0 1-1.5 5Z" />
    </>
  ),
  avocado: (
    <>
      <path d="M12 3.5c3 0 4.5 4 5.5 7.5S17 20 12 20s-6.5-5.5-5.5-9S9 3.5 12 3.5Z" />
      <circle cx="12" cy="14" r="2.6" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19c0-8 5-13.5 14-14 0 9-5.5 14-14 14Z" />
      <path d="M5 19 13 11" />
    </>
  ),
  sauce: (
    <>
      <path d="M9.5 3.5h5v3l2 2.5V19a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 19V9l2-2.5Z" />
      <path d="M7.5 12.5h9" />
    </>
  ),
  dip: (
    <>
      <path d="M3.5 12h17a8.5 6.5 0 0 1-17 0Z" />
      <path d="M7 12c1-1.6 3-2.4 5-2.4s4 .8 5 2.4" />
    </>
  ),
  spice: (
    <>
      <path d="M17 5.5c-1 0-1.5.8-1.5 1.8C10 9 5 13 4 19.5c5.5-1 11-5 13-11 1-.2 2-1 2-2a1.5 1.5 0 0 0-2-1Z" />
      <path d="M17 5.5c0-1 .5-2 1.5-2.2" />
    </>
  ),
};

export function AddonIconMark({ icon, className = "size-6" }: { icon: string | null | undefined; className?: string }) {
  if (!isAddonIcon(icon)) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <circle cx="12" cy="12" r="5" />
        <path d="M12 9.5v5M9.5 12h5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[icon]}
    </svg>
  );
}
