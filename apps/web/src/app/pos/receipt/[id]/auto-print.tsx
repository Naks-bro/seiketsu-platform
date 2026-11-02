"use client";

import { useEffect } from "react";

export function AutoPrint({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (enabled) setTimeout(() => window.print(), 300);
  }, [enabled]);
  return (
    <button type="button" onClick={() => window.print()} className="no-print mb-3 w-full rounded-full bg-[#a51c47] py-2 text-sm font-semibold text-white">
      Print
    </button>
  );
}