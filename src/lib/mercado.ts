/** Shared types & pure helpers for the Mercado module. */

export const INSTRUMENTO_TIPOS = [
  "soberano_usd",
  "lecap",
  "cer",
  "on",
  "cedear",
  "fx",
  "tasa",
  "macro",
] as const;
export type InstrumentoTipo = (typeof INSTRUMENTO_TIPOS)[number];

export type Moneda = "ARS" | "USD";
export type Ley = "AR" | "NY";

/** Unidad de display del valor. Define también cómo se expresa el delta:
 *  ARS/USD → variación porcentual · "%" → puntos porcentuales · "pb" → puntos básicos
 *  · "musd"/"mars" → millones de USD/ARS (delta absoluto: reservas, base monetaria)
 *  · "idx" → número índice sin moneda (Merval, UVA, DXY). */
export const UNIDADES = ["ARS", "USD", "%", "pb", "musd", "mars", "idx"] as const;
export type Unidad = (typeof UNIDADES)[number];

/**
 * Sección del panel. Separa explícitamente lo que se mide en pesos de lo que se
 * mide en dólares: una TNA en pesos (22%) al lado de un yield en USD (4,7%) se
 * lee como comparable cuando no lo es.
 */
export const GRUPOS = [
  "fx",
  "tasas_ars",
  "inflacion",
  "riesgo",
  "global",
  "commodities",
  "acciones",
  "soberanos",
  "pesos",
  "corp",
] as const;
export type Grupo = (typeof GRUPOS)[number];

export const GRUPO_LABEL: Record<Grupo, string> = {
  fx:          "Dólar",
  tasas_ars:   "Tasas en pesos",
  inflacion:   "Inflación",
  riesgo:      "Riesgo & reservas",
  global:      "Global",
  commodities: "Commodities",
  acciones:    "Acciones Argentina",
  soberanos:   "Soberanos hard-dollar",
  pesos:       "Curva en pesos",
  corp:        "ONs & CEDEARs",
};

/** Aclaración de moneda por sección — evita comparar tasas ARS con USD. */
export const GRUPO_NOTA: Partial<Record<Grupo, string>> = {
  tasas_ars:   "TNA en pesos",
  inflacion:   "en pesos",
  global:      "en dólares",
  commodities: "en dólares",
  soberanos:   "precio en USD",
};

export const GRUPO_HUE: Record<Grupo, number> = {
  fx:          150,
  tasas_ars:   230,
  inflacion:   300,
  riesgo:      30,
  global:      210,
  commodities: 90,
  acciones:    60,
  soberanos:   200,
  pesos:       260,
  corp:        320,
};

/** Grupo por defecto cuando el instrumento no lo declara (altas desde la UI). */
export function grupoFromTipo(tipo: InstrumentoTipo): Grupo {
  switch (tipo) {
    case "soberano_usd": return "soberanos";
    case "lecap":
    case "cer":          return "pesos";
    case "on":
    case "cedear":       return "corp";
    case "fx":           return "fx";
    case "tasa":         return "tasas_ars";
    case "macro":        return "riesgo";
  }
}

export interface MarketInstrument {
  id: number;
  ticker: string;
  nombre: string;
  tipo: InstrumentoTipo;
  moneda: Moneda;
  ley: Ley | null;
  unidad: Unidad;
  grupo: Grupo;
  activo: number;
  created_at: string;
}

export interface MarketSeriesPoint {
  fecha: string; // YYYY-MM-DD
  valor: number;
}

export const TIPO_LABEL: Record<InstrumentoTipo, string> = {
  soberano_usd: "Soberano USD",
  lecap:        "Lecap / Boncap",
  cer:          "CER",
  on:           "ON",
  cedear:       "CEDEAR",
  fx:           "Dólar",
  tasa:         "Tasa",
  macro:        "Macro",
};

export const TIPO_HUE: Record<InstrumentoTipo, number> = {
  soberano_usd: 200,
  lecap:        260,
  cer:          280,
  on:           320,
  cedear:       60,
  fx:           150,
  tasa:         230,
  macro:        30,
};

/** Métrica por defecto que el panel muestra y la carga manual escribe. */
export function defaultMetric(tipo: InstrumentoTipo): string {
  switch (tipo) {
    case "tasa":  return "tna";
    case "macro": return "valor";
    default:      return "precio";
  }
}

/** Tickers seedeados donde una baja es una mejora (colorear delta invertido). */
export const LOWER_IS_BETTER = new Set(["RIESGO_PAIS", "IPC", "BRECHA"]);

// ─── Deltas ─────────────────────────────────────────────────────────────────

export interface DeltaInfo {
  abs: number;          // last - ref, en la unidad del valor
  pct: number | null;   // variación %, null si ref = 0
  refFecha: string;
}

export interface PanelIndicator {
  last: MarketSeriesPoint | null;
  dPrev: DeltaInfo | null; // vs. dato anterior disponible
  d30: DeltaInfo | null;   // vs. último dato ≥ 30 días atrás
  d90: DeltaInfo | null;
}

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** series debe venir ordenada ascendente por fecha, un punto por fecha. */
export function computePanelIndicator(series: MarketSeriesPoint[]): PanelIndicator {
  if (series.length === 0) return { last: null, dPrev: null, d30: null, d90: null };

  const last = series[series.length - 1];

  const mkDelta = (ref: MarketSeriesPoint | null): DeltaInfo | null =>
    ref
      ? {
          abs: last.valor - ref.valor,
          pct: ref.valor !== 0 ? (last.valor / ref.valor - 1) * 100 : null,
          refFecha: ref.fecha,
        }
      : null;

  // último punto con fecha <= cutoff
  const refAtOrBefore = (cutoff: string): MarketSeriesPoint | null => {
    for (let i = series.length - 1; i >= 0; i--) {
      if (series[i].fecha <= cutoff) return series[i];
    }
    return null;
  };

  const prev = series.length > 1 ? series[series.length - 2] : null;

  return {
    last,
    dPrev: mkDelta(prev),
    d30: mkDelta(refAtOrBefore(addDaysStr(last.fecha, -30))),
    d90: mkDelta(refAtOrBefore(addDaysStr(last.fecha, -90))),
  };
}

// ─── Formato ────────────────────────────────────────────────────────────────

export function formatValor(v: number, unidad: Unidad): string {
  switch (unidad) {
    case "ARS":
      return `$${v.toLocaleString("es-AR", { maximumFractionDigits: v >= 100 ? 0 : 2 })}`;
    case "USD":
      return `US$${v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case "pb":
      return `${v.toLocaleString("es-AR", { maximumFractionDigits: 0 })} pb`;
    case "%":
      return `${v.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`;
    case "musd":
      return `US$${v.toLocaleString("es-AR", { maximumFractionDigits: 0 })} M`;
    case "mars":
      // El BCRA publica en millones; arriba del billón se lee mejor abreviado
      return v >= 1_000_000
        ? `$${(v / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} bill.`
        : `$${v.toLocaleString("es-AR", { maximumFractionDigits: 0 })} M`;
    case "idx":
      return v.toLocaleString("es-AR", { maximumFractionDigits: v >= 1000 ? 0 : 2 });
  }
}

/** Delta como texto: % de variación para precios, pp/pb absolutos para tasas e índices. */
export function formatDelta(delta: DeltaInfo, unidad: Unidad): string {
  if (unidad === "%") {
    return `${Math.abs(delta.abs).toLocaleString("es-AR", { maximumFractionDigits: 2 })} pp`;
  }
  if (unidad === "pb") {
    return `${Math.abs(delta.abs).toLocaleString("es-AR", { maximumFractionDigits: 0 })} pb`;
  }
  if (unidad === "musd") {
    return `US$${Math.abs(delta.abs).toLocaleString("es-AR", { maximumFractionDigits: 0 })} M`;
  }
  if (delta.pct === null) return "—";
  // mars e idx crecen mucho en nivel: el % dice más que el absoluto
  return `${Math.abs(delta.pct).toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`;
}

// ─── Vistas del panel ───────────────────────────────────────────────────────

/**
 * Qué secciones muestra cada página.
 *
 * Los indicadores macro van como tiles con sparkline; los instrumentos de renta
 * fija como tabla, porque lo que se compara entre bonos es fila contra fila.
 * Están en páginas distintas: mirar cómo viene el dólar y elegir entre un GD30
 * y un AL30 son dos momentos distintos del día.
 */
export const VISTA_MERCADO = {
  // Sin fx ni riesgo: esos dos suben al hero de la página con la cifra en
  // grande, y repetirlos abajo como un tile más los volvería a aplanar
  tiles: ["tasas_ars", "inflacion", "global", "commodities", "acciones"] as Grupo[],
  tablas: [] as Grupo[],
  tablasPlegadas: false,
};

export const VISTA_RENTA_FIJA = {
  tiles: [] as Grupo[],
  tablas: ["soberanos", "pesos", "corp"] as Grupo[],
  // La curva ya muestra estos bonos: la tabla queda plegada para el detalle
  tablasPlegadas: true,
};
