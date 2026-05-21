"use client";

import Link from "next/link";

export default function PrintToolbar({ backHref }: { backHref: string }) {
  return (
    <div className="screen-only fixed top-4 right-4 z-50 flex items-center gap-2 print:hidden">
      <button
        onClick={() => { try { window.print(); } catch { /* ignore */ } }}
        className="px-3 py-2 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800 transition-colors shadow-lg flex items-center gap-2"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" />
        </svg>
        Imprimir / Guardar PDF
      </button>
      <Link
        href={backHref}
        className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-[12px] hover:bg-slate-50 transition-colors shadow-sm"
      >
        ← Volver
      </Link>
    </div>
  );
}
