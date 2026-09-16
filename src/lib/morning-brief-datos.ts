/**
 * Morning Brief — fetch y cálculo de indicadores.
 *
 * Todo lo que este módulo hace es traer números y hacer cuentas con ellos.
 * Claude nunca ve una fuente: sólo ve lo que esto ya calculó (ver
 * `morning-brief-claude.ts`).
 *
 * Tres orígenes por indicador (`IndicadorConfig.fuente`):
 *  - `market_series`: ya lo baja y persiste `@/lib/fuentes` — se lee la
 *    columna, sin pegarle a la fuente de nuevo.
 *  - `fred`: `fredSerie` de `@/lib/fred`, que ya cachea con su propio TTL.
 *  - `yahoo`: símbolos que ningún otro módulo trae. Se reutiliza `yahooSerie`
 *    de `@/lib/fuentes` (mismo `chart()` de yahoo-finance2) y se cachea acá
 *    con el mismo patrón de `byma.ts`/`fred.ts` — TTL en memoria, sin DB.
 *
 * Una fuente que falla no rompe el brief: ese indicador queda con
 * `valor: null` (`Promise.allSettled` en `construirIndicadores`).
 */

import { getDb } from "@/lib/db";
import { fredSerie } from "@/lib/fred";
import { yahooSerie } from "@/lib/fuentes";
import type { Unidad } from "@/lib/mercado";
import { INDICADORES_BRIEF, indicadorPorId, type BloqueBrief, type IndicadorConfig, type TipoVariacion } from "@/lib/morning-brief-config";

export interface PuntoBrief {
  fecha: string;
  valor: number;
}

export interface IndicadorBrief {
  id: string;
  label: string;
  bloque: BloqueBrief;
  unidad: Unidad;
  valor: number | null;
  anterior: number | null;
  variacion: number | null;
  inusual: boolean | null;
  fecha_dato: string | null;
}

// ─── Caché en memoria para los símbolos nuevos de Yahoo (patrón byma/fred) ──

const TTL_SEGUNDOS = 900; // 15 min: el brief se abre varias veces en una mañana

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

// ─── Series por fuente ───────────────────────────────────────────────────────

/** ~150 días de calendario para tener margen sobre las 60 ruedas que pide "inusual". */
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
 *  - `pct`: variación %, la default para precios e índices.
 *  - `bps`: puntos básicos, para tasas cotizadas en puntos porcentuales.
 *  - `pb_absoluto`: diferencia directa, para series que ya están en puntos
 *    básicos (riesgo país).
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
 * Con menos de 20 variaciones disponibles, no hay muestra que alcance: null.
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
  unidad: cfg.unidad,
  valor: null,
  anterior: null,
  variacion: null,
  inusual: null,
  fecha_dato: null,
});

async function construirIndicador(cfg: IndicadorConfig): Promise<IndicadorBrief> {
  const serie = await serieDeIndicador(cfg);
  if (serie.length === 0) return VACIO(cfg);

  const ultimo = serie[serie.length - 1];
  const anterior = serie.length > 1 ? serie[serie.length - 2] : null;
  const variaciones = variacionesDeSerie(serie, cfg.tipoVariacion);

  return {
    id: cfg.id,
    label: cfg.label,
    bloque: cfg.bloque,
    unidad: cfg.unidad,
    valor: ultimo.valor,
    anterior: anterior?.valor ?? null,
    variacion: variaciones.length > 0 ? variaciones[variaciones.length - 1] : null,
    inusual: esInusual(variaciones),
    fecha_dato: ultimo.fecha,
  };
}

/** Todos los indicadores del brief, en el orden de `INDICADORES_BRIEF`. */
export async function construirIndicadores(): Promise<IndicadorBrief[]> {
  const settled = await Promise.allSettled(INDICADORES_BRIEF.map((cfg) => construirIndicador(cfg)));
  return INDICADORES_BRIEF.map((cfg, i) => {
    const r = settled[i];
    return r.status === "fulfilled" ? r.value : VACIO(cfg);
  });
}

/** Un solo indicador por id — lo usa la evaluación al cierre para no re-traer todo. */
export async function construirIndicadorPorId(id: string): Promise<IndicadorBrief | null> {
  const cfg = indicadorPorId(id);
  if (!cfg) return null;
  try {
    return await construirIndicador(cfg);
  } catch {
    return VACIO(cfg);
  }
}
