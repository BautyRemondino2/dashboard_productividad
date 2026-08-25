import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { GLOSSARY_CATEGORIES } from "@/lib/glossary";
import type { GlossaryTerm } from "@/lib/glossary";
import GlossaryClient from "./GlossaryClient";
import { Contenedor, EncabezadoPagina } from "@/components/Card";

export const metadata = { title: "Glosario Financiero · Dashboard" };

export default function GlossaryPage() {
  const db = getDb();
  const terms = db
    .prepare("SELECT * FROM glossary_terms ORDER BY category, term")
    .all() as GlossaryTerm[];

  return (
    <Contenedor>
      <EncabezadoPagina
        titulo="Glosario"
        bajada={`${terms.length} términos · definición corta arriba, el desarrollo y la fórmula al abrir`}
      />

      {/* GlossaryClient lee ?term= para abrir un término desde el panel de Mercado */}
      <Suspense fallback={null}>
        <GlossaryClient terms={terms} categories={[...GLOSSARY_CATEGORIES]} />
      </Suspense>
    </Contenedor>
  );
}
