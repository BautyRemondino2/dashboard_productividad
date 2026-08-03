import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { GLOSSARY_CATEGORIES } from "@/lib/glossary";
import type { GlossaryTerm } from "@/lib/glossary";
import GlossaryClient from "./GlossaryClient";

export const metadata = { title: "Glosario Financiero · Dashboard" };

export default function GlossaryPage() {
  const db = getDb();
  const terms = db
    .prepare("SELECT * FROM glossary_terms ORDER BY category, term")
    .all() as GlossaryTerm[];

  return (
    <div className="px-8 py-7 max-w-[1400px]">
      {/* Header */}
      <div className="mb-6 fade-up fade-up-1">
        <p className="text-[11px] uppercase tracking-widest text-slate-600 mb-1">
          Dashboard
        </p>
        <h1 className="text-3xl font-semibold text-slate-100 tracking-tight">
          Glosario Financiero
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {terms.length} términos · búsqueda en tiempo real · precios live
        </p>
      </div>

      {/* GlossaryClient lee ?term= para abrir un término desde el panel de Mercado */}
      <Suspense fallback={null}>
        <GlossaryClient terms={terms} categories={[...GLOSSARY_CATEGORIES]} />
      </Suspense>
    </div>
  );
}
