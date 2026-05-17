/** Shared types for the glossary module. */
export type TermType = "concepto" | "instrumento" | "metrica";

export interface GlossaryTerm {
  id: number;
  term: string;
  category: string;
  short_def: string;
  detail: string;
  example: string;
  ticker: string | null;
  term_type: TermType;
  formula: string | null;
  created_at: string;
}

export const GLOSSARY_CATEGORIES = [
  "Renta Fija",
  "Renta Variable",
  "Derivados",
  "Tasas & Curvas",
  "Instrumentos AR",
  "Macro Argentina",
] as const;

export type GlossaryCategory = (typeof GLOSSARY_CATEGORIES)[number];
