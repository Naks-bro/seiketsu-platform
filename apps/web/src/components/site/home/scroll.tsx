"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const STORY = "(min-width: 768px) and (prefers-reduced-motion: no-preference)";
const MOTION = "(prefers-reduced-motion: no-preference)";

function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Scroll-told scenes run on screens wide enough for them, and never for people who prefer less motion. */
export const useStoryMode = () => useMedia(STORY);

/** Motion on any screen, phones included; never for people who prefer less motion. */
export const useMotionOk = () => useMedia(MOTION);

/**
 * Plays a short sequence once the element scrolls into view: returns 0 until then, then counts up to `steps`
 * one beat at a time. Without motion it returns `steps` straight away, so everything is simply shown.
 */
export function usePlayOnSeen<T extends HTMLElement>(steps: number, beat = 380) {
  const ref = useRef<T>(null);
  const motion = useMotionOk();
  const [played, setPlayed] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || !motion) return;
    let timer = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        let n = 0;
        const tick = () => {
          n += 1;
          setPlayed(n);
          if (n < steps) timer = window.setTimeout(tick, beat);
        };
        timer = window.setTimeout(tick, 150);
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, [motion, steps, beat]);
  return { ref, played: motion ? played : steps };
}

/**
 * Tracks how far the page has scrolled through a tall section (0 at its top, 1 when its end reaches the
 * bottom of the screen). The value is written to `--p` on the section, so CSS can follow it frame by frame,
 * and `--max` gets the overflow of any `[data-track]` child for sideways scenes. Returns the current step.
 */
export function useScene<T extends HTMLElement>(steps: number, enabled: boolean) {
  const ref = useRef<T>(null);
  const [step, setStep] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
      el.style.setProperty("--p", p.toFixed(4));
      const track = el.querySelector<HTMLElement>("[data-track]");
      if (track) el.style.setProperty("--max", String(Math.max(0, track.scrollWidth - el.clientWidth)));
      setStep(Math.min(steps - 1, Math.floor(p * steps)));
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    queue();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  }, [steps, enabled]);
  return { ref, step };
}

/** Scrolls the page to the middle of step `i` of a scene. */
export function scrollToStep(el: HTMLElement | null, i: number, steps: number) {
  if (!el) return;
  const total = el.offsetHeight - window.innerHeight;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + total * ((i + 0.5) / steps), behavior: "smooth" });
}

/** Writes the hero's scroll-out progress to `--h` on its parent, for a gentle parallax. */
export function ScrollOut() {
  const story = useMotionOk();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const host = ref.current?.parentElement;
    if (!host || !story) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = host.getBoundingClientRect();
      host.style.setProperty("--h", Math.min(1, Math.max(0, -r.top / r.height)).toFixed(4));
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    queue();
    window.addEventListener("scroll", queue, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", queue);
      host.style.removeProperty("--h");
    };
  }, [story]);
  return <span ref={ref} hidden />;
}
