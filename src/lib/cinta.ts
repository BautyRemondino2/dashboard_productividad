/**
 * La cinta de indicadores: los seis números que se miran primero.
 *
 * Vive en el layout, así que se renderiza en **todas** las páginas — antes
 * estaban sólo en `/mercado` y se perdían al navegar a Equity o a Renta fija,
 * que es justo cuando hacen falta como contexto.
 *
 * Por eso la consulta es acotada: seis tickers por su nombre, no el panel
 * entero. Los últimos noventa días alcanzan para el valor y la variación contra
 * el dato anterior, que es todo lo que muestra la cinta.
 */
import { getDb } from "@/lib/db";
import {
  computePanelIndicator,
  formatDelta,
  formatValor,
  LOWER_IS_BETTER,
  type MarketSeriesPoint,
  type Unidad,
} from "@/lib/mercado";

export interface CeldaCinta {
  ticker: string;
  label: string;
  valor: string;
  /** Variación contra el dato anterior. null si no hay con qué comparar. */
  delta: string | null;
  /** Si el movimiento es a favor o en contra, ya resuelto para el riesgo país. */
  tono: "sube" | "baja" | "neutro";
  /** Contra qué fecha se comparó, para poder verificarlo al pasar el mouse. */
  refFecha: string | null;
  /** Cuántos días abarca esa comparación. */
  dias: number | null;
}

/**
 * A partir de acá el delta deja de leerse como "lo que se movió hoy".
 *
 * El riesgo país y la TAMAR se publican cada varias semanas, así que su
 * variación contra el dato anterior abarca un mes. Mostrarla en verde o rojo al
 * lado del CCL, que sí es diario, hace que se lea como un movimiento del día.
 * Pasado este umbral el delta va en gris: sigue estando, pero no compite.
 */
const DIAS_FRESCO = 5;

/** Qué muestra la cinta, en orden. Dos son derivados y se calculan acá. */
const CELDAS: { ticker: string; label: string; unidad: Unidad }[] = [
  { ticker: "CCL", label: "Dólar CCL", unidad: "ARS" },
  { ticker: "BRECHA", label: "Brecha", unidad: "%" },
  { ticker: "RIESGO_PAIS", label: "Riesgo país", unidad: "pb" },
  // Va pegado al riesgo país porque los dos se leen juntos: lo que rinde un
  // Global es esta tasa más ese spread. Un riesgo país que baja 20 pb con el
  // Tesoro subiendo 20 deja al bono exactamente donde estaba.
  { ticker: "UST10Y", label: "UST 10a", unidad: "%" },
  { ticker: "TAMAR", label: "TAMAR", unidad: "%" },
  { ticker: "MERVAL_USD", label: "Merval USD", unidad: "idx" },
  { ticker: "SPX", label: "S&P 500", unidad: "idx" },
];

/** Los dos derivados y de qué par salen. */
const DERIVADOS: Record<string, { de: [string, string]; fn: (a: number, b: number) => number }> = {
  BRECHA: { de: ["CCL", "OFICIAL"], fn: (ccl, of) => (ccl / of - 1) * 100 },
  MERVAL_USD: { de: ["MERVAL", "CCL"], fn: (m, ccl) => m / ccl },
};

/**
 * Combina dos series por fecha, arrastrando el último valor conocido de `b`.
 *
 * Exigir que las dos tengan exactamente la misma fecha rompe los derivados: el
 * Merval y el CCL no cotizan todos los mismos días, así que la intersección
 * estricta dejaba huecos de semanas y el "contra el dato anterior" terminaba
 * comparando contra hace veinte días. Con el arrastre, cada fecha del Merval usa
 * el CCL vigente ese día, que es como se calcula de verdad.
 */
function combinar(
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

export function cargarCinta(): CeldaCinta[] {
  const db = getDb();

  // Los crudos que hacen falta: los que se muestran más los dos que alimentan
  // los derivados
  const necesarios = new Set<string>(["OFICIAL", "MERVAL"]);
  for (const c of CELDAS) {
    if (DERIVADOS[c.ticker]) DERIVADOS[c.ticker].de.forEach((t) => necesarios.add(t));
    else necesarios.add(c.ticker);
  }

  const marcadores = [...necesarios].map(() => "?").join(",");
  const filas = db
    .prepare(
      `SELECT instrumento, fecha, valor FROM market_series
       WHERE instrumento IN (${marcadores}) AND metrica IN ('precio', 'valor', 'tna')
       ORDER BY fecha ASC`
    )
    .all(...necesarios) as { instrumento: string; fecha: string; valor: number }[];

  const series: Record<string, MarketSeriesPoint[]> = {};
  for (const f of filas) {
    (series[f.instrumento] ??= []).push({ fecha: f.fecha, valor: f.valor });
  }

  for (const [ticker, d] of Object.entries(DERIVADOS)) {
    series[ticker] = combinar(series[d.de[0]], series[d.de[1]], d.fn);
  }

  const salida: CeldaCinta[] = [];
  for (const celda of CELDAS) {
    const ind = computePanelIndicator(series[celda.ticker] ?? []);
    if (!ind.last) continue;

    // Para el riesgo país y la brecha, que bajen es la buena noticia
    const menosEsMejor = LOWER_IS_BETTER.has(celda.ticker);
    const subio = ind.dPrev ? ind.dPrev.abs > 0 : false;
    const plano = ind.dPrev ? Math.abs(ind.dPrev.abs) < 1e-9 : true;

    const dias = ind.dPrev
      ? Math.round(
          (Date.parse(ind.last.fecha) - Date.parse(ind.dPrev.refFecha)) / 86_400_000
        )
      : null;
    const fresco = dias != null && dias <= DIAS_FRESCO;

    salida.push({
      ticker: celda.ticker,
      label: celda.label,
      valor: formatValor(ind.last.valor, celda.unidad),
      delta: ind.dPrev
        ? `${plano ? "=" : subio ? "▲" : "▼"} ${formatDelta(ind.dPrev, celda.unidad)}`
        : null,
      tono:
        plano || !fresco ? "neutro" : (menosEsMejor ? !subio : subio) ? "sube" : "baja",
      refFecha: ind.dPrev?.refFecha ?? null,
      dias,
    });
  }

  return salida;
}

/** Cuándo entró el último dato automático, para el sello del nav. */
export function ultimaActualizacion(): string | null {
  const fila = getDb()
    .prepare("SELECT MAX(created_at) AS ts FROM market_series WHERE fuente != 'manual'")
    .get() as { ts: string | null };
  return fila.ts ? fila.ts.replace(" ", "T") + "Z" : null;
}
