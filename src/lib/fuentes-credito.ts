/**
 * De dónde sale cada número: el crédito al pie de cada gráfico.
 *
 * Un panel de precios sin la fuente al lado obliga a confiar de memoria. Peor:
 * dos series del mismo indicador pueden no coincidir —el riesgo país
 * intradiario de rava y el cierre de argentinadatos difieren durante la rueda—
 * y sin decir cuál se está mirando, la diferencia parece un error.
 *
 * Este módulo es **puro y liviano a propósito**: lo importan componentes de
 * cliente. `fuentes.ts` sabe qué fuente cubre qué ticker pero arrastra
 * yahoo-finance2 y no puede viajar al navegador, así que el crédito se declara
 * acá. La contrapartida es que hay que mantener las dos en línea; el test de
 * cordura es que todo ticker con fuente automática tenga crédito.
 */

export interface Credito {
  /** Cómo se nombra la fuente en pantalla. */
  fuente: string;
  /** A dónde ir a verificar. Opcional: FRED y BYMA no tienen página por serie. */
  url?: string;
  /** La letra chica que cambia cómo se lee el número. */
  nota?: string;
}

/**
 * Las fuentes del proyecto, para los gráficos que no salen de un ticker del
 * panel: la curva del Tesoro, el sendero de la Fed, la composición de un ETF.
 */
export const CREDITOS = {
  dolarapi: { fuente: "dolarapi.com", url: "https://dolarapi.com" },
  bcra: {
    fuente: "BCRA",
    url: "https://www.bcra.gob.ar/PublicacionesEstadisticas/Principales_variables.asp",
  },
  argentinadatos: { fuente: "argentinadatos", url: "https://argentinadatos.com" },
  rava: { fuente: "Rava Bursátil", url: "https://www.rava.com" },
  yahoo: { fuente: "Yahoo Finance", url: "https://finance.yahoo.com" },
  fred: { fuente: "FRED — Reserva Federal de St. Louis", url: "https://fred.stlouisfed.org" },
  data912: { fuente: "data912", url: "https://data912.com" },
  byma: { fuente: "BYMA open data", url: "https://open.bymadata.com.ar" },
  finviz: { fuente: "Finviz", url: "https://finviz.com" },
  indec: { fuente: "INDEC", url: "https://www.indec.gob.ar" },
} as const satisfies Record<string, Credito>;

const DOLARAPI: Credito = { fuente: "dolarapi.com", url: "https://dolarapi.com" };
const BCRA: Credito = {
  fuente: "BCRA",
  url: "https://www.bcra.gob.ar/PublicacionesEstadisticas/Principales_variables.asp",
};
const AD: Credito = { fuente: "argentinadatos", url: "https://argentinadatos.com" };
const YAHOO: Credito = { fuente: "Yahoo Finance", url: "https://finance.yahoo.com" };
const FRED: Credito = { fuente: "FRED — Reserva Federal de St. Louis", url: "https://fred.stlouisfed.org" };
const DATA912: Credito = { fuente: "data912", url: "https://data912.com" };

const POR_TICKER: Record<string, Credito> = {
  // Dólares
  OFICIAL: DOLARAPI,
  BLUE: DOLARAPI,
  MEP: DOLARAPI,
  CCL: DOLARAPI,
  MAYORISTA: { ...BCRA, nota: "Comunicación A 3500, tipo de cambio mayorista" },
  BRECHA: {
    fuente: "calculada sobre dolarapi.com",
    nota: "No es una serie publicada: es el CCL contra el oficial, punto a punto.",
  },

  // Riesgo país: dos fuentes, y la distinción importa durante la rueda
  RIESGO_PAIS: {
    fuente: "Rava Bursátil (intradiario) y argentinadatos (cierre)",
    url: "https://www.rava.com/perfil/RIESGO%20PAIS",
    nota: "El punto de hoy se actualiza durante la rueda con el valor de rava; cuando cierra, lo reemplaza el cierre de argentinadatos, que es el que queda en el histórico.",
  },

  // Monetario y tasas
  RESERVAS: { ...BCRA, nota: "Reservas internacionales brutas" },
  BASE_MON: BCRA,
  TAMAR: BCRA,
  BADLAR: BCRA,
  PLAZOFIJO: { ...AD, nota: "Mediana de las TNA a clientes que publican los bancos" },
  CAUCION1: {
    fuente: "BYMA open data",
    url: "https://open.bymadata.com.ar",
    nota: "Caución a 1 día en pesos, precio de cierre de la rueda.",
  },

  // Precios e índices argentinos
  IPC: { ...AD, nota: "Publica INDEC; la serie llega vía argentinadatos." },
  IPC_IA: { ...AD, nota: "Publica INDEC; la serie llega vía argentinadatos." },
  UVA: AD,
  MERVAL: YAHOO,
  MERVAL_USD: { fuente: "calculada sobre Yahoo Finance y dolarapi.com", nota: "Merval dividido por el CCL." },

  // Mundo
  SPX: YAHOO,
  UST10Y: YAHOO,
  DXY: YAHOO,
  BRL: YAHOO,
  PETROLEO: { ...YAHOO, nota: "Futuro del Brent (BZ=F)" },
  SOJA: { ...YAHOO, nota: "Futuro de Chicago (ZS=F), pasado a dólares por tonelada" },
  ORO: { ...YAHOO, nota: "Futuro del oro (GC=F)" },
  VIX: FRED,
  FED_FUNDS: { ...FRED, nota: "Techo del rango objetivo de la Fed (DFEDTARU)" },
  CPI_USA: FRED,
};

/** Instrumentos que no están por ticker sino por tipo: los que baja data912. */
const POR_TIPO: Record<string, Credito> = {
  soberano_usd: DATA912,
  lecap: DATA912,
  cer: DATA912,
  on: DATA912,
  cedear: DATA912,
};

/**
 * El crédito de un instrumento. `null` cuando no lo cubre ninguna fuente
 * automática: ahí el dato lo cargó alguien a mano y decir "fuente: manual" es
 * más honesto que no decir nada, así que el llamador lo resuelve.
 */
export function creditoDe(ticker: string, tipo?: string): Credito | null {
  return POR_TICKER[ticker] ?? (tipo ? POR_TIPO[tipo] ?? null : null);
}

/**
 * El crédito de un conjunto de series, sin repetir.
 *
 * Un gráfico con los cinco dólares tiene una sola fuente; uno que mezcla el
 * mayorista del BCRA con el CCL de dolarapi tiene dos, y las dos hay que
 * decirlas.
 */
export function creditosDe(tickers: string[]): Credito[] {
  const vistos = new Set<string>();
  const out: Credito[] = [];
  for (const t of tickers) {
    const c = creditoDe(t);
    if (!c || vistos.has(c.fuente)) continue;
    vistos.add(c.fuente);
    out.push(c);
  }
  return out;
}

/** "dolarapi.com y BCRA" — para meter en una línea de texto. */
export function textoFuentes(creditos: Credito[]): string {
  const nombres = creditos.map((c) => c.fuente);
  if (nombres.length === 0) return "carga manual";
  if (nombres.length === 1) return nombres[0];
  return `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
}
