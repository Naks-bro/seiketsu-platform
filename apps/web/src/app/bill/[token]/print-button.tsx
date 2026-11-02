"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="rounded-full bg-berry px-5 py-2 text-sm font-semibold text-cream hover:bg-berry-deep">
      Print / Save as PDF
    </button>
  );
}