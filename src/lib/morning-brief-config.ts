/**
 * Morning Brief — qué se mira, en qué orden.
 *
 * El orden no es decorativo: es el de la rutina. Primero qué pasó mientras
 * dormías, después la tasa que fija el tono del día, después si el mercado le
 * cree a esa tasa, después los commodities, y recién al final Argentina, que
 * es la traducción de todo lo anterior. Leer Argentina primero es leer el
 * final de la película.
 *
 * Buena parte de estos indicadores ya los baja y persiste `@/lib/fuentes` en
 * `market_series` (UST10Y, DXY, VIX, ORO, SOJA, MEP, CCL, riesgo país,
 * reservas, compras del BCRA, caución, GD30/AL30): para esos se lee la
 * columna, no se vuelve a pegar a la fuente. Sólo son fetch nuevos los
 * símbolos que ningún otro módulo trae.
 */

import type { Unidad } from "@/lib/mercado";

export type BloqueBrief = "nocturno" | "tasas_dolar" | "riesgo" | "commodities" | "argentina";

export const BLOQUE_LABEL: Record<BloqueBrief, string> = {
  nocturno: "Mientras dormías",
  tasas_dolar: "Tasas y dólar global",
  riesgo: "Termómetro de riesgo",
  commodities: "Commodities",
  argentina: "Argentina",
};

/** Qué contesta cada bloque. Va como bajada del card. */
export const BLOQUE_NOTA: Record<BloqueBrief, string> = {
  nocturno: "cierre de Asia y Europa abierta · ¿hubo un shock?",
  tasas_dolar: "define el tono: si el dinero se encarece, baja el apetito por riesgo",
  riesgo: "¿los futuros y el VIX confirman lo que dicen las tasas?",
  commodities: "inflación, energía y los dólares del agro",
  argentina: "lo global traducido a lo local",
};

export type TipoVariacion =
  /** Variación porcentual: precios, índices. */
  | "pct"
  /** Puntos básicos, para tasas cotizadas en puntos porcentuales. */
  | "bps"
  /** Diferencia directa sobre una serie que ya viene en puntos básicos. */
  | "pb_absoluto"
  /** Diferencia directa en puntos porcentuales: la brecha se lee así, no en
   *  porcentaje del porcentaje (pasar de 5% a 6% es +1 pp, no +20%). */
  | "pp";

export type FuenteIndicador =
  | { tipo: "yahoo"; symbol: string; factor?: number }
  | { tipo: "fred"; serie: string }
  | { tipo: "market_series"; ticker: string; metrica: string }
  /** Calculado sobre otros dos indicadores de esta misma lista. */
  | { tipo: "derivado"; de: [string, string]; fn: (a: number, b: number) => number };

export interface IndicadorConfig {
  id: string;
  label: string;
  bloque: BloqueBrief;
  fuente: FuenteIndicador;
  tipoVariacion: TipoVariacion;
  /** Unidad de display del valor — reutiliza `formatValor` de mercado.ts. */
  unidad: Unidad;
  /** Sub-agrupación dentro del bloque (Asia/Europa, bonos, dólar…). */
  grupo?: string;
  /** Una línea de qué mirar en este número. Va en el tooltip. */
  nota?: string;
  /**
   * No calcular variación. Es para los flujos: las compras del BCRA de un día
   * contra las del anterior no son una variación, son dos días distintos —
   * pasar de 6 a 11 millones no es "+83%", y leerlo así confunde.
   */
  sinVariacion?: boolean;
}

export const INDICADORES_BRIEF: IndicadorConfig[] = [
  // ── 1. Mientras dormías ──────────────────────────────────────────────────
  { id: "NIKKEI", label: "Nikkei 225", bloque: "nocturno", grupo: "Asia (cerró)",
    fuente: { tipo: "yahoo", symbol: "^N225" }, tipoVariacion: "pct", unidad: "idx" },
  { id: "HANGSENG", label: "Hang Seng", bloque: "nocturno", grupo: "Asia (cerró)",
    fuente: { tipo: "yahoo", symbol: "^HSI" }, tipoVariacion: "pct", unidad: "idx" },
  { id: "SHANGHAI", label: "Shanghai", bloque: "nocturno", grupo: "Asia (cerró)",
    fuente: { tipo: "yahoo", symbol: "000001.SS" }, tipoVariacion: "pct", unidad: "idx" },
  { id: "EUROSTOXX50", label: "Euro Stoxx 50", bloque: "nocturno", grupo: "Europa (abierta)",
    fuente: { tipo: "yahoo", symbol: "^STOXX50E" }, tipoVariacion: "pct", unidad: "idx" },
  { id: "DAX", label: "DAX", bloque: "nocturno", grupo: "Europa (abierta)",
    fuente: { tipo: "yahoo", symbol: "^GDAXI" }, tipoVariacion: "pct", unidad: "idx" },
  { id: "FTSE", label: "FTSE 100", bloque: "nocturno", grupo: "Europa (abierta)",
    fuente: { tipo: "yahoo", symbol: "^FTSE" }, tipoVariacion: "pct", unidad: "idx" },

  // ── 2. Tasas y dólar global ──────────────────────────────────────────────
  { id: "TREASURY2Y", label: "Treasury 2 años", bloque: "tasas_dolar",
    fuente: { tipo: "fred", serie: "DGS2" }, tipoVariacion: "bps", unidad: "%",
    nota: "la expectativa de Fed: se mueve con lo que el mercado cree que va a hacer la tasa. FRED publica con una rueda de rezago." },
  { id: "TREASURY10Y", label: "Treasury 10 años", bloque: "tasas_dolar",
    // ^TNX ya viene en % (verificado jul-2026, ver fuentes.ts)
    fuente: { tipo: "market_series", ticker: "UST10Y", metrica: "valor" },
    tipoVariacion: "bps", unidad: "%",
    nota: "la tasa contra la que rinde todo lo demás: un Global paga esto más el riesgo país." },
  { id: "CURVA_2S10S", label: "Pendiente 2s10s", bloque: "tasas_dolar",
    fuente: { tipo: "derivado", de: ["TREASURY10Y", "TREASURY2Y"], fn: (diez, dos) => (diez - dos) * 100 },
    tipoVariacion: "pb_absoluto", unidad: "pb",
    nota: "10 años menos 2 años. Negativa = curva invertida, el mercado descuenta recortes." },
  { id: "DXY", label: "Índice dólar (DXY)", bloque: "tasas_dolar",
    fuente: { tipo: "market_series", ticker: "DXY", metrica: "valor" },
    tipoVariacion: "pct", unidad: "idx",
    nota: "el dólar contra las monedas duras. Sube = se aprieta la liquidez global y sufren los emergentes." },

  // ── 3. Termómetro de riesgo ──────────────────────────────────────────────
  { id: "SP500_FUT", label: "Futuro S&P 500", bloque: "riesgo",
    fuente: { tipo: "yahoo", symbol: "ES=F" }, tipoVariacion: "pct", unidad: "USD",
    nota: "cómo viene la apertura de Wall Street antes de que abra." },
  { id: "NASDAQ_FUT", label: "Futuro Nasdaq", bloque: "riesgo",
    fuente: { tipo: "yahoo", symbol: "NQ=F" }, tipoVariacion: "pct", unidad: "USD" },
  { id: "VIX", label: "VIX", bloque: "riesgo",
    fuente: { tipo: "market_series", ticker: "VIX", metrica: "valor" },
    tipoVariacion: "pct", unidad: "idx",
    nota: "arriba de 20 el mercado está nervioso; arriba de 30, asustado." },

  // ── 4. Commodities ───────────────────────────────────────────────────────
  { id: "WTI", label: "Petróleo WTI", bloque: "commodities", grupo: "Energía y metales",
    fuente: { tipo: "yahoo", symbol: "CL=F" }, tipoVariacion: "pct", unidad: "USD",
    nota: "inflación y, acá, Vaca Muerta." },
  { id: "ORO", label: "Oro", bloque: "commodities", grupo: "Energía y metales",
    fuente: { tipo: "market_series", ticker: "ORO", metrica: "valor" },
    tipoVariacion: "pct", unidad: "USD", nota: "el refugio: sube cuando algo da miedo." },
  { id: "COBRE", label: "Cobre", bloque: "commodities", grupo: "Energía y metales",
    fuente: { tipo: "yahoo", symbol: "HG=F" }, tipoVariacion: "pct", unidad: "USD",
    nota: "el termómetro de la actividad industrial china." },
  { id: "SOJA", label: "Soja", bloque: "commodities", grupo: "Granos (Chicago)",
    // SOJA en market_series ya viene ajustada ×0,01 (centavos → USD/bushel)
    fuente: { tipo: "market_series", ticker: "SOJA", metrica: "valor" },
    tipoVariacion: "pct", unidad: "USD", nota: "los dólares del agro, y el ingreso de buena parte de la cartera." },
  { id: "MAIZ", label: "Maíz", bloque: "commodities", grupo: "Granos (Chicago)",
    fuente: { tipo: "yahoo", symbol: "ZC=F", factor: 0.01 }, tipoVariacion: "pct", unidad: "USD" },
  { id: "TRIGO", label: "Trigo", bloque: "commodities", grupo: "Granos (Chicago)",
    fuente: { tipo: "yahoo", symbol: "ZW=F", factor: 0.01 }, tipoVariacion: "pct", unidad: "USD" },

  // ── 6. Argentina ─────────────────────────────────────────────────────────
  { id: "GD30", label: "GD30D", bloque: "argentina", grupo: "Deuda",
    fuente: { tipo: "market_series", ticker: "GD30", metrica: "precio" },
    tipoVariacion: "pct", unidad: "USD" },
  { id: "AL30", label: "AL30D", bloque: "argentina", grupo: "Deuda",
    fuente: { tipo: "market_series", ticker: "AL30", metrica: "precio" },
    tipoVariacion: "pct", unidad: "USD" },
  { id: "GD35", label: "GD35D", bloque: "argentina", grupo: "Deuda",
    fuente: { tipo: "market_series", ticker: "GD35", metrica: "precio" },
    tipoVariacion: "pct", unidad: "USD" },
  { id: "RIESGO_PAIS", label: "Riesgo país", bloque: "argentina", grupo: "Deuda",
    fuente: { tipo: "market_series", ticker: "RIESGO_PAIS", metrica: "valor" },
    tipoVariacion: "pb_absoluto", unidad: "pb" },

  { id: "OFICIAL_A3500", label: "Oficial (A3500)", bloque: "argentina", grupo: "Dólar",
    fuente: { tipo: "market_series", ticker: "MAYORISTA", metrica: "precio" },
    tipoVariacion: "pct", unidad: "ARS" },
  { id: "MEP", label: "MEP", bloque: "argentina", grupo: "Dólar",
    fuente: { tipo: "market_series", ticker: "MEP", metrica: "precio" },
    tipoVariacion: "pct", unidad: "ARS" },
  { id: "CCL", label: "CCL", bloque: "argentina", grupo: "Dólar",
    fuente: { tipo: "market_series", ticker: "CCL", metrica: "precio" },
    tipoVariacion: "pct", unidad: "ARS" },
  { id: "BRECHA", label: "Brecha", bloque: "argentina", grupo: "Dólar",
    fuente: { tipo: "derivado", de: ["CCL", "OFICIAL_A3500"], fn: (ccl, of) => (ccl / of - 1) * 100 },
    tipoVariacion: "pp", unidad: "%",
    nota: "CCL contra el mayorista A3500, que es como se mide la brecha. Contra el minorista da más chica." },

  { id: "RESERVAS", label: "Reservas", bloque: "argentina", grupo: "BCRA y tasas",
    fuente: { tipo: "market_series", ticker: "RESERVAS", metrica: "valor" },
    tipoVariacion: "pct", unidad: "musd" },
  { id: "COMPRAS_BCRA", label: "Compras del BCRA", bloque: "argentina", grupo: "BCRA y tasas",
    fuente: { tipo: "market_series", ticker: "COMPRAS_BCRA", metrica: "valor" },
    tipoVariacion: "pct", unidad: "musd", sinVariacion: true,
    nota: "lo que compró (o vendió) el BCRA ese día: el flujo que explica el stock de reservas. Publica con unos días de rezago." },
  { id: "CAUCION1", label: "Caución 1 día", bloque: "argentina", grupo: "BCRA y tasas",
    fuente: { tipo: "market_series", ticker: "CAUCION1", metrica: "tna" },
    tipoVariacion: "bps", unidad: "%", nota: "la tasa más corta en pesos: dónde está la liquidez hoy." },
  { id: "TAMAR", label: "TAMAR", bloque: "argentina", grupo: "BCRA y tasas",
    fuente: { tipo: "market_series", ticker: "TAMAR", metrica: "tna" },
    tipoVariacion: "bps", unidad: "%" },
];

/** Los ADRs que se miran en el premarket. Un solo request de quotes para todos. */
export const ADRS_BRIEF: { symbol: string; nombre: string }[] = [
  { symbol: "GGAL", nombre: "Galicia" },
  { symbol: "BMA", nombre: "Macro" },
  { symbol: "SUPV", nombre: "Supervielle" },
  { symbol: "YPF", nombre: "YPF" },
  { symbol: "VIST", nombre: "Vista" },
  { symbol: "PAM", nombre: "Pampa" },
  { symbol: "TGS", nombre: "TGS" },
  { symbol: "CRESY", nombre: "Cresud" },
];

export function indicadorPorId(id: string): IndicadorConfig | undefined {
  return INDICADORES_BRIEF.find((i) => i.id === id);
}
