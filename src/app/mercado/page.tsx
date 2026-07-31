import { getDb } from "@/lib/db";
import { defaultMetric } from "@/lib/mercado";
import type { MarketInstrument, MarketSeriesPoint } from "@/lib/mercado";
import MercadoClient from "./MercadoClient";
import RefreshButton from "./RefreshButton";

export const metadata = { title: "Mercado · Dashboard" };

/** Brecha CCL/oficial calculada sobre las fechas donde existen ambas series. */
function brechaSeries(
  ccl: MarketSeriesPoint[] | undefined,
  oficial: MarketSeriesPoint[] | undefined
): MarketSeriesPoint[] {
  if (!ccl?.length || !oficial?.length) return [];
  const oficialByFecha = new Map(oficial.map((p) => [p.fecha, p.valor]));
  const out: MarketSeriesPoint[] = [];
  for (const p of ccl) {
    const of = oficialByFecha.get(p.fecha);
    if (of && of > 0) out.push({ fecha: p.fecha, valor: (p.valor / of - 1) * 100 });
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

  // Indicador virtual: brecha CCL/oficial (no vive en la DB, se deriva al leer)
  const brecha = brechaSeries(series["CCL"], series["OFICIAL"]);
  const allInstruments = [...instruments];
  if (brecha.length > 0) {
    series["BRECHA"] = brecha;
    allInstruments.push({
      id: -1,
      ticker: "BRECHA",
      nombre: "Brecha CCL/oficial",
      tipo: "macro",
      moneda: "ARS",
      ley: null,
      unidad: "%",
      activo: 1,
      created_at: "",
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

      <MercadoClient instruments={allInstruments} series={series} />
    </div>
  );
}
