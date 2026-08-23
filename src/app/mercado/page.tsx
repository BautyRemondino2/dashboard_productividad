import { getDb } from "@/lib/db";
import { defaultMetric } from "@/lib/mercado";
import type { MarketInstrument, MarketSeriesPoint } from "@/lib/mercado";
import MercadoClient from "./MercadoClient";
import RefreshButton from "./RefreshButton";
import { TERMINO_POR_TICKER, type InstrumentoDef } from "@/lib/glosario-instrumentos";

export const metadata = { title: "Mercado · Dashboard" };

// El panel lee la DB en cada request: los valores del día cambian con cada
// refresh, así que la página no puede quedar congelada en el build.
export const dynamic = "force-dynamic";

/**
 * Combina dos series por fecha. Se usa para indicadores derivados que no se
 * guardan en la DB porque se recalculan solos cuando llegan datos nuevos.
 */
function derivarSeries(
  a: MarketSeriesPoint[] | undefined,
  b: MarketSeriesPoint[] | undefined,
  fn: (a: number, b: number) => number
): MarketSeriesPoint[] {
  if (!a?.length || !b?.length) return [];
  const bByFecha = new Map(b.map((p) => [p.fecha, p.valor]));
  const out: MarketSeriesPoint[] = [];
  for (const p of a) {
    const vb = bByFecha.get(p.fecha);
    if (vb && vb > 0) out.push({ fecha: p.fecha, valor: fn(p.valor, vb) });
  }
  return out;
}

export default function MercadoPage() {
  const db = getDb();

  const instruments = db
    .prepare("SELECT * FROM market_instruments WHERE activo = 1 ORDER BY tipo, ticker")
    .all() as MarketInstrument[];

  // Serie de la métrica por defecto de cada instrumento, ordenada asc para deltas/sparkline
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

  // Último refresh automático (para el auto-update al abrir la página)
  const last = db
    .prepare("SELECT MAX(created_at) as ts FROM market_series WHERE fuente != 'manual'")
    .get() as { ts: string | null };
  const lastUpdate = last.ts ? last.ts.replace(" ", "T") + "Z" : null;

  // Sin histórico no hay deltas de 30d/90d: pedir el backfill una única vez
  const backfilled = db
    .prepare("SELECT COUNT(*) as n FROM market_series WHERE fuente LIKE 'backfill%'")
    .get() as { n: number };

  const conDatos = instruments.filter((i) => series[i.ticker].length > 0).length;

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

  return (
    <div className="px-8 py-7 max-w-[1400px]">
      <div className="mb-6 fade-up fade-up-1 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-slate-600 mb-1">
            Dashboard
          </p>
          <h1 className="text-3xl font-semibold text-slate-100 tracking-tight">
            Mercado
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {instruments.length} instrumentos · {conDatos} con datos · panel del día
          </p>
        </div>
        <RefreshButton lastUpdate={lastUpdate} needsBackfill={backfilled.n === 0} />
      </div>

      <MercadoClient
        instruments={allInstruments}
        series={series}
        definiciones={definiciones}
      />
    </div>
  );
}
