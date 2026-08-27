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
  /** Estado del mercado según Yahoo: PRE, REGULAR, POST, CLOSED… */
  estadoMercado: string | null;
  /** Variación en la sesión extendida (pre o after-hours) vs. el último cierre regular, en %. */
  premercado: number | null;
  /** Precio en la sesión extendida. */
  premercadoPrecio: number | null;
  /** Si el dato extendido es de pre-apertura (`pre`) o after-hours (`post`). */
  premercadoTipo: "pre" | "post" | null;
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
  bolsa: "NYSE" | "NASDAQ" | "OTRA";
  /** Integra el S&P 500. */
  sp500: boolean;
  /** ADR argentino — lo que le preguntan los clientes. */
  argentino: boolean;
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

// ─── Lectura de fundamentals ────────────────────────────────────────────────

export type Sentido = "alto_mejor" | "alto_caro" | "alto_apalancado";

export interface MetricaComparada {
  clave: string;
  label: string;
  valor: number | null;
  mediana: number | null;
  formato: "pct" | "num" | "cap" | "usd";
  sentido: Sentido;
  ayuda?: string;
}

export type Tono = "bueno" | "malo" | "neutro";

export interface Lectura {
  texto: string;
  tono: Tono;
  /** Desvío contra la mediana, en %. Para dibujar la barra. */
  desvio: number;
}

/**
 * Traduce "32,9 contra una mediana de 35,5" a algo que se lee de un vistazo.
 *
 * La valuación sale en tono neutro a propósito: que una acción esté cara no
 * es malo por sí solo (puede estar cara porque crece), y que esté barata puede
 * ser una trampa de valor. Rentabilidad y crecimiento sí llevan color, porque
 * ahí más es inequívocamente mejor.
 */
export function leerMetrica(m: MetricaComparada): Lectura | null {
  const { valor, mediana, sentido } = m;
  if (valor == null || mediana == null) return null;
  // Un múltiplo de valuación negativo NO es "más barato": significa que la
  // empresa pierde plata y el ratio deja de tener sentido. Decir "mejor que sus
  // pares" ante un PER forward de -4.782 es exactamente al revés.
  if (sentido === "alto_caro" && valor < 0) {
    return { texto: "sin ganancias: el múltiplo no aplica", tono: "malo", desvio: 0 };
  }

  // Con un negativo de por medio el cociente pierde sentido, así que se compara
  // la dirección y no la magnitud.
  if (mediana === 0 || valor < 0 || mediana < 0) {
    const mejor = sentido === "alto_mejor" ? valor > mediana : valor < mediana;
    return {
      texto: mejor ? "mejor que sus pares" : "peor que sus pares",
      tono: sentido === "alto_caro" ? "neutro" : mejor ? "bueno" : "malo",
      desvio: 0,
    };
  }

  const desvio = (valor / mediana - 1) * 100;
  const magnitud = Math.abs(desvio);
  if (magnitud < 10) return { texto: "en línea con sus pares", tono: "neutro", desvio };

  const mucho = magnitud >= 40 ? "mucho " : "";
  const arriba = desvio > 0;

  if (sentido === "alto_caro") {
    return { texto: `${mucho}más ${arriba ? "caro" : "barato"}`, tono: "neutro", desvio };
  }
  if (sentido === "alto_apalancado") {
    return {
      texto: `${mucho}${arriba ? "más" : "menos"} endeudado`,
      tono: arriba ? "malo" : "bueno",
      desvio,
    };
  }
  return {
    texto: `${mucho}${arriba ? "por encima" : "por debajo"}`,
    tono: arriba ? "bueno" : "malo",
    desvio,
  };
}

export const TONO_COLOR: Record<Tono, string> = {
  bueno: "text-emerald-400",
  malo: "text-rose-400",
  neutro: "text-slate-500",
};

/** Formatea el valor de una métrica según su tipo. */
export function fmtMetrica(v: number | null, formato: MetricaComparada["formato"]): string {
  switch (formato) {
    case "pct": return fmtNivel(v);
    case "cap": return fmtCap(v);
    case "usd": return fmtUsd(v);
    case "num": return fmtNumero(v);
  }
}

/** Nombre legible de la acción de un analista. */
export const ACCION_LABEL: Record<string, string> = {
  init: "inicia cobertura",
  main: "mantiene",
  reit: "reitera",
  up: "sube",
  down: "baja",
};

/** Cuenta de recomendaciones → texto y color del consenso. */
export function resumirTendencia(t: {
  compraFuerte: number; compra: number; mantener: number; venta: number; ventaFuerte: number;
}): { compras: number; neutros: number; ventas: number; total: number } {
  const compras = t.compraFuerte + t.compra;
  const ventas = t.venta + t.ventaFuerte;
  return { compras, neutros: t.mantener, ventas, total: compras + t.mantener + ventas };
}

// ─── Familias de ETF ────────────────────────────────────────────────────────

export const FAMILIAS_ETF = [
  "amplios", "sectoriales", "paises", "internacionales",
  "renta_fija", "materias_primas", "estrategias", "tematicos",
] as const;
export type FamiliaETF = (typeof FAMILIAS_ETF)[number];

export const FAMILIA_LABEL: Record<FamiliaETF, string> = {
  amplios: "Índices amplios",
  sectoriales: "Sectoriales de EE.UU.",
  paises: "Países",
  internacionales: "Regiones",
  renta_fija: "Renta fija",
  materias_primas: "Materias primas",
  estrategias: "Estrategias y factores",
  tematicos: "Temáticos",
};

export const FAMILIA_NOTA: Record<FamiliaETF, string> = {
  amplios: "El mercado estadounidense entero, con distintos cortes",
  sectoriales: "Los once sectores del S&P por separado",
  paises: "Un solo mercado por fondo — Argentina incluida",
  internacionales: "Canastas de varios países en un solo papel",
  renta_fija: "Bonos: no son acciones, sirven de contrapeso",
  materias_primas: "Oro, plata y petróleo",
  estrategias: "El mismo mercado, filtrado por otro criterio",
  tematicos: "Apuestas concentradas en una industria",
};
