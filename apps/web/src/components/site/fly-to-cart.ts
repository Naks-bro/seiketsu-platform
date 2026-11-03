/**
 * A small token flies from the tapped button to the cart in the header, then
 * the cart gives a little bounce. Transform and opacity only, so it stays
 * smooth on phones; skipped entirely when the visitor prefers less motion.
 */
export function flyToCart(from: Element | null | undefined, imageUrl?: string | null) {
  if (typeof window === "undefined" || !from) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const target = [...document.querySelectorAll<HTMLElement>("[data-cart-target]")].find((el) => el.offsetParent !== null);
  if (!target) return;

  const size = 46;
  const a = from.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const x0 = a.left + a.width / 2 - size / 2;
  const y0 = a.top + a.height / 2 - size / 2;
  const dx = b.left + b.width / 2 - size / 2 - x0;
  const dy = b.top + b.height / 2 - size / 2 - y0;

  const outer = document.createElement("div");
  outer.setAttribute("aria-hidden", "true");
  Object.assign(outer.style, { position: "fixed", left: `${x0}px`, top: `${y0}px`, width: `${size}px`, height: `${size}px`, zIndex: "70", pointerEvents: "none" });
  const token = document.createElement("div");
  Object.assign(token.style, {
    width: "100%",
    height: "100%",
    borderRadius: "9999px",
    overflow: "hidden",
    border: "2px solid #fffcf5",
    background: "#a51c47",
    boxShadow: "0 10px 24px -8px rgb(127 19 54 / 0.55)",
    display: "grid",
    placeItems: "center",
  });
  if (imageUrl) {
    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = "";
    Object.assign(img.style, { width: "100%", height: "100%", objectFit: "cover" });
    token.appendChild(img);
  } else {
    const plus = document.createElement("span");
    plus.textContent = "+1";
    Object.assign(plus.style, { color: "#fffcf5", font: "700 14px/1 system-ui, sans-serif" });
    token.appendChild(plus);
  }
  outer.appendChild(token);
  document.body.appendChild(outer);

  const duration = 720;
  // Horizontal glide on the wrapper, vertical hop on the token: together they trace an arc.
  outer.animate([{ transform: "translateX(0)" }, { transform: `translateX(${dx}px)` }], { duration, easing: "cubic-bezier(.35,0,.65,1)", fill: "forwards" });
  const lift = Math.min(140, Math.max(60, Math.abs(dy) / 3));
  const hop = token.animate(
    [
      { transform: "translateY(0) scale(1)", opacity: 1 },
      { transform: `translateY(${-lift}px) scale(1.12)`, opacity: 1, offset: 0.32, easing: "cubic-bezier(.55,0,.9,.45)" },
      { transform: `translateY(${dy}px) scale(.32)`, opacity: 0.7 },
    ],
    { duration, easing: "cubic-bezier(.2,.7,.4,1)", fill: "forwards" },
  );
  hop.onfinish = () => {
    outer.remove();
    target.animate([{ transform: "scale(1)" }, { transform: "scale(1.2) rotate(-6deg)" }, { transform: "scale(1)" }], {
      duration: 420,
      easing: "cubic-bezier(.34,1.56,.64,1)",
    });
  };
}
