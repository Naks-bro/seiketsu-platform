import type { Diet } from "@/lib/types";

const META: Record<Diet, { label: string; color: string; shape: "circle" | "triangle" }> = {
  veg: { label: "Vegetarian", color: "var(--color-veg)", shape: "circle" },
  egg: { label: "Contains egg", color: "var(--color-egg)", shape: "circle" },
  non_veg: { label: "Non-vegetarian", color: "var(--color-nonveg)", shape: "triangle" },
};

/** Indian-style food mark: square outline with a dot (veg/egg) or triangle (non-veg). */
export function DietMark({ diet, size = 14 }: { diet: Diet | null; size?: number }) {
  if (!diet) return null;
  const m = META[diet];
  return (
    <span role="img" aria-label={m.label} title={m.label} className="inline-flex shrink-0">
      <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden>
        <rect x="0.75" y="0.75" width="12.5" height="12.5" rx="2" fill="none" stroke={m.color} strokeWidth="1.5" />
        {m.shape === "circle" ? <circle cx="7" cy="7" r="3.2" fill={m.color} /> : <path d="M7 3.6 10.4 9.8H3.6Z" fill={m.color} />}
      </svg>
    </span>
  );
}