/**
 * Morning Brief — fetch y cálculo.
 *
 * Cuatro orígenes por indicador (`IndicadorConfig.fuente`):
 *  - `market_series`: ya lo baja y persiste `@/lib/fuentes` — se lee la
 *    columna, sin pegarle a la fuente de nuevo.
 *  - `fred`: `fredSerie` de `@/lib/fred`, que ya cachea con su propio TTL.
 *  - `yahoo`: símbolos que ningún otro módulo trae. Se reutiliza `yahooSerie`
 *    de `@/lib/fuentes` y se cachea acá con el patrón de `byma.ts`/`fred.ts`.
 *  - `derivado`: se calcula sobre otros dos, combinando sus series por fecha
 *    con arrastre (`combinarSeries` de `mercado.ts`).
 *
 * Una fuente que falla no rompe la pantalla: ese indicador queda en `null` y
 * el resto se dibuja igual.
 */

import YahooFinance from "yahoo-finance2";
import { getDb } from "@/lib/db";
import { fredSerie } from "@/lib/fred";
import { yahooSerie } from "@/lib/fuentes";
import { combinarSeries, type Unidad } from "@/lib/mercado";
import {
  ADRS_BRIEF,
  INDICADORES_BRIEF,
  indicadorPorId,
  type BloqueBrief,
  type IndicadorConfig,
  type TipoVariacion,
} from "@/lib/morning-brief-config";

export interface PuntoBrief {
  fecha: string;
  valor: number;
}

export interface IndicadorBrief {
  id: string;
  label: string;
  bloque: BloqueBrief;
  grupo?: string;
  nota?: string;
  unidad: Unidad;
  valor: number | null;
  anterior: number | null;
  variacion: number | null;
  tipoVariacion: TipoVariacion;
  inusual: boolean | null;
  fecha_dato: string | null;
}

// ─── Caché en memoria (patrón byma/fred) ─────────────────────────────────────

const TTL_SEGUNDOS = 600; // 10 min: se abre varias veces en una misma mañana

interface Entrada<T> {
  valor: T;
  vence: number;
}

declare global {
  var __morningBriefCache: Map<string, Entrada<unknown>> | undefined;
}

const cache = (globalThis.__morningBriefCache ??= new Map<string, Entrada<unknown>>());

async function memo<T>(clave: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(clave);
  if (hit && hit.vence > Date.now()) return hit.valor as T;

  const promesa = fn();
  cache.set(clave, { valor: promesa, vence: Date.now() + TTL_SEGUNDOS * 1000 });
  try {
    return await promesa;
  } catch (e) {
    cache.delete(clave); // un error no se cachea: el próximo pedido reintenta
    throw e;
  }
}

export function invalidarBrief() {
  cache.clear();
}

// ─── Series por fuente ───────────────────────────────────────────────────────

/** ~150 días de calendario: margen sobre las 60 ruedas que pide "inusual". */
const DIAS_HISTORIA = 150;

async function serieDeIndicador(cfg: IndicadorConfig): Promise<PuntoBrief[]> {
  if (cfg.fuente.tipo === "yahoo") {
    const { symbol, factor } = cfg.fuente;
    return memo(`yahoo:${symbol}`, async () => {
      const valores = await yahooSerie(symbol, cfg.id, factor ?? 1, DIAS_HISTORIA);
      return valores.map((v) => ({ fecha: v.fecha, valor: v.valor }));
    });
  }

  if (cfg.fuente.tipo === "fred") {
    const serie = await fredSerie(cfg.fuente.serie);
    return serie.map((p) => ({ fecha: p.fecha, valor: p.valor }));
  }

  if (cfg.fuente.tipo === "derivado") {
    const [idA, idB] = cfg.fuente.de;
    const a = indicadorPorId(idA);
    const b = indicadorPorId(idB);
    if (!a || !b) return [];
    const [serieA, serieB] = await Promise.all([serieDeIndicador(a), serieDeIndicador(b)]);
    return combinarSeries(serieA, serieB, cfg.fuente.fn);
  }

  // market_series: ya persistido por @/lib/fuentes, se lee directo.
  const { ticker, metrica } = cfg.fuente;
  return getDb()
    .prepare(
      "SELECT fecha, valor FROM market_series WHERE instrumento = ? AND metrica = ? ORDER BY fecha ASC"
    )
    .all(ticker, metrica) as PuntoBrief[];
}

// ─── Cálculo ─────────────────────────────────────────────────────────────────

/**
 * Variación punto a punto, en la unidad que corresponda:
 *  - `pct`: variación %, para precios e índices.
 *  - `bps`: puntos básicos, para tasas cotizadas en puntos porcentuales.
 *  - `pb_absoluto`: diferencia directa, para series que ya vienen en puntos
 *    básicos (riesgo país, pendiente de la curva).
 */
export function variacionesDeSerie(serie: PuntoBrief[], tipo: TipoVariacion): number[] {
  const out: number[] = [];
  for (let i = 1; i < serie.length; i++) {
    const prev = serie[i - 1].valor;
    const cur = serie[i].valor;
    if (tipo === "pct") {
      if (prev !== 0) out.push((cur / prev - 1) * 100);
    } else if (tipo === "bps") {
      out.push((cur - prev) * 100);
    } else {
      // pb_absoluto y pp: la serie ya está en la unidad en la que se lee la
      // diferencia, así que es una resta.
      out.push(cur - prev);
    }
  }
  return out;
}

/** Desvío muestral (n−1): mismo criterio que `equity-riesgo.ts`. */
function desvioMuestral(xs: number[]): number {
  if (xs.length < 2) return 0;
  const media = xs.reduce((a, b) => a + b, 0) / xs.length;
  const suma = xs.reduce((a, x) => a + (x - media) ** 2, 0);
  return Math.sqrt(suma / (xs.length - 1));
}

/**
 * `|última variación| > 2 desvíos` sobre las últimas 60 ruedas.
 *
 * Es lo que separa "se movió" de "se movió raro", que es lo único que vale la
 * pena mirar dos veces a las nueve de la mañana. Con menos de 20 variaciones
 * no hay muestra que alcance: `null`, y no se marca nada.
 */
export function esInusual(variaciones: number[]): boolean | null {
  if (variaciones.length < 20) return null;
  const ventana = variaciones.slice(-60);
  const sd = desvioMuestral(ventana);
  const ultima = ventana[ventana.length - 1];
  return sd > 0 && Math.abs(ultima) > 2 * sd;
}

const VACIO = (cfg: IndicadorConfig): IndicadorBrief => ({
  id: cfg.id,
  label: cfg.label,
  bloque: cfg.bloque,
  grupo: cfg.grupo,
  nota: cfg.nota,
  unidad: cfg.unidad,
  valor: null,
  anterior: null,
  variacion: null,
  tipoVariacion: cfg.tipoVariacion,
  inusual: null,
  fecha_dato: null,
});

async function construirIndicador(cfg: IndicadorConfig): Promise<IndicadorBrief> {
  const serie = await serieDeIndicador(cfg);
  if (serie.length === 0) return VACIO(cfg);

  const ultimo = serie[serie.length - 1];
  const anterior = serie.length > 1 ? serie[serie.length - 2] : null;
  const base = { ...VACIO(cfg), valor: ultimo.valor, fecha_dato: ultimo.fecha };

  if (cfg.sinVariacion) return base;

  const variaciones = variacionesDeSerie(serie, cfg.tipoVariacion);
  return {
    ...base,
    anterior: anterior?.valor ?? null,
    variacion: variaciones.length > 0 ? variaciones[variaciones.length - 1] : null,
    inusual: esInusual(variaciones),
  };
}

/** Todos los indicadores, en el orden de `INDICADORES_BRIEF`. */
export async function construirIndicadores(): Promise<IndicadorBrief[]> {
  const settled = await Promise.allSettled(INDICADORES_BRIEF.map((cfg) => construirIndicador(cfg)));
  return INDICADORES_BRIEF.map((cfg, i) => {
    const r = settled[i];
    return r.status === "fulfilled" ? r.value : VACIO(cfg);
  });
}

// ─── ADRs en el premarket ────────────────────────────────────────────────────

export interface AdrBrief {
  symbol: string;
  nombre: string;
  /** Último cierre regular en Nueva York. */
  cierre: number | null;
  /** Variación del último cierre contra el anterior, en %. */
  variacionCierre: number | null;
  /** Precio del premarket, si el mercado está en esa fase. */
  premarket: number | null;
  /** Variación del premarket contra el cierre, en %. */
  variacionPremarket: number | null;
}

/**
 * Los ADRs argentinos, con el premarket cuando lo hay.
 *
 * Va por `quote()` y no por `chart()`: los ocho entran en un solo request y
 * es la única llamada que trae el precio de premarket, que a las nueve de la
 * mañana de Argentina es justamente lo que se quiere ver (Nueva York abre a
 * las 10:30 hora local). Fuera de esa franja los campos de premarket vienen
 * vacíos y queda sólo el cierre, que es lo correcto.
 */
export function getAdrs(): Promise<AdrBrief[]> {
  return memo("adrs", async () => {
    const yf = new YahooFinance({ validation: { logErrors: false } });
    const symbols = ADRS_BRIEF.map((a) => a.symbol);

    let quotes: Awaited<ReturnType<typeof yf.quote>> = [];
    try {
      quotes = await yf.quote(symbols);
    } catch {
      // Sin quotes no hay ADRs que mostrar, pero el resto de la pantalla vive.
      return ADRS_BRIEF.map((a) => ({
        ...a, cierre: null, variacionCierre: null, premarket: null, variacionPremarket: null,
      }));
    }

    const lista = Array.isArray(quotes) ? quotes : [quotes];
    const porSymbol = new Map(lista.map((q) => [q.symbol, q]));

    return ADRS_BRIEF.map((a) => {
      const q = porSymbol.get(a.symbol);
      const num = (v: unknown): number | null =>
        typeof v === "number" && Number.isFinite(v) ? v : null;
      return {
        symbol: a.symbol,
        nombre: a.nombre,
        cierre: num(q?.regularMarketPrice),
        variacionCierre: num(q?.regularMarketChangePercent),
        premarket: num(q?.preMarketPrice),
        variacionPremarket: num(q?.preMarketChangePercent),
      };
    });
  });
}

// ─── LECAP del tramo corto ───────────────────────────────────────────────────

/**
 * La Lecap más corta que siga viva, en tasa efectiva mensual.
 *
 * Sale de `getCurvaTasaFija()`, que es la misma curva de `/renta-fija`. No pasa
 * por el motor de series porque es un corte de hoy y no una serie histórica:
 * las Lecaps rotan con cada licitación, así que la "más corta" no es el mismo
 * papel dos meses seguidos y una variación contra ayer no querría decir nada.
 * Por eso va sin variación ni marca de inusual.
 */
export async function getLecapCorta(): Promise<IndicadorBrief | null> {
  try {
    const { getCurvaTasaFija } = await import("@/lib/bonos-tasa-fija");
    const curva = await getCurvaTasaFija();
    const vivas = curva.puntos.filter((p) => p.dias > 0).sort((a, b) => a.dias - b.dias);
    const corta = vivas[0];
    if (!corta) return null;

    return {
      id: "LECAP_CORTA",
      label: `Lecap ${corta.ticker}`,
      bloque: "argentina",
      grupo: "BCRA y tasas",
      nota: `TEM del tramo más corto de la curva · vence el ${corta.vencimiento}, en ${corta.dias} días`,
      unidad: "%",
      valor: corta.tem,
      anterior: null,
      variacion: null,
      tipoVariacion: "bps",
      inusual: null,
      fecha_dato: null,
    };
  } catch {
    return null;
  }
}

// ─── Termómetro de riesgo ────────────────────────────────────────────────────

export type Termometro = "risk-on" | "risk-off" | "mixto";

/**
 * Risk-on o risk-off, por regla y no por opinión.
 *
 * Tres votos —futuros del S&P, futuros del Nasdaq y el VIX dado vuelta— y
 * gana el que saque dos. El umbral de 0,1% en los futuros y de 1% en el VIX
 * existe para que un día plano no se lea como una señal: sin eso, un +0,02%
 * contaría igual que un +1,5%.
 *
 * Es deliberadamente simple y por eso es auditable: cualquiera puede mirar los
 * tres números de la tabla y llegar al mismo resultado.
 */
export function termometro(indicadores: IndicadorBrief[]): Termometro | null {
  const varDe = (id: string) => indicadores.find((i) => i.id === id)?.variacion ?? null;

  const spx = varDe("SP500_FUT");
  const ndx = varDe("NASDAQ_FUT");
  const vix = varDe("VIX");
  if (spx == null && ndx == null && vix == null) return null;

  const voto = (v: number | null, umbral: number) =>
    v == null ? 0 : v > umbral ? 1 : v < -umbral ? -1 : 0;

  // El VIX va invertido: que baje es apetito por riesgo.
  const suma = voto(spx, 0.1) + voto(ndx, 0.1) - voto(vix, 1);

  if (suma >= 2) return "risk-on";
  if (suma <= -2) return "risk-off";
  return "mixto";
}
