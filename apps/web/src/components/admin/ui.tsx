/** Small shared building blocks for staff screens, so forms and panels look the same everywhere. */
export const field = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus-visible:border-berry focus-visible:ring-2 focus-visible:ring-berry/20";
export const panel = "rounded-2xl border border-line bg-white p-5";
export const btnPrimary =
  "inline-flex min-h-10 items-center justify-center rounded-full bg-berry px-5 py-2 text-sm font-semibold text-cream hover:bg-berry-deep disabled:cursor-not-allowed disabled:opacity-60";
export const btnGhost =
  "inline-flex min-h-10 items-center justify-center rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-paper disabled:cursor-not-allowed disabled:opacity-60";

export function PageHeader({ title, children, lede }: { title: string; lede?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl text-berry">{title}</h1>
        {lede && <p className="mt-1 max-w-2xl text-sm text-muted">{lede}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function FormMessage({ state }: { state?: { ok?: string; error?: string } }) {
  if (state?.error) return <p role="alert" className="text-sm text-nonveg">{state.error}</p>;
  if (state?.ok) return <p role="status" className="text-sm text-veg">{state.ok}</p>;
  return null;
}