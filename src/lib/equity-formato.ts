/**
 * Tipos, constantes y formato del monitor de equity.
 *
 * Está separado de `equity.ts` a propósito: acá no se importa nada. `equity.ts`
 * arrastra `yahoo-finance2` (que trae shims de Deno y sólo corre en el server),
 * así que los Client Components tienen que importar de este archivo.
 */
import type { Sector } from "@/lib/equity-sectores";

// ─── Tipos ──────────────────────────────────────────────────────────────────

/** Fila del tablero: lo que sale del `quote` en lote. */
export interface FilaTablero {
  ticker: string;
  nombre: string;
  sector: Sector;
  precio: number;
  /** Variación de la rueda, en %. */
  dia: number | null;
  /** Retorno de los últimos 12 meses, en %. */
  año: number | null;
  /** Precio contra su media móvil de 50 ruedas, en %. NO es un retorno. */
  vsMedia50: number | null;
  /** Precio contra su media móvil de 200 ruedas, en %. NO es un retorno. */
  vsMedia200: number | null;
  /** Cuánto está por debajo de su máximo de 52 semanas, en % (siempre ≤ 0). */
  desdeMaximo: number | null;
  capitalizacion: number | null;
  per: number | null;
  proximoEarnings: string | null;
  earningsEstimado: boolean;
}

/** Retornos exactos calculados sobre la serie diaria. Todos en %. */
export interface Retornos {
  semana: number | null;
  mes: number | null;
  tres: number | null;
  seis: number | null;
  ytd: number | null;
  doce: number | null;
}

export interface FilaConRetornos extends FilaTablero {
  retornos: Retornos;
  /** Cierres de los últimos 6 meses, para el sparkline. */
  chispa: number[];
}

/** Los períodos que se pueden ordenar en el ranking. */
export const PERIODOS = ["dia", "semana", "mes", "tres", "seis", "ytd", "doce"] as const;
export type Periodo = (typeof PERIODOS)[number];

export const PERIODO_LABEL: Record<Periodo, string> = {
  dia: "Hoy",
  semana: "1 semana",
  mes: "1 mes",
  tres: "3 meses",
  seis: "6 meses",
  ytd: "En el año",
  doce: "12 meses",
};

/** Traducción de la recomendación de consenso de Yahoo. */
export const RECOMENDACION_LABEL: Record<string, string> = {
  strong_buy: "Compra fuerte",
  buy: "Compra",
  hold: "Mantener",
  underperform: "Por debajo del mercado",
  sell: "Venta",
};

// ─── Formato ────────────────────────────────────────────────────────────────

/** Variación porcentual con signo, formato argentino: `+12,4%`. */
export function fmtPct(v: number | null, decimales = 1): string {
  if (v == null) return "—";
  const signo = v > 0 ? "+" : "";
  return `${signo}${v.toLocaleString("es-AR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })}%`;
}

/** Porcentaje que es un nivel y no una variación (margen, ROE, dividendo): sin signo. */
export function fmtNivel(v: number | null, decimales = 1): string {
  if (v == null) return "—";
  return `${v.toLocaleString("es-AR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })}%`;
}

export function fmtUsd(v: number | null, decimales = 2): string {
  if (v == null) return "—";
  return `US$${v.toLocaleString("es-AR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })}`;
}

/**
 * Montos grandes en escala castellana: billón = 10^12 (no el "billion" inglés).
 * Los miles de millones van como "mil M" y no "MM", que se lee como millones.
 */
export function fmtCap(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e12) return `US$${(v / 1e12).toLocaleString("es-AR", { maximumFractionDigits: 2 })} bill.`;
  if (v >= 1e9) return `US$${(v / 1e9).toLocaleString("es-AR", { maximumFractionDigits: 1 })} mil M`;
  return `US$${(v / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 0 })} M`;
}

export function fmtNumero(v: number | null, decimales = 1): string {
  if (v == null) return "—";
  return v.toLocaleString("es-AR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

/** Fecha corta en castellano: `26 ago`. */
export function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-").map(Number);
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const hoy = new Date();
  const mismoAño = a === hoy.getFullYear();
  return `${d} ${meses[m - 1]}${mismoAño ? "" : ` ${a}`}`;
}

/** Verde sube, rojo baja. En equity no hay lógica invertida como en riesgo país. */
export function colorRetorno(v: number | null): string {
  if (v == null) return "text-slate-600";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-slate-400";
}
