/**
 * Monitor de equity — datos de Yahoo Finance para el S&P 500.
 *
 * El módulo tiene dos etapas deliberadamente separadas por costo:
 *
 *   1. `getTablero()` — un `quote` en lote trae los 503 tickers en 3 requests.
 *      De acá salen el ranking y las métricas baratas.
 *   2. `getRetornos()` — un `chart` por ticker (1 request cada uno) para los
 *      retornos exactos y el sparkline. Sólo se pide para los candidatos que
 *      quedaron arriba en la etapa 1.
 *
 * Nada de esto toca la DB: en Vercel es efímera y estos datos se rebajan solos.
 * El caché es en memoria del proceso, con TTL — la instancia serverless que
 * sigue caliente reusa, la que arranca en frío vuelve a pedir.
 */
import YahooFinance from "yahoo-finance2";
import { UNIVERSO_SP500, POR_TICKER } from "@/lib/equity-universo";
import type { Sector } from "@/lib/equity-sectores";
import type { FilaTablero, FilaConRetornos, Retornos } from "@/lib/equity-formato";

// Los tipos y el formato viven en `equity-formato` para que los Client
// Components los usen sin arrastrar `yahoo-finance2` al bundle del navegador.
export type * from "@/lib/equity-formato";

const yf = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
  // Yahoo agrega campos nuevos seguido y la librería valida contra un esquema
  // fijo: sin esto un campo de más tira toda la respuesta a la basura.
  validation: { logErrors: false, logOptionsErrors: false },
});

const LOTE_QUOTE = 200;
const CONCURRENCIA_CHART = 12;

// ─── Caché en memoria ───────────────────────────────────────────────────────

interface Entrada<T> {
  valor: T;
  vence: number;
}

declare global {
  var __equityCache: Map<string, Entrada<unknown>> | undefined;
}

const cache = (globalThis.__equityCache ??= new Map<string, Entrada<unknown>>());

/**
 * Memoiza una promesa por `ttlSegundos`. Guarda la promesa y no el resultado:
 * si entran dos requests juntos al abrir el dashboard, Yahoo recibe uno solo.
 */
async function memo<T>(clave: string, ttlSegundos: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(clave);
  if (hit && hit.vence > Date.now()) return hit.valor as T;

  const promesa = fn();
  cache.set(clave, { valor: promesa, vence: Date.now() + ttlSegundos * 1000 });
  try {
    return await promesa;
  } catch (e) {
    cache.delete(clave); // un error no se cachea: el próximo request reintenta
    throw e;
  }
}

/** Vacía el caché — lo usa el botón de refresh. */
export function invalidarCache() {
  cache.clear();
}

// ─── Utilidades ─────────────────────────────────────────────────────────────

async function conLimite<T, R>(
  items: T[],
  limite: number,
  fn: (item: T) => Promise<R>
): Promise<(R | null)[]> {
  const out: (R | null)[] = new Array(items.length).fill(null);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limite, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor++;
        try {
          out[i] = await fn(items[i]);
        } catch {
          out[i] = null; // un ticker que falla no puede voltear la página entera
        }
      }
    })
  );
  return out;
}

/** Yahoo mezcla unidades: algunos campos vienen en % y otros en fracción. */
const aPorcentaje = (fraccion: number | undefined | null): number | null =>
  fraccion == null ? null : fraccion * 100;

const numero = (v: number | undefined | null): number | null =>
  v == null || !Number.isFinite(v) ? null : v;

function aFechaISO(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Con validación activa Yahoo devuelve Date; por las dudas, segundos o ms
    const ms = v > 1e12 ? v : v * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  return null;
}

// ─── Etapa 1: el tablero ────────────────────────────────────────────────────

const CAMPOS_QUOTE = [
  "symbol",
  "regularMarketPrice",
  "regularMarketChangePercent",
  "fiftyTwoWeekChangePercent",
  "fiftyTwoWeekHighChangePercent",
  "fiftyDayAverageChangePercent",
  "twoHundredDayAverageChangePercent",
  "marketCap",
  "trailingPE",
  "earningsTimestampStart",
  "isEarningsDateEstimate",
];

/**
 * Los 503 del S&P 500 con sus métricas del día. ~3 requests a Yahoo.
 * Se cachea 10 minutos: es un panel de la mañana, no un ticker en vivo.
 */
export function getTablero(): Promise<FilaTablero[]> {
  return memo("tablero", 600, async () => {
    const tickers = UNIVERSO_SP500.map((e) => e.ticker);
    const lotes: string[][] = [];
    for (let i = 0; i < tickers.length; i += LOTE_QUOTE) {
      lotes.push(tickers.slice(i, i + LOTE_QUOTE));
    }

    const respuestas = await conLimite(lotes, 3, (lote) =>
      yf.quote(lote, { fields: CAMPOS_QUOTE })
    );

    const filas: FilaTablero[] = [];
    for (const quotes of respuestas) {
      for (const q of quotes ?? []) {
        const empresa = POR_TICKER.get(q.symbol);
        if (!empresa || q.regularMarketPrice == null) continue;
        filas.push({
          ticker: q.symbol,
          nombre: empresa.nombre,
          sector: empresa.sector,
          precio: q.regularMarketPrice,
          dia: numero(q.regularMarketChangePercent),
          año: numero(q.fiftyTwoWeekChangePercent),
          vsMedia50: aPorcentaje(q.fiftyDayAverageChangePercent),
          vsMedia200: aPorcentaje(q.twoHundredDayAverageChangePercent),
          desdeMaximo: aPorcentaje(q.fiftyTwoWeekHighChangePercent),
          capitalizacion: numero(q.marketCap),
          per: numero(q.trailingPE),
          proximoEarnings: aFechaISO(q.earningsTimestampStart),
          earningsEstimado: Boolean(q.isEarningsDateEstimate),
        });
      }
    }
    return filas;
  });
}

// ─── Etapa 2: retornos exactos ──────────────────────────────────────────────

export interface Cierre {
  fecha: string;
  close: number;
}

function restarDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

/** Último cierre con fecha <= corte. Null si la serie no llega tan atrás. */
function cierreAntesDe(serie: Cierre[], corte: string): number | null {
  for (let i = serie.length - 1; i >= 0; i--) {
    if (serie[i].fecha <= corte) return serie[i].close;
  }
  return null;
}

function calcularRetornos(serie: Cierre[]): Retornos {
  const ultimo = serie.at(-1)?.close;
  if (!ultimo) return { semana: null, mes: null, tres: null, seis: null, ytd: null, doce: null };

  const contra = (base: number | null) =>
    base && base > 0 ? (ultimo / base - 1) * 100 : null;

  const inicioAño = `${new Date().getFullYear()}-01-01`;

  return {
    semana: contra(cierreAntesDe(serie, restarDias(7))),
    mes: contra(cierreAntesDe(serie, restarDias(30))),
    tres: contra(cierreAntesDe(serie, restarDias(91))),
    seis: contra(cierreAntesDe(serie, restarDias(182))),
    ytd: contra(cierreAntesDe(serie, inicioAño)),
    doce: contra(cierreAntesDe(serie, restarDias(365))),
  };
}

/** Serie diaria de los últimos ~13 meses. Cacheada 30 min por ticker. */
export function getSerie(ticker: string): Promise<Cierre[]> {
  return memo(`serie:${ticker}`, 1800, async () => {
    const r = await yf.chart(ticker, { period1: restarDias(400), interval: "1d" });
    return r.quotes
      .filter((q): q is typeof q & { close: number } => q.close != null)
      .map((q) => ({
        fecha: q.date instanceof Date ? q.date.toISOString().slice(0, 10) : String(q.date).slice(0, 10),
        close: q.close,
      }));
  });
}

/**
 * Enriquece un conjunto de filas con retornos exactos y sparkline.
 * Un request por ticker: llamar sólo con los candidatos que importan.
 */
export async function conRetornos(filas: FilaTablero[]): Promise<FilaConRetornos[]> {
  const series = await conLimite(filas, CONCURRENCIA_CHART, (f) => getSerie(f.ticker));

  return filas.map((fila, i) => {
    const serie = series[i];
    if (!serie?.length) {
      return {
        ...fila,
        retornos: { semana: null, mes: null, tres: null, seis: null, ytd: null, doce: null },
        chispa: [],
      };
    }
    const desde = restarDias(182);
    return {
      ...fila,
      retornos: calcularRetornos(serie),
      chispa: serie.filter((c) => c.fecha >= desde).map((c) => c.close),
    };
  });
}

/** Retornos exactos de un solo ticker, para la ficha. Un request (cacheado). */
export async function getRetornosDe(ticker: string): Promise<{ retornos: Retornos; serie: Cierre[] }> {
  const serie = await getSerie(ticker);
  return { retornos: calcularRetornos(serie), serie };
}

/**
 * El ranking de la mañana.
 *
 * Los retornos exactos cuestan un request por ticker, así que no se pueden
 * pedir para los 503. Se preselecciona con las métricas baratas — distancia a
 * la media de 50 ruedas, que es el filtro de momentum estándar, más el retorno
 * de 12 meses que sí viene en el lote — y sobre ese grupo se calcula fino.
 *
 * El sesgo que esto introduce: una acción que subió fuerte en el último mes
 * pero sigue por debajo de sus medias podría no entrar. En la práctica es raro;
 * si sube fuerte, cruza la media de 50.
 */
export async function getRanking(candidatos = 120): Promise<FilaConRetornos[]> {
  const tablero = await getTablero();

  const puntaje = (f: FilaTablero) => Math.max(f.vsMedia50 ?? -999, (f.año ?? -999) / 4);
  const pool = [...tablero].sort((a, b) => puntaje(b) - puntaje(a)).slice(0, candidatos);

  return conRetornos(pool);
}

// ─── Ficha de un ticker ─────────────────────────────────────────────────────

export interface Ficha {
  ticker: string;
  nombre: string;
  sector: Sector;
  descripcion: string | null;
  industria: string | null;
  empleados: number | null;
  web: string | null;
  pais: string | null;
  precio: number | null;
  dia: number | null;
  moneda: string;
  fundamentals: {
    perTrailing: number | null;
    perForward: number | null;
    priceToBook: number | null;
    margenBruto: number | null;
    margenNeto: number | null;
    roe: number | null;
    crecimientoVentas: number | null;
    crecimientoGanancias: number | null;
    deudaSobrePatrimonio: number | null;
    capitalizacion: number | null;
    dividendo: number | null;
  };
  analistas: {
    precioObjetivo: number | null;
    objetivoMin: number | null;
    objetivoMax: number | null;
    recomendacion: string | null;
    cantidad: number | null;
  };
  earnings: {
    fecha: string | null;
    estimada: boolean;
    epsEsperado: number | null;
    ventasEsperadas: number | null;
  };
}

/** Perfil + fundamentals de un ticker. Un request. Cacheado 1 hora. */
export function getFicha(ticker: string): Promise<Ficha | null> {
  return memo(`ficha:${ticker}`, 3600, async () => {
    const empresa = POR_TICKER.get(ticker);
    if (!empresa) return null;

    const r = await yf.quoteSummary(ticker, {
      modules: [
        "assetProfile",
        "price",
        "summaryDetail",
        "financialData",
        "defaultKeyStatistics",
        "calendarEvents",
      ],
    });

    const perfil = r.assetProfile;
    const precio = r.price;
    const detalle = r.summaryDetail;
    const finanzas = r.financialData;
    const stats = r.defaultKeyStatistics;
    const calendario = r.calendarEvents?.earnings;

    return {
      ticker,
      nombre: empresa.nombre,
      sector: empresa.sector,
      descripcion: perfil?.longBusinessSummary ?? null,
      industria: perfil?.industry ?? null,
      empleados: numero(perfil?.fullTimeEmployees),
      web: perfil?.website ?? null,
      pais: perfil?.country ?? null,
      precio: numero(precio?.regularMarketPrice),
      dia: aPorcentaje(precio?.regularMarketChangePercent),
      moneda: precio?.currency ?? "USD",
      fundamentals: {
        perTrailing: numero(detalle?.trailingPE),
        perForward: numero(detalle?.forwardPE),
        priceToBook: numero(stats?.priceToBook),
        margenBruto: aPorcentaje(finanzas?.grossMargins),
        margenNeto: aPorcentaje(finanzas?.profitMargins),
        roe: aPorcentaje(finanzas?.returnOnEquity),
        crecimientoVentas: aPorcentaje(finanzas?.revenueGrowth),
        crecimientoGanancias: aPorcentaje(finanzas?.earningsGrowth),
        deudaSobrePatrimonio: numero(finanzas?.debtToEquity),
        capitalizacion: numero(precio?.marketCap),
        dividendo: aPorcentaje(detalle?.dividendYield),
      },
      analistas: {
        precioObjetivo: numero(finanzas?.targetMeanPrice),
        objetivoMin: numero(finanzas?.targetLowPrice),
        objetivoMax: numero(finanzas?.targetHighPrice),
        recomendacion: finanzas?.recommendationKey ?? null,
        cantidad: numero(finanzas?.numberOfAnalystOpinions),
      },
      earnings: {
        fecha: aFechaISO(calendario?.earningsDate?.[0]),
        estimada: Boolean(calendario?.isEarningsDateEstimate),
        epsEsperado: numero(calendario?.earningsAverage),
        ventasEsperadas: numero(calendario?.revenueAverage),
      },
    };
  });
}

/**
 * Comparables: el resto del sector, ordenado por capitalización.
 * Sale del tablero que ya está en memoria, así que no cuesta requests nuevos.
 */
export async function getComparables(ticker: string, limite = 6): Promise<FilaTablero[]> {
  const empresa = POR_TICKER.get(ticker);
  if (!empresa) return [];

  const tablero = await getTablero();
  return tablero
    .filter((f) => f.sector === empresa.sector && f.ticker !== ticker)
    .sort((a, b) => (b.capitalizacion ?? 0) - (a.capitalizacion ?? 0))
    .slice(0, limite);
}
