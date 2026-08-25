/**
 * Carga del panel: lo que /mercado y /renta-fija leen de la base.
 *
 * Las dos páginas muestran secciones distintas del mismo conjunto de
 * instrumentos, así que la lectura y los indicadores derivados viven acá y no
 * duplicados en cada `page.tsx`.
 */
import { getDb } from "@/lib/db";
import { defaultMetric } from "@/lib/mercado";
import type { MarketInstrument, MarketSeriesPoint } from "@/lib/mercado";
import { TERMINO_POR_TICKER, type InstrumentoDef } from "@/lib/glosario-instrumentos";

export interface PanelDatos {
  instruments: MarketInstrument[];
  series: Record<string, MarketSeriesPoint[]>;
  definiciones: Record<string, InstrumentoDef>;
  /** Último refresh automático, para el auto-update al abrir la página. */
  lastUpdate: string | null;
  needsBackfill: boolean;
  total: number;
  conDatos: number;
}

/**
 * Combina dos series por fecha, arrastrando el último valor conocido de `b`.
 *
 * Exigir que las dos tengan exactamente la misma fecha rompe los derivados: el
 * Merval y el CCL no cotizan todos los mismos días, así que la intersección
 * estricta dejaba huecos de semanas y el "contra el dato anterior" terminaba
 * comparando contra hace veinte días. Con el arrastre, cada fecha del Merval usa
 * el CCL vigente ese día, que es como se calcula de verdad.
 */
function derivarSeries(
  a: MarketSeriesPoint[] | undefined,
  b: MarketSeriesPoint[] | undefined,
  fn: (a: number, b: number) => number
): MarketSeriesPoint[] {
  if (!a?.length || !b?.length) return [];

  const out: MarketSeriesPoint[] = [];
  let i = 0;
  let vigente: number | null = null;

  for (const p of a) {
    // Avanza `b` hasta el último punto con fecha <= la de `a`
    while (i < b.length && b[i].fecha <= p.fecha) {
      vigente = b[i].valor;
      i++;
    }
    if (vigente && vigente > 0) out.push({ fecha: p.fecha, valor: fn(p.valor, vigente) });
  }
  return out;
}

export function cargarPanel(): PanelDatos {
  const db = getDb();

  const instruments = db
    .prepare("SELECT * FROM market_instruments WHERE activo = 1 ORDER BY tipo, ticker")
    .all() as MarketInstrument[];

  const seriesStmt = db.prepare(
    "SELECT fecha, valor FROM market_series WHERE instrumento = ? AND metrica = ? ORDER BY fecha ASC"
  );
  const series: Record<string, MarketSeriesPoint[]> = {};
  for (const inst of instruments) {
    series[inst.ticker] = seriesStmt.all(inst.ticker, defaultMetric(inst.tipo)) as MarketSeriesPoint[];
  }

  // Indicadores derivados: no viven en la DB, se recalculan al leer.
  const allInstruments = [...instruments];

  const brecha = derivarSeries(series["CCL"], series["OFICIAL"], (ccl, of) => (ccl / of - 1) * 100);
  if (brecha.length > 0) {
    series["BRECHA"] = brecha;
    allInstruments.push({
      id: -1, ticker: "BRECHA", nombre: "Brecha CCL/oficial", tipo: "macro",
      moneda: "ARS", ley: null, unidad: "%", grupo: "fx", activo: 1, created_at: "",
    });
  }

  // El Merval en pesos sube con la inflación; en dólares es la comparación real
  const mervalUsd = derivarSeries(series["MERVAL"], series["CCL"], (m, ccl) => m / ccl);
  if (mervalUsd.length > 0) {
    series["MERVAL_USD"] = mervalUsd;
    allInstruments.push({
      id: -2, ticker: "MERVAL_USD", nombre: "Merval en USD", tipo: "macro",
      moneda: "USD", ley: null, unidad: "idx", grupo: "acciones", activo: 1, created_at: "",
    });
  }

  const last = db
    .prepare("SELECT MAX(created_at) as ts FROM market_series WHERE fuente != 'manual'")
    .get() as { ts: string | null };

  // Sin histórico no hay deltas de 30d/90d: pedir el backfill una única vez
  const backfilled = db
    .prepare("SELECT COUNT(*) as n FROM market_series WHERE fuente LIKE 'backfill%'")
    .get() as { n: number };

  // La definición de cada instrumento sale del glosario: acá sólo se resuelve
  // el término y se manda la versión corta para el popover del panel.
  const terminos = new Map(
    (db.prepare("SELECT term, short_def, category FROM glossary_terms").all() as {
      term: string; short_def: string; category: string;
    }[]).map((t) => [t.term, t])
  );
  const definiciones: Record<string, InstrumentoDef> = {};
  for (const [ticker, term] of Object.entries(TERMINO_POR_TICKER)) {
    const t = terminos.get(term);
    if (t) definiciones[ticker] = { term: t.term, short: t.short_def, categoria: t.category };
  }

  return {
    instruments: allInstruments,
    series,
    definiciones,
    lastUpdate: last.ts ? last.ts.replace(" ", "T") + "Z" : null,
    needsBackfill: backfilled.n === 0,
    total: instruments.length,
    conDatos: instruments.filter((i) => series[i.ticker].length > 0).length,
  };
}

/** Cuántos instrumentos de estos grupos tienen datos. */
export function contarPorGrupos(datos: PanelDatos, grupos: string[]): { total: number; conDatos: number } {
  const visibles = datos.instruments.filter((i) => grupos.includes(i.grupo));
  return {
    total: visibles.length,
    conDatos: visibles.filter((i) => (datos.series[i.ticker] ?? []).length > 0).length,
  };
}
