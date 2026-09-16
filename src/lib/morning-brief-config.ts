/**
 * Morning Brief — configuración de indicadores.
 *
 * Una lista, en el orden en que un PM los revisa a la mañana: overnight, tasas
 * y dólar global, riesgo, commodities, Argentina. `morning-brief-datos.ts` la
 * recorre para traer y calcular; `morning-brief-claude.ts` la usa para armar
 * el esquema de salida; la UI la usa para agrupar la tabla por bloque.
 *
 * De los ~24 indicadores, varios ya se bajan y persisten en `market_series`
 * vía `@/lib/fuentes` (UST10Y, DXY, VIX, ORO, SOJA, MEP, CCL, RIESGO_PAIS,
 * RESERVAS, CAUCION1, y los precios en USD de GD30/AL30). Para esos, `fuente`
 * es `market_series` y se lee la serie ya guardada en vez de re-pegarle a la
 * fuente. Sólo son fetch nuevos los símbolos que no tiene ningún otro módulo.
 *
 * "Dólar oficial A3500" es el ticker `MAYORISTA` (BCRA variable 5,
 * "Comunicación A 3500"), no `OFICIAL` (que es la pizarra minorista de Banco
 * Nación vía dolarapi que ya usa el panel de Mercado).
 */

import type { Unidad } from "@/lib/mercado";

export type BloqueBrief = "overnight" | "tasas_dolar" | "riesgo" | "commodities" | "argentina";

export const BLOQUE_LABEL: Record<BloqueBrief, string> = {
  overnight: "Overnight",
  tasas_dolar: "Tasas y dólar global",
  riesgo: "Riesgo",
  commodities: "Commodities",
  argentina: "Argentina",
};

export type TipoVariacion = "pct" | "bps" | "pb_absoluto";

export type FuenteIndicador =
  | { tipo: "yahoo"; symbol: string; factor?: number }
  | { tipo: "fred"; serie: string }
  | { tipo: "market_series"; ticker: string; metrica: string };

export interface IndicadorConfig {
  id: string;
  label: string;
  bloque: BloqueBrief;
  fuente: FuenteIndicador;
  tipoVariacion: TipoVariacion;
  /** Banda de "estable" para la evaluación al cierre, en la unidad de tipoVariacion. */
  bandaEstable: number;
  /** Unidad para mostrar el valor (no la variación, que ya la da tipoVariacion) — reutiliza `formatValor` de mercado.ts. */
  unidad: Unidad;
}

const BANDA_TASA = 2; // pb
const BANDA_RIESGO_PAIS = 5; // pb absolutos
const BANDA_PRECIO = 0.25; // %
const BANDA_CAUCION = 50; // pb — la banda genérica de tasas es demasiado ajustada para una tasa corta

export const INDICADORES_BRIEF: IndicadorConfig[] = [
  // ── Overnight ────────────────────────────────────────────────────────────
  {
    id: "NIKKEI",
    label: "Nikkei 225",
    bloque: "overnight",
    fuente: { tipo: "yahoo", symbol: "^N225" },
    tipoVariacion: "pct",
    bandaEstable: BANDA_PRECIO,
    unidad: "idx",
  },
  {
    id: "EUROSTOXX50",
    label: "Euro Stoxx 50",
    bloque: "overnight",
    fuente: { tipo: "yahoo", symbol: "^STOXX50E" },
    tipoVariacion: "pct",
    bandaEstable: BANDA_PRECIO,
    unidad: "idx",
  },

  // ── Tasas y dólar global ─────────────────────────────────────────────────
  {
    id: "TREASURY2Y",
    label: "Treasury 2 años",
    bloque: "tasas_dolar",
    fuente: { tipo: "fred", serie: "DGS2" },
    tipoVariacion: "bps",
    bandaEstable: BANDA_TASA,
    unidad: "%",
  },
  {
    id: "TREASURY10Y",
    label: "Treasury 10 años",
    bloque: "tasas_dolar",
    // ^TNX ya viene en % (no ×10, verificado jul-2026 — ver fuentes.ts/SKILL.md)
    fuente: { tipo: "market_series", ticker: "UST10Y", metrica: "valor" },
    tipoVariacion: "bps",
    bandaEstable: BANDA_TASA,
    unidad: "%",
  },
  {
    id: "DXY",
    label: "Índice dólar (DXY)",
    bloque: "tasas_dolar",
    fuente: { tipo: "market_series", ticker: "DXY", metrica: "valor" },
    tipoVariacion: "pct",
    bandaEstable: BANDA_PRECIO,
    unidad: "idx",
  },

  // ── Riesgo ───────────────────────────────────────────────────────────────
  {
    id: "SP500_FUT",
    label: "Futuro S&P 500",
    bloque: "riesgo",
    fuente: { tipo: "yahoo", symbol: "ES=F" },
    tipoVariacion: "pct",
    bandaEstable: BANDA_PRECIO,
    unidad: "USD",
  },
  {
    id: "NASDAQ_FUT",
    label: "Futuro Nasdaq",
    bloque: "riesgo",
    fuente: { tipo: "yahoo", symbol: "NQ=F" },
    tipoVariacion: "pct",
    bandaEstable: BANDA_PRECIO,
    unidad: "USD",
  },
  {
    id: "VIX",
    label: "VIX",
    bloque: "riesgo",
    fuente: { tipo: "market_series", ticker: "VIX", metrica: "valor" },
    tipoVariacion: "pct",
    bandaEstable: BANDA_PRECIO,
    unidad: "idx",
  },

  // ── Commodities ──────────────────────────────────────────────────────────
  {
    id: "WTI",
    label: "Petróleo WTI",
    bloque: "commodities",
    fuente: { tipo: "yahoo", symbol: "CL=F" },
    tipoVariacion: "pct",
    bandaEstable: BANDA_PRECIO,
    unidad: "USD",
  },
  {
    id: "ORO",
    label: "Oro",
    bloque: "commodities",
    fuente: { tipo: "market_series", ticker: "ORO", metrica: "valor" },
    tipoVariacion: "pct",
    bandaEstable: BANDA_PRECIO,
    unidad: "USD",
  },
  {
    id: "COBRE",
    label: "Cobre",
    bloque: "commodities",
    fuente: { tipo: "yahoo", symbol: "HG=F" },
    tipoVariacion: "pct",
    bandaEstable: BANDA_PRECIO,
    unidad: "USD",
  },
  {
    id: "SOJA",
    label: "Soja",
    bloque: "commodities",
    // SOJA en market_series ya viene ajustada ×0,01 (centavos → USD/bushel), ver fuentes.ts
    fuente: { tipo: "market_series", ticker: "SOJA", metrica: "valor" },
    tipoVariacion: "pct",
    bandaEstable: BANDA_PRECIO,
    unidad: "USD",
  },
  {
    id: "MAIZ",
    label: "Maíz",
    bloque: "commodities",
    fuente: { tipo: "yahoo", symbol: "ZC=F", factor: 0.01 },
    tipoVariacion: "pct",
    bandaEstable: BANDA_PRECIO,
    unidad: "USD",
  },
  {
    id: "TRIGO",
    label: "Trigo",
    bloque: "commodities",
    fuente: { tipo: "yahoo", symbol: "ZW=F", factor: 0.01 },
    tipoVariacion: "pct",
    bandaEstable: BANDA_PRECIO,
    unidad: "USD",
  },

  // ── Argentina ────────────────────────────────────────────────────────────
  {
    id: "GGAL",
    label: "GGAL (ADR)",
    bloque: "argentina",
    fuente: { tipo: "yahoo", symbol: "GGAL" },
    tipoVariacion: "pct",
    bandaEstable: BANDA_PRECIO,
    unidad: "USD",
  },
  {
    id: "YPF",
    label: "YPF (ADR)",
    bloque: "argentina",
    fuente: { tipo: "yahoo", symbol: "YPF" },
    tipoVariacion: "pct",
    bandaEstable: BANDA_PRECIO,
    unidad: "USD",
  },
  {
    id: "VIST",
    label: "Vista Energy (ADR)",
    bloque: "argentina",
    fuente: { tipo: "yahoo", symbol: "VIST" },
    tipoVariacion: "pct",
    bandaEstable: BANDA_PRECIO,
    unidad: "USD",
  },
  {
    id: "GD30",
    label: "GD30D",
    bloque: "argentina",
    fuente: { tipo: "market_series", ticker: "GD30", metrica: "precio" },
    tipoVariacion: "pct",
    bandaEstable: BANDA_PRECIO,
    unidad: "USD",
  },
  {
    id: "AL30",
    label: "AL30D",
    bloque: "argentina",
    fuente: { tipo: "market_series", ticker: "AL30", metrica: "precio" },
    tipoVariacion: "pct",
    bandaEstable: BANDA_PRECIO,
    unidad: "USD",
  },
  {
    id: "MEP",
    label: "Dólar MEP",
    bloque: "argentina",
    fuente: { tipo: "market_series", ticker: "MEP", metrica: "precio" },
    tipoVariacion: "pct",
    bandaEstable: BANDA_PRECIO,
    unidad: "ARS",
  },
  {
    id: "CCL",
    label: "Dólar CCL",
    bloque: "argentina",
    fuente: { tipo: "market_series", ticker: "CCL", metrica: "precio" },
    tipoVariacion: "pct",
    bandaEstable: BANDA_PRECIO,
    unidad: "ARS",
  },
  {
    id: "CAUCION1",
    label: "Caución 1 día",
    bloque: "argentina",
    fuente: { tipo: "market_series", ticker: "CAUCION1", metrica: "tna" },
    tipoVariacion: "bps",
    bandaEstable: BANDA_CAUCION,
    unidad: "%",
  },
  {
    id: "RIESGO_PAIS",
    label: "Riesgo país",
    bloque: "argentina",
    fuente: { tipo: "market_series", ticker: "RIESGO_PAIS", metrica: "valor" },
    tipoVariacion: "pb_absoluto",
    bandaEstable: BANDA_RIESGO_PAIS,
    unidad: "pb",
  },
  {
    id: "OFICIAL_A3500",
    label: "Dólar oficial (A3500)",
    bloque: "argentina",
    fuente: { tipo: "market_series", ticker: "MAYORISTA", metrica: "precio" },
    tipoVariacion: "pct",
    bandaEstable: BANDA_PRECIO,
    unidad: "ARS",
  },
  {
    id: "RESERVAS",
    label: "Reservas BCRA",
    bloque: "argentina",
    fuente: { tipo: "market_series", ticker: "RESERVAS", metrica: "valor" },
    tipoVariacion: "pct",
    bandaEstable: BANDA_PRECIO,
    unidad: "musd",
  },
];

export function indicadorPorId(id: string): IndicadorConfig | undefined {
  return INDICADORES_BRIEF.find((i) => i.id === id);
}
