"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import type { GlossaryTerm } from "@/lib/glossary";
import type { InstrumentoTipo, Moneda, Ley, Unidad, MarketInstrument } from "@/lib/mercado";
import { INSTRUMENTO_TIPOS, UNIDADES, TIPO_LABEL } from "@/lib/mercado";
import { fetchAllFuentes, fetchBackfill, type FuenteResult } from "@/lib/fuentes";

// ── Command Palette ────────────────────────────────────────────────────────

export interface CommandPaletteItem {
  type: "nav" | "glossary" | "instrumento";
  id: number;
  label: string;
  subtitle?: string;
  href?: string;
}

export interface CommandPaletteData {
  glossary: CommandPaletteItem[];
  instrumentos: CommandPaletteItem[];
}

/** Fetch everything the Cmd+K palette can search through. */
export async function getCommandPaletteData(): Promise<CommandPaletteData> {
  const db = getDb();

  const glossaryRows = db
    .prepare("SELECT id, term, category FROM glossary_terms ORDER BY term")
    .all() as { id: number; term: string; category: string }[];

  const instrumentRows = db
    .prepare("SELECT id, ticker, nombre, tipo FROM market_instruments WHERE activo = 1 ORDER BY ticker")
    .all() as { id: number; ticker: string; nombre: string; tipo: InstrumentoTipo }[];

  return {
    glossary: glossaryRows.map(g => ({
      type: "glossary" as const,
      id: g.id,
      label: g.term,
      subtitle: g.category,
      href: `/glossary`,
    })),
    instrumentos: instrumentRows.map(i => ({
      type: "instrumento" as const,
      id: i.id,
      label: i.ticker,
      subtitle: `${i.nombre} · ${TIPO_LABEL[i.tipo]}`,
      href: `/mercado`,
    })),
  };
}

// ── Glossary ───────────────────────────────────────────────────────────────

const GLOSSARY_ALLOWED = ["term", "category", "short_def", "detail", "example", "ticker", "formula", "term_type"];

export async function updateGlossaryTerm(
  id: number,
  field: string,
  value: string | null
) {
  if (!GLOSSARY_ALLOWED.includes(field)) return;
  getDb()
    .prepare(`UPDATE glossary_terms SET ${field} = ? WHERE id = ?`)
    .run(value, id);
  revalidatePath("/glossary");
}

export async function createGlossaryTerm(
  formData: FormData
): Promise<GlossaryTerm | null> {
  const term = (formData.get("term") as string)?.trim();
  const category = (formData.get("category") as string)?.trim();
  const short_def = (formData.get("short_def") as string)?.trim();
  const detail = (formData.get("detail") as string)?.trim();
  const example = (formData.get("example") as string)?.trim();
  const ticker = (formData.get("ticker") as string)?.trim() || null;
  const term_type = (formData.get("term_type") as string)?.trim() || "concepto";
  const formula = (formData.get("formula") as string)?.trim() || null;

  if (!term || !category || !short_def || !detail || !example) return null;

  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO glossary_terms (term, category, short_def, detail, example, ticker, term_type, formula) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(term, category, short_def, detail, example, ticker, term_type, formula);

  const newTerm = db
    .prepare("SELECT * FROM glossary_terms WHERE id = ?")
    .get(result.lastInsertRowid) as GlossaryTerm | undefined;

  revalidatePath("/glossary");
  return newTerm ?? null;
}

export async function deleteGlossaryTerm(id: number) {
  getDb().prepare("DELETE FROM glossary_terms WHERE id = ?").run(id);
  revalidatePath("/glossary");
}

// ── Mercado ────────────────────────────────────────────────────────────────

export async function saveMarketValues(
  fecha: string,
  entries: { instrumento: string; metrica: string; valor: number }[]
): Promise<{ ok: boolean; saved: number; error?: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { ok: false, saved: 0, error: "Fecha inválida" };
  }
  const valid = entries.filter(
    (e) => e.instrumento?.trim() && e.metrica?.trim() && Number.isFinite(e.valor)
  );
  if (valid.length === 0) return { ok: false, saved: 0, error: "Sin valores para guardar" };

  const db = getDb();
  const upsert = db.prepare(
    `INSERT INTO market_series (fecha, instrumento, metrica, valor, fuente)
     VALUES (?, ?, ?, ?, 'manual')
     ON CONFLICT(fecha, instrumento, metrica)
     DO UPDATE SET valor = excluded.valor, fuente = excluded.fuente`
  );
  const tx = db.transaction((rows: typeof valid) => {
    for (const e of rows) upsert.run(fecha, e.instrumento.trim().toUpperCase(), e.metrica.trim(), e.valor);
  });
  tx(valid);

  revalidatePath("/mercado");
  return { ok: true, saved: valid.length };
}

export async function addMarketInstrument(data: {
  ticker: string;
  nombre: string;
  tipo: InstrumentoTipo;
  moneda: Moneda;
  ley: Ley | null;
  unidad: Unidad;
}): Promise<{ ok: boolean; error?: string }> {
  const ticker = data.ticker?.trim().toUpperCase();
  const nombre = data.nombre?.trim();
  if (!ticker || !nombre) return { ok: false, error: "Ticker y nombre son obligatorios" };
  if (!INSTRUMENTO_TIPOS.includes(data.tipo)) return { ok: false, error: "Tipo inválido" };
  if (!UNIDADES.includes(data.unidad)) return { ok: false, error: "Unidad inválida" };
  if (!["ARS", "USD"].includes(data.moneda)) return { ok: false, error: "Moneda inválida" };
  if (data.ley !== null && !["AR", "NY"].includes(data.ley)) return { ok: false, error: "Ley inválida" };

  try {
    getDb()
      .prepare(
        "INSERT INTO market_instruments (ticker, nombre, tipo, moneda, ley, unidad) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(ticker, nombre, data.tipo, data.moneda, data.ley, data.unidad);
  } catch {
    return { ok: false, error: `Ya existe un instrumento ${ticker}` };
  }

  revalidatePath("/mercado");
  return { ok: true };
}

export async function toggleMarketInstrument(id: number, activo: boolean) {
  getDb()
    .prepare("UPDATE market_instruments SET activo = ? WHERE id = ?")
    .run(activo ? 1 : 0, id);
  revalidatePath("/mercado");
}

export interface RefreshSummary {
  fuente: string;
  label: string;
  ok: boolean;
  guardados: number;
  error?: string;
}

/** Corre todas las fuentes de ingesta y upsertea lo que devuelvan. */
export async function refreshMarketData(): Promise<RefreshSummary[]> {
  const db = getDb();
  const instruments = db
    .prepare("SELECT * FROM market_instruments WHERE activo = 1")
    .all() as MarketInstrument[];

  return persistFuentes(await fetchAllFuentes(instruments));
}

/**
 * Trae el histórico de las series que lo publican, para que los deltas de
 * 30d/90d existan desde el primer día. Idempotente: se puede repetir.
 */
export async function backfillMarketHistory(): Promise<RefreshSummary[]> {
  return persistFuentes(await fetchBackfill());
}

function persistFuentes(results: FuenteResult[]): RefreshSummary[] {
  const db = getDb();

  const upsert = db.prepare(
    `INSERT INTO market_series (fecha, instrumento, metrica, valor, fuente)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(fecha, instrumento, metrica)
     DO UPDATE SET valor = excluded.valor, fuente = excluded.fuente, created_at = datetime('now')`
  );

  const summary: RefreshSummary[] = [];
  for (const r of results) {
    const valid = r.valores.filter(
      (v) => Number.isFinite(v.valor) && /^\d{4}-\d{2}-\d{2}$/.test(v.fecha)
    );
    const tx = db.transaction((rows: typeof valid) => {
      for (const v of rows) upsert.run(v.fecha, v.instrumento, v.metrica, v.valor, r.fuente);
    });
    // Una escritura caída degrada esa fuente, no tira abajo la página entera
    try {
      tx(valid);
      summary.push({ fuente: r.fuente, label: r.label, ok: r.ok, guardados: valid.length, error: r.error });
    } catch (e) {
      summary.push({
        fuente: r.fuente,
        label: r.label,
        ok: false,
        guardados: 0,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  revalidatePath("/mercado");
  return summary;
}
