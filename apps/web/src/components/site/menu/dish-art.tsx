import { Avocado, Bowl, Broccoli, Leaf, Lemon, Tomato } from "../home/doodles";

/** A drawn stand-in, per menu section, for dishes that have no photo yet. Clearly an illustration, never a fake photo. */
const ART: Record<string, { Art: typeof Bowl; tone: string }> = {
  salads: { Art: Broccoli, tone: "bg-olive/15" },
  wraps: { Art: Tomato, tone: "bg-butter" },
  sandwiches: { Art: Tomato, tone: "bg-butter/70" },
  meals: { Art: Bowl, tone: "bg-pink/15" },
  pasta: { Art: Bowl, tone: "bg-orange/15" },
  juices: { Art: Lemon, tone: "bg-orange/20" },
  smoothies: { Art: Avocado, tone: "bg-berry/10" },
};

export function DishArt({ category, seed, size = "md" }: { category: string; seed: string; size?: "md" | "lg" }) {
  const { Art, tone } = ART[category] ?? { Art: Bowl, tone: "bg-paper" };
  // A small, stable tilt per dish so a section of placeholders doesn't look stamped out.
  const turn = ([...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % 5) * 6 - 12;
  return (
    <span aria-hidden className={`relative grid size-full place-items-center overflow-hidden ${tone}`}>
      <Leaf className={`absolute -right-3 -top-3 rotate-45 opacity-40 ${size === "lg" ? "w-24" : "w-12"}`} />
      <Art className={`${size === "lg" ? "w-40" : "w-[55%]"} drop-shadow-[0_6px_10px_rgb(42_24_30/0.12)]`} style={{ transform: `rotate(${turn}deg)` }} />
    </span>
  );
}
