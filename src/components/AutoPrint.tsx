"use client";

import { useEffect } from "react";

/** Triggers the browser print dialog on mount, after a brief delay so KaTeX
 *  has time to render. Used on the print-only summary route. */
export default function AutoPrint({ delayMs = 700 }: { delayMs?: number }) {
  useEffect(() => {
    const t = setTimeout(() => {
      try { window.print(); } catch { /* ignore */ }
    }, delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  return null;
}
