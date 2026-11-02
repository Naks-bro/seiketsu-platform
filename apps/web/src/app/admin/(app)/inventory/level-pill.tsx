import type { StockLevel } from "@seiketsu/core/inventory";

const STYLE: Record<StockLevel, string> = {
  out: "bg-nonveg/10 text-nonveg",
  low: "bg-orange/20 text-ink",
  ok: "bg-veg/10 text-veg",
};
const LABEL: Record<StockLevel, string> = { out: "Out", low: "Low", ok: "OK" };

/** Text plus colour, so the state is clear without relying on colour alone. */
export function LevelPill({ level }: { level: StockLevel }) {
  return <span className={`inline-block min-w-12 rounded-full px-2.5 py-0.5 text-center text-xs font-semibold ${STYLE[level]}`}>{LABEL[level]}</span>;
}
