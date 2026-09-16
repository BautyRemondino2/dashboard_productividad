/**
 * Carga del panel: lo que /mercado y /renta-fija leen de la base.
 *
 * Las dos páginas muestran secciones distintas del mismo conjunto de
 * instrumentos, así que la lectura y los indicadores derivados viven acá y no
 * duplicados en cada `page.tsx`.
 */
import { getDb } from "@/lib/db";
import { combinarSeries, defaultMetric } from "@/lib/mercado";
import type { MarketInstrument, MarketSeriesPoint } from "@/lib/mercado";
import { TERMINO_POR_TICKER, type InstrumentoDef } from "@/lib/glosario-instrumentos";
import { tieneFuenteAutomatica } from "@/lib/fuentes";

export interface PanelDatos {
  instruments: MarketInstrument[];
  /**
   * Tickers que ninguna fuente automática cubre: los únicos que tiene sentido
   * cargar a mano. Se resuelve acá y no en el cliente porque `@/lib/fuentes`
   * —que es donde está la verdad de qué fuente cubre qué— importa
   * yahoo-finance2 y no puede viajar al bundle del navegador.
   */
  sinFuente: string[];
  series: Record<string, MarketSeriesPoint[]>;
  definiciones: Record<string, InstrumentoDef>;
  /** Último refresh automático, para el auto-update al abrir la página. */
  lastUpdate: string | null;
  needsBackfill: boolean;
  total: number;
  conDatos: number;
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

  // Contra el mayorista (A3500), que es como se mide la brecha en el mercado.
  // El minorista lleva el spread del banco adentro y da más chica.
  const brecha = combinarSeries(series["CCL"], series["MAYORISTA"], (ccl, may) => (ccl / may - 1) * 100);
  if (brecha.length > 0) {
    series["BRECHA"] = brecha;
    allInstruments.push({
      id: -1, ticker: "BRECHA", nombre: "Brecha CCL/oficial", tipo: "macro",
      moneda: "ARS", ley: null, unidad: "%", grupo: "fx", activo: 1, created_at: "",
    });
  }

  // El Merval en pesos sube con la inflación; en dólares es la comparación real
  const mervalUsd = combinarSeries(series["MERVAL"], series["CCL"], (m, ccl) => m / ccl);
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
    // Sobre los instrumentos reales y no sobre `allInstruments`: los derivados
    // (BRECHA, MERVAL_USD, con id negativo) se calculan al leer y no se cargan
    // a mano, así que colarlos acá dibujaba la tarjeta de carga vacía.
    sinFuente: instruments.filter((i) => !tieneFuenteAutomatica(i)).map((i) => i.ticker),
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
