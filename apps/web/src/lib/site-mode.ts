/**
 * NEXT_PUBLIC_SITE_MODE=landing shows only the landing page: no cart, menu or ordering, and those routes go home.
 * Unset (the default) is the full ordering site. It is read at build time, so changing it needs a redeploy.
 */
export const LANDING_ONLY = process.env.NEXT_PUBLIC_SITE_MODE === "landing";

/** Customer pages that are switched off in landing-only mode. Admin, kitchen, POS, APIs, bills and policies stay. */
export const ORDERING_PATHS = ["/menu", "/checkout", "/account", "/subscribe", "/subscription", "/support", "/order", "/coming-soon"];

/** Files are never pages: the dish photos live under /menu/*.webp and must keep loading. */
export const isOrderingPath = (path: string) =>
  !/\.[a-z0-9]+$/i.test(path) && ORDERING_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
