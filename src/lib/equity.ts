/**
 * Monitor de equity — datos de Yahoo Finance para el S&P 500.
 *
 * El módulo tiene dos etapas deliberadamente separadas por costo:
 *
 *   1. `getTablero()` — un `quote` en lote trae los ~2.200 tickers de NYSE y
 *      Nasdaq en unos 11 requests.
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
import { UNIVERSO, POR_TICKER, type EmpresaUniverso } from "@/lib/equity-universo";
import { TENENCIA_A_TICKER } from "@/lib/equity-tenencias";
import { SECTOR_LABEL, type Sector } from "@/lib/equity-sectores";
import type {
  FilaTablero, FilaConRetornos, Retornos, MetricaComparada, FamiliaETF,
} from "@/lib/equity-formato";

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
  items: readonly T[],
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
  // Sesión extendida: con la rueda cerrada, es lo único que se mueve.
  "marketState",
  "preMarketPrice",
  "preMarketChangePercent",
  "postMarketPrice",
  "postMarketChangePercent",
];

/**
 * La sesión extendida de un papel: pre-apertura o after-hours.
 *
 * Yahoo marca en qué sesión está con `marketState` y publica el precio de esa
 * sesión en campos aparte. Con la rueda regular abierta no hay sesión extendida
 * que mostrar (manda la variación del día). Ya cerrada (`CLOSED`) puede quedar
 * el after-hours de la que terminó o el pre de la que viene: se toma el que
 * tenga dato. La variación viene contra el último cierre regular, ya en %.
 */
function extendidoDe(
  q: Record<string, unknown>
): { tipo: "pre" | "post"; precio: number; dia: number | null } | null {
  // Los campos de sesión extendida no están en todos los miembros de la unión
  // `Quote`, así que se leen sueltos y se coercionan (igual que en getIndicesReferencia).
  const preP = numero(q.preMarketPrice as number);
  const postP = numero(q.postMarketPrice as number);
  const pre =
    preP != null
      ? { tipo: "pre" as const, precio: preP, dia: numero(q.preMarketChangePercent as number) }
      : null;
  const post =
    postP != null
      ? { tipo: "post" as const, precio: postP, dia: numero(q.postMarketChangePercent as number) }
      : null;

  switch (q.marketState) {
    case "PRE":
    case "PREPRE":
      return pre ?? post;
    case "POST":
    case "POSTPOST":
    case "CLOSED":
      return post ?? pre;
    default: // REGULAR (o desconocido): la sesión extendida no aplica
      return null;
  }
}

/**
 * Todo el universo con sus métricas del día, en lotes de 200.
 * Se cachea 10 minutos: es un panel de la mañana, no un ticker en vivo.
 */
export function getTablero(): Promise<FilaTablero[]> {
  return memo("tablero", 600, async () => {
    const tickers = UNIVERSO.map((e) => e.ticker);
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
        const qx = q as Record<string, unknown>;
        const ext = extendidoDe(qx);
        filas.push({
          ticker: q.symbol,
          nombre: empresa.nombre,
          sector: empresa.sector,
          precio: q.regularMarketPrice,
          dia: numero(q.regularMarketChangePercent),
          estadoMercado: typeof qx.marketState === "string" ? qx.marketState : null,
          premercado: ext?.dia ?? null,
          premercadoPrecio: ext?.precio ?? null,
          premercadoTipo: ext?.tipo ?? null,
          año: numero(q.fiftyTwoWeekChangePercent),
          vsMedia50: aPorcentaje(q.fiftyDayAverageChangePercent),
          vsMedia200: aPorcentaje(q.twoHundredDayAverageChangePercent),
          desdeMaximo: aPorcentaje(q.fiftyTwoWeekHighChangePercent),
          capitalizacion: numero(q.marketCap),
          per: numero(q.trailingPE),
          proximoEarnings: aFechaISO(q.earningsTimestampStart),
          earningsEstimado: Boolean(q.isEarningsDateEstimate),
          bolsa: empresa.bolsa,
          sp500: empresa.sp500,
          argentino: empresa.argentino,
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
export async function getRanking(candidatos = 150): Promise<FilaConRetornos[]> {
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
  /** Ciudad y estado de la casa matriz. */
  sede: string | null;
  /** Año de fundación, sacado del texto de la descripción. */
  fundada: number | null;
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

/**
 * El año de fundación no viene como campo: Yahoo lo escribe dentro de la
 * descripción, casi siempre al final ("was incorporated in 2015 and is
 * headquartered in Chicago"). Wikidata lo tiene sólo para algunas empresas, así
 * que sale más barato y más completo leerlo del texto.
 */
const RX_FUNDACION =
  /\b(?:was\s+)?(?:founded|incorporated|established|formed|organized)\s+(?:in\s+)?(?:the\s+year\s+)?(\d{4})\b/i;

function añoFundacion(descripcion: string | null | undefined): number | null {
  const m = descripcion?.match(RX_FUNDACION);
  const año = m ? Number(m[1]) : NaN;
  // Un año fuera de rango es una coincidencia falsa, no un dato
  return año >= 1600 && año <= new Date().getFullYear() ? año : null;
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
      sede: [perfil?.city, perfil?.state].filter(Boolean).join(", ") || null,
      fundada: añoFundacion(perfil?.longBusinessSummary),
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

// ─── Referencias del mercado ────────────────────────────────────────────────

/**
 * El índice y los 11 ETFs sectoriales de SPDR. Sirven de referencia: sin esto
 * no se sabe si una acción subió por mérito propio o porque subió todo.
 */
export const BENCHMARKS = {
  "^GSPC": "S&P 500",
  XLK: "Tecnología",
  XLF: "Financiero",
  XLV: "Salud",
  XLY: "Consumo discrecional",
  XLP: "Consumo básico",
  XLE: "Energía",
  XLI: "Industrial",
  XLB: "Materiales",
  XLRE: "Inmobiliario",
  XLU: "Servicios públicos",
  XLC: "Comunicaciones",
} as const;

/**
 * El ETF que representa a cada sector GICS. Parcial a propósito: "Otros" es el
 * cajón de los que no encajan en ningún rubro y no tiene ETF que lo replique.
 */
export const ETF_POR_SECTOR: Partial<Record<Sector, keyof typeof BENCHMARKS>> = {
  "Information Technology": "XLK",
  Financials: "XLF",
  "Health Care": "XLV",
  "Consumer Discretionary": "XLY",
  "Consumer Staples": "XLP",
  Energy: "XLE",
  Industrials: "XLI",
  Materials: "XLB",
  "Real Estate": "XLRE",
  Utilities: "XLU",
  "Communication Services": "XLC",
};

export interface Benchmark {
  ticker: string;
  nombre: string;
  precio: number | null;
  dia: number | null;
  año: number | null;
}

/** Índice y sectores del día. Un request. */
export function getBenchmarks(): Promise<Benchmark[]> {
  return memo("benchmarks", 600, async () => {
    const tickers = Object.keys(BENCHMARKS);
    const quotes = await yf.quote(tickers, {
      fields: ["symbol", "regularMarketPrice", "regularMarketChangePercent", "fiftyTwoWeekChangePercent"],
    });
    const porTicker = new Map(quotes.map((q) => [q.symbol, q]));
    return tickers.map((t) => {
      const q = porTicker.get(t);
      return {
        ticker: t,
        nombre: BENCHMARKS[t as keyof typeof BENCHMARKS],
        precio: numero(q?.regularMarketPrice),
        dia: numero(q?.regularMarketChangePercent),
        año: numero(q?.fiftyTwoWeekChangePercent),
      };
    });
  });
}

/**
 * Retornos del S&P 500 por período. Restarlos al retorno de una acción da el
 * alpha: cuánto le sacó (o le perdió) a comprar el índice y no hacer nada.
 */
export async function getRetornosIndice(): Promise<Retornos> {
  const serie = await getSerie("^GSPC");
  return calcularRetornos(serie);
}

// ─── Fundamentals con contexto ──────────────────────────────────────────────

function mediana(valores: (number | null)[]): number | null {
  const xs = valores.filter((v): v is number => v != null && Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const m = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2;
}

/** Los fundamentals crudos de un ticker, sin adornos. Se usa para los pares. */
async function fundamentalsCrudos(ticker: string) {
  const r = await yf.quoteSummary(ticker, {
    modules: ["summaryDetail", "financialData", "defaultKeyStatistics"],
  });
  return {
    perTrailing: numero(r.summaryDetail?.trailingPE),
    perForward: numero(r.summaryDetail?.forwardPE),
    priceToBook: numero(r.defaultKeyStatistics?.priceToBook),
    margenBruto: aPorcentaje(r.financialData?.grossMargins),
    margenNeto: aPorcentaje(r.financialData?.profitMargins),
    roe: aPorcentaje(r.financialData?.returnOnEquity),
    crecimientoVentas: aPorcentaje(r.financialData?.revenueGrowth),
    crecimientoGanancias: aPorcentaje(r.financialData?.earningsGrowth),
    deudaSobrePatrimonio: numero(r.financialData?.debtToEquity),
  };
}

/** Un par, con lo que vale en cada métrica. */
export interface ParComparado {
  ticker: string;
  nombre: string;
  capitalizacion: number | null;
  dia: number | null;
  /** Retorno de los últimos 12 meses, en %. */
  año: number | null;
  valores: Record<string, number | null>;
}

export interface Comparacion {
  metricas: MetricaComparada[];
  /** Contra quiénes se comparó, con su valor en cada métrica. */
  pares: ParComparado[];
  /** Si los pares salieron de la industria o hubo que abrir al sector. */
  criterio: "industria" | "sector";
  /** Cómo se llama el grupo con el que se comparó. */
  grupo: string;
}

/**
 * Compara los fundamentals del ticker contra la mediana de sus pares.
 *
 * Los pares son las empresas más grandes de su mismo sector GICS. Un PER de 33
 * no dice nada solo; contra una mediana sectorial de 28 sí dice algo. Cuesta un
 * request por par, así que se toman pocos y se cachea una hora.
 */
export function getComparacion(ticker: string, cantidadPares = 8): Promise<Comparacion | null> {
  return memo(`comparacion:${ticker}:${cantidadPares}`, 3600, async () => {
    const empresa = POR_TICKER.get(ticker);
    if (!empresa) return null;

    const tablero = await getTablero();
    const porTicker = new Map(tablero.map((f) => [f.ticker, f]));

    /**
     * Elige los pares evitando dos trampas.
     *
     * La primera es la clase de acción: Alphabet cotiza como GOOG y GOOGL, así
     * que entraba dos veces entre los ocho de Netflix y pesaba doble en cada
     * mediana. Son la misma empresa; lo que cambia son los derechos de voto.
     *
     * La segunda es que el sector GICS es demasiado grueso. "Communication
     * Services" mete a Netflix con Verizon y AT&T, que no comparten ni el
     * margen ni el ciclo. Se busca primero por industria y sólo se abre al
     * sector si no hay con quién comparar.
     */
    function elegir(mismo: (e: EmpresaUniverso) => boolean): string[] {
      const vistas = new Set<string>([empresa!.empresa]);
      const out: string[] = [];

      for (const e of UNIVERSO) {
        if (e.ticker === ticker || !mismo(e)) continue;
        if (vistas.has(e.empresa)) continue; // otra clase de una que ya está
        const fila = porTicker.get(e.ticker);
        if (!fila?.capitalizacion) continue;
        vistas.add(e.empresa);
        out.push(e.ticker);
      }

      return out
        .sort((a, b) => (porTicker.get(b)?.capitalizacion ?? 0) - (porTicker.get(a)?.capitalizacion ?? 0))
        .slice(0, cantidadPares);
    }

    // Con menos de cuatro pares la mediana no significa nada
    const porIndustria = empresa.industria ? elegir((e) => e.industria === empresa.industria) : [];
    const usaIndustria = porIndustria.length >= 4;
    const pares = usaIndustria ? porIndustria : elegir((e) => e.sector === empresa.sector);

    const [propio, ...deLosPares] = await Promise.all([
      fundamentalsCrudos(ticker),
      ...pares.map((p) => fundamentalsCrudos(p).catch(() => null)),
    ]);

    const vivos = pares
      .map((t, i) => ({ ticker: t, datos: deLosPares[i] }))
      .filter((p): p is { ticker: string; datos: NonNullable<(typeof deLosPares)[number]> } => p.datos != null);

    const med = (k: keyof typeof propio) => mediana(vivos.map((p) => p.datos[k]));

    const metricas: MetricaComparada[] = [
      { clave: "perTrailing", label: "PER", valor: propio.perTrailing, mediana: med("perTrailing"),
        formato: "num", sentido: "alto_caro",
        ayuda: "Precio sobre ganancias de los últimos 12 meses" },
      { clave: "perForward", label: "PER forward", valor: propio.perForward, mediana: med("perForward"),
        formato: "num", sentido: "alto_caro",
        ayuda: "Sobre las ganancias que espera el consenso para el año que viene" },
      { clave: "priceToBook", label: "Precio / libros", valor: propio.priceToBook, mediana: med("priceToBook"),
        formato: "num", sentido: "alto_caro",
        ayuda: "Cuántas veces el patrimonio contable paga el precio" },
      { clave: "margenBruto", label: "Margen bruto", valor: propio.margenBruto, mediana: med("margenBruto"),
        formato: "pct", sentido: "alto_mejor",
        ayuda: "Lo que queda de cada venta antes de gastos de estructura" },
      { clave: "margenNeto", label: "Margen neto", valor: propio.margenNeto, mediana: med("margenNeto"),
        formato: "pct", sentido: "alto_mejor",
        ayuda: "Lo que queda al final, después de todo" },
      { clave: "roe", label: "ROE", valor: propio.roe, mediana: med("roe"),
        formato: "pct", sentido: "alto_mejor", ayuda: "Retorno sobre el patrimonio" },
      { clave: "crecimientoVentas", label: "Crec. ventas", valor: propio.crecimientoVentas,
        mediana: med("crecimientoVentas"), formato: "pct", sentido: "alto_mejor",
        ayuda: "Último trimestre contra el mismo del año anterior" },
      { clave: "crecimientoGanancias", label: "Crec. ganancias", valor: propio.crecimientoGanancias,
        mediana: med("crecimientoGanancias"), formato: "pct", sentido: "alto_mejor",
        ayuda: "Último trimestre contra el mismo del año anterior" },
      { clave: "deudaSobrePatrimonio", label: "Deuda / patrimonio", valor: propio.deudaSobrePatrimonio,
        mediana: med("deudaSobrePatrimonio"), formato: "pct", sentido: "alto_apalancado",
        ayuda: "Deuda total como porcentaje del patrimonio neto" },
    ];

    // Cada par con su valor en cada métrica: es lo que deja ver la dispersión
    // en vez de sólo la mediana. Ya venían bajados; antes se descartaban.
    const comparados: ParComparado[] = vivos.map((p) => ({
      ticker: p.ticker,
      nombre: POR_TICKER.get(p.ticker)?.nombre ?? p.ticker,
      capitalizacion: porTicker.get(p.ticker)?.capitalizacion ?? null,
      dia: porTicker.get(p.ticker)?.dia ?? null,
      año: porTicker.get(p.ticker)?.año ?? null,
      valores: Object.fromEntries(
        metricas.map((m) => [m.clave, p.datos[m.clave as keyof typeof propio] ?? null])
      ) as Record<string, number | null>,
    }));

    return {
      metricas,
      pares: comparados,
      criterio: usaIndustria ? "industria" : "sector",
      grupo: usaIndustria ? empresa.industria! : SECTOR_LABEL[empresa.sector],
    };
  });
}

// ─── Señales del consenso ───────────────────────────────────────────────────

export interface SorpresaEarnings {
  trimestre: string;
  estimado: number | null;
  real: number | null;
  /** Diferencia contra lo esperado, en %. Positivo = le ganó al consenso. */
  sorpresa: number | null;
}

export interface TendenciaConsenso {
  periodo: string;
  compraFuerte: number;
  compra: number;
  mantener: number;
  venta: number;
  ventaFuerte: number;
}

export interface CambioAnalista {
  fecha: string | null;
  firma: string;
  desde: string | null;
  hacia: string;
  accion: string;
  objetivo: number | null;
  objetivoPrevio: number | null;
}

export interface Consenso {
  sorpresas: SorpresaEarnings[];
  tendencia: TendenciaConsenso[];
  cambios: CambioAnalista[];
  institucional: number | null;
}

/**
 * Lo que el mercado viene diciendo del papel: si le gana o le pierde al
 * consenso trimestre a trimestre, si las recomendaciones mejoran o se
 * deterioran, y quién movió su precio objetivo últimamente.
 */
export function getConsenso(ticker: string): Promise<Consenso> {
  return memo(`consenso:${ticker}`, 3600, async () => {
    const r = await yf.quoteSummary(ticker, {
      modules: [
        "earningsHistory",
        "recommendationTrend",
        "upgradeDowngradeHistory",
        "majorHoldersBreakdown",
      ],
    });

    const sorpresas: SorpresaEarnings[] = (r.earningsHistory?.history ?? [])
      .map((h) => ({
        trimestre: aFechaISO(h.quarter) ?? "",
        estimado: numero(h.epsEstimate),
        real: numero(h.epsActual),
        sorpresa: aPorcentaje(h.surprisePercent),
      }))
      .filter((s) => s.trimestre);

    const tendencia: TendenciaConsenso[] = (r.recommendationTrend?.trend ?? [])
      .slice(0, 4)
      .map((t) => ({
        periodo: t.period,
        compraFuerte: t.strongBuy ?? 0,
        compra: t.buy ?? 0,
        mantener: t.hold ?? 0,
        venta: t.sell ?? 0,
        ventaFuerte: t.strongSell ?? 0,
      }));

    // Yahoo suele mandarlos del más nuevo al más viejo, pero son cientos de
    // filas y el orden no está garantizado: ordenar antes de recortar.
    const cambios: CambioAnalista[] = [...(r.upgradeDowngradeHistory?.history ?? [])]
      .sort((a, b) => Number(new Date(b.epochGradeDate)) - Number(new Date(a.epochGradeDate)))
      .slice(0, 6)
      .map((h) => ({
        fecha: aFechaISO(h.epochGradeDate),
        firma: h.firm ?? "",
        desde: h.fromGrade || null,
        hacia: h.toGrade ?? "",
        accion: h.action ?? "",
        objetivo: numero(h.currentPriceTarget as number),
        // Yahoo manda 0 cuando no había objetivo previo (iniciación de cobertura)
        objetivoPrevio: numero(h.priorPriceTarget as number) || null,
      }));

    return {
      sorpresas,
      tendencia,
      cambios,
      institucional: aPorcentaje(r.majorHoldersBreakdown?.institutionsPercentHeld as number),
    };
  });
}

// ─── Historia financiera ────────────────────────────────────────────────────

export interface AñoFinanciero {
  año: string;
  ventas: number | null;
  neto: number | null;
  margenBruto: number | null;
  margenNeto: number | null;
}

/**
 * Ventas y márgenes de los últimos años. La foto de un trimestre no distingue
 * una empresa que viene mejorando de una que se está deteriorando.
 */
export function getHistoriaFinanciera(ticker: string): Promise<AñoFinanciero[]> {
  return memo(`historia:${ticker}`, 86400, async () => {
    const r = await yf.fundamentalsTimeSeries(
      ticker,
      { period1: "2019-01-01", type: "annual", module: "financials" },
      { validateResult: false }
    );

    return (r as Record<string, unknown>[])
      .map((x) => {
        const ventas = numero((x.totalRevenue ?? x.operatingRevenue) as number);
        const neto = numero((x.netIncome ?? x.netIncomeContinuousOperations) as number);
        const bruto = numero(x.grossProfit as number);
        return {
          año: aFechaISO(x.date)?.slice(0, 4) ?? "",
          ventas,
          neto,
          margenBruto: bruto && ventas ? (bruto / ventas) * 100 : null,
          margenNeto: neto && ventas ? (neto / ventas) * 100 : null,
        };
      })
      .filter((a) => a.año && a.ventas);
  });
}

// ─── Noticias ───────────────────────────────────────────────────────────────

export interface Noticia {
  titulo: string;
  medio: string;
  fecha: string | null;
  url: string;
}

/**
 * Últimas noticias del ticker. Salen del buscador de Yahoo, que devuelve el
 * mismo feed que muestra en la página del papel. Cacheadas 30 minutos.
 */
export function getNoticias(ticker: string, cantidad = 8): Promise<Noticia[]> {
  return memo(`noticias:${ticker}:${cantidad}`, 1800, async () => {
    // Sin validar: Yahoo cambia los campos de las noticias seguido y el
    // esquema de la librería queda viejo, tirando la respuesta entera.
    const r = (await yf.search(
      ticker,
      { newsCount: cantidad, quotesCount: 0, enableFuzzyQuery: false },
      { validateResult: false }
    )) as { news?: Record<string, unknown>[] };

    return (r.news ?? [])
      .map((n) => ({
        titulo: String(n.title ?? ""),
        medio: String(n.publisher ?? ""),
        fecha: aFechaISO(n.providerPublishTime),
        url: String(n.link ?? ""),
      }))
      .filter((n) => n.titulo && n.url);
  });
}

// ─── Composición de índices ─────────────────────────────────────────────────

/**
 * Los ETF que se pueden abrir en /etf.
 *
 * La descripción está escrita a mano, en castellano, sobre el objetivo que
 * declara cada fondo en su prospecto (lo que Yahoo devuelve en
 * `assetProfile.longBusinessSummary`). Se escribe acá y no se traduce en
 * runtime porque son 26 productos estables: no tiene sentido pagarle a un
 * modelo por traducir lo mismo todos los días, ni depender de una clave de API
 * para leer qué es el SPY.
 *
 * La gestora NO va acá: sale de `fundProfile.family` de Yahoo, que es dato.
 */
export const ETFS = [
  { ticker: "SPY", nombre: "S&P 500", detalle: "las 500 grandes de EE.UU.", familia: "amplios",
    descripcion: "Replica el S&P 500 comprando las 500 acciones del índice con el mismo peso que tienen ahí. Es la referencia por defecto cuando se habla de \"cómo viene el mercado\" estadounidense." },
  { ticker: "QQQ", nombre: "Nasdaq 100", detalle: "las 100 mayores del Nasdaq", familia: "amplios",
    descripcion: "Sigue al Nasdaq 100: las cien mayores empresas no financieras que cotizan en el Nasdaq. Queda muy cargado a tecnología, así que se mueve bastante más que el S&P en las dos direcciones." },
  { ticker: "DIA", nombre: "Dow Jones", detalle: "las 30 industriales", familia: "amplios",
    descripcion: "Replica el Dow Jones Industrial Average, treinta empresas grandes de EE.UU. Es el único de esta lista ponderado por precio de la acción y no por tamaño de la empresa, lo que lo vuelve poco representativo pero muy citado." },
  { ticker: "IWM", nombre: "Russell 2000", detalle: "small caps de EE.UU.", familia: "amplios",
    descripcion: "Sigue al Russell 2000, que son las cerca de 1.900 empresas más chicas del Russell 3000. Sirve para ver cómo le va a las small caps, que suelen moverse distinto de las grandes." },
  { ticker: "VTI", nombre: "Total Market", detalle: "todo el mercado de EE.UU.", familia: "amplios",
    descripcion: "Replica el CRSP US Total Market, que cubre prácticamente todo el mercado accionario estadounidense invertible: grandes, medianas y chicas en un solo papel." },
  { ticker: "VOO", nombre: "S&P 500 Vanguard", detalle: "mismo índice, menos comisión", familia: "amplios",
    descripcion: "El mismo S&P 500 que replica el SPY, pero de Vanguard y con estructura de fondo en vez de trust. La diferencia práctica está en la comisión anual." },

  { ticker: "XLK", nombre: "Tecnología", detalle: "sector tecnológico del S&P", familia: "sectoriales",
    descripcion: "Las tecnológicas del S&P 500 según la clasificación GICS: software, semiconductores y hardware. Réplica completa, con al menos el 95% del fondo en las acciones del índice." },
  { ticker: "XLF", nombre: "Financiero", detalle: "bancos y aseguradoras", familia: "sectoriales",
    descripcion: "Bancos, aseguradoras, gestoras de activos y financieras del S&P 500. Es el sector que más reacciona a los cambios de tasa." },
  { ticker: "XLV", nombre: "Salud", detalle: "farma, seguros y equipamiento", familia: "sectoriales",
    descripcion: "Salud del S&P 500: farmacéuticas, biotecnología, equipamiento médico y prestadores de servicios de salud." },
  { ticker: "XLY", nombre: "Consumo discrecional", detalle: "lo que se compra si sobra", familia: "sectoriales",
    descripcion: "Consumo discrecional del S&P 500: autos, retail, hoteles y restaurantes. Todo lo que la gente compra cuando le sobra plata, así que sigue de cerca al ciclo económico." },
  { ticker: "XLP", nombre: "Consumo básico", detalle: "lo que se compra igual", familia: "sectoriales",
    descripcion: "Consumo básico: alimentos, bebidas, tabaco y limpieza. Lo que se compra pase lo que pase, así que suele aguantar mejor las caídas." },
  { ticker: "XLE", nombre: "Energía", detalle: "petróleo y gas", familia: "sectoriales",
    descripcion: "Energía del S&P 500, dominado por las petroleras integradas y las de servicios petroleros. Se mueve más con el precio del crudo que con el resto del mercado." },
  { ticker: "XLI", nombre: "Industrial", detalle: "maquinaria, transporte y defensa", familia: "sectoriales",
    descripcion: "Industriales del S&P 500: maquinaria, transporte, aeroespacial, defensa y servicios comerciales." },
  { ticker: "XLB", nombre: "Materiales", detalle: "químicos, metales y envases", familia: "sectoriales",
    descripcion: "Materiales del S&P 500: químicos, metales y minería, envases y materiales de construcción. Es el sector más chico del índice." },
  { ticker: "XLRE", nombre: "Inmobiliario", detalle: "REITs de EE.UU.", familia: "sectoriales",
    descripcion: "Los REITs y las inmobiliarias del S&P 500. Al ser fideicomisos que reparten casi toda su ganancia, es el sector más sensible a la tasa larga." },
  { ticker: "XLU", nombre: "Servicios públicos", detalle: "energía eléctrica y agua", familia: "sectoriales",
    descripcion: "Servicios públicos del S&P 500: eléctricas, gas natural y agua. Negocios regulados y previsibles, que se usan como refugio defensivo." },
  { ticker: "XLC", nombre: "Comunicaciones", detalle: "medios, telecom e internet", familia: "sectoriales",
    descripcion: "Comunicaciones del S&P 500: telecomunicaciones, medios, entretenimiento e internet. Es el sector más concentrado de los once." },

  { ticker: "VEA", nombre: "Desarrollados ex-EE.UU.", detalle: "Europa, Japón y Australia", familia: "internacionales",
    descripcion: "Acciones de países desarrollados fuera de Estados Unidos —Europa, Japón, Canadá y Australia— de todos los tamaños. Sigue al FTSE Developed All Cap ex US." },
  { ticker: "VWO", nombre: "Emergentes", detalle: "China, India, Brasil y otros", familia: "internacionales",
    descripcion: "Mercados emergentes siguiendo un índice de FTSE que incluye acciones A chinas. Invierte por muestreo, no comprando el índice entero." },
  { ticker: "EFA", nombre: "EAFE", detalle: "desarrollados de Europa y Asia", familia: "internacionales",
    descripcion: "El índice EAFE de MSCI: desarrollados de Europa, Australasia y Lejano Oriente. A diferencia de VEA, deja afuera a Canadá y sólo toma empresas grandes y medianas." },
  { ticker: "EEM", nombre: "Emergentes iShares", detalle: "mismo universo, otro emisor", familia: "internacionales",
    descripcion: "Emergentes siguiendo el índice de MSCI en vez del de FTSE. Cubre un universo parecido al de VWO, con una comisión anual bastante más alta." },

  { ticker: "AGG", nombre: "Bonos EE.UU.", detalle: "renta fija de grado inversor", familia: "renta_fija",
    descripcion: "Todo el mercado de bonos estadounidenses de grado inversor: Treasuries, corporativos y respaldados por hipotecas. Es renta fija, no acciones: por eso no tiene cartera accionaria que mostrar." },
  { ticker: "TLT", nombre: "Treasuries largos", detalle: "bonos del Tesoro a 20+ años", familia: "renta_fija",
    descripcion: "Bonos del Tesoro de EE.UU. con más de veinte años de plazo restante. Al ser tan largo es muy sensible a la tasa: cuando la tasa sube, cae fuerte." },
  { ticker: "GLD", nombre: "Oro", detalle: "lingotes en custodia", familia: "materias_primas",
    descripcion: "Un fideicomiso que guarda lingotes de oro. Las cuotapartes siguen el precio del oro menos los gastos del trust; no hay empresas detrás." },
  { ticker: "SMH", nombre: "Semiconductores", detalle: "el corazón de la ola de IA", familia: "tematicos",
    descripcion: "Semiconductoras listadas en Estados Unidos, incluidos ADR de empresas extranjeras. Muy concentrado: pocas compañías explican buena parte del fondo." },
  { ticker: "ARKK", nombre: "ARK Innovation", detalle: "gestión activa, alta volatilidad", familia: "tematicos",
    descripcion: "El único de gestión activa de esta lista: no replica ningún índice, el equipo elige empresas que considera de \"innovación disruptiva\". Comisión alta y mucha más volatilidad que un indexado." },

  { ticker: "ARGT", nombre: "Argentina", detalle: "el riesgo argentino en un papel", familia: "paises",
    descripcion: "Sigue al MSCI Argentina, que en la práctica se arma casi todo con ADR y GDR de empresas argentinas que cotizan afuera. Es la forma más directa de tomar exposición al equity argentino desde una cuenta en dólares." },
  { ticker: "EWZ", nombre: "Brasil", detalle: "el vecino grande", familia: "paises",
    descripcion: "Las grandes y medianas de Brasil según MSCI. Muy pesado en materias primas y bancos, así que se mueve con el real y con el precio del hierro y el petróleo." },
  { ticker: "EWW", nombre: "México", detalle: "atado al ciclo de EE.UU.", familia: "paises",
    descripcion: "Las grandes y medianas de México según MSCI. Muy ligado al ciclo estadounidense por la integración comercial entre los dos países." },
  { ticker: "EWY", nombre: "Corea del Sur", detalle: "grandes y medianas coreanas", familia: "paises",
    descripcion: "Las grandes y medianas de Corea del Sur según MSCI. Ojo: no replica el KOSPI Composite, que además incluye a las chicas; este toma sólo grandes y medianas y ajusta por capital flotante. Está muy concentrado en tecnología y semiconductores." },
  { ticker: "EWJ", nombre: "Japón", detalle: "sin cobertura de yen", familia: "paises",
    descripcion: "Las grandes y medianas de Japón según MSCI. Cotiza en dólares sin cobertura cambiaria, así que el resultado incluye lo que haga el yen." },
  { ticker: "MCHI", nombre: "China", detalle: "incluye Hong Kong y ADR", familia: "paises",
    descripcion: "Acciones chinas de gran y mediana capitalización según MSCI, incluidas las que cotizan en Hong Kong y como ADR en Estados Unidos." },
  { ticker: "INDA", nombre: "India", detalle: "el emergente de moda", familia: "paises",
    descripcion: "Las grandes y medianas de India según MSCI, uno de los pocos emergentes grandes con crecimiento sostenido." },
  { ticker: "EWT", nombre: "Taiwán", detalle: "semiconductores", familia: "paises",
    descripcion: "Las grandes y medianas de Taiwán. Está dominado por semiconductores y una sola empresa pesa muchísimo, cosa que se ve en la concentración del fondo." },
  { ticker: "EWG", nombre: "Alemania", detalle: "el motor europeo", familia: "paises",
    descripcion: "Las grandes y medianas de Alemania según MSCI: industria, autos y química." },
  { ticker: "EWU", nombre: "Reino Unido", detalle: "fuera de la UE", familia: "paises",
    descripcion: "Las grandes y medianas del Reino Unido según MSCI, con mucho peso de energía, farmacéuticas y bancos globales." },
  { ticker: "EWC", nombre: "Canadá", detalle: "bancos y energía", familia: "paises",
    descripcion: "Las grandes y medianas de Canadá según MSCI. Pesado en bancos y en energía, así que sigue de cerca al precio del crudo." },
  { ticker: "ILF", nombre: "Latinoamérica 40", detalle: "la región sin elegir país", familia: "paises",
    descripcion: "Las cuarenta mayores de América Latina. Brasil y México explican casi todo, con algo de Chile, Perú y Colombia. Es el atajo para tomar la región sin elegir un país." },

  { ticker: "VGK", nombre: "Europa", detalle: "todos los tamaños", familia: "internacionales",
    descripcion: "Acciones europeas de todos los tamaños siguiendo el FTSE Developed Europe All Cap. Cubre más países y más empresas que cualquier ETF de un solo mercado." },

  { ticker: "LQD", nombre: "Corporativos grado inversor", detalle: "crédito de calidad en USD", familia: "renta_fija",
    descripcion: "Bonos corporativos en dólares de grado inversor y plazos largos. Paga más que un Treasury a cambio de sumar riesgo de crédito." },
  { ticker: "HYG", nombre: "Alto rendimiento", detalle: "bonos basura", familia: "renta_fija",
    descripcion: "Bonos corporativos en dólares por debajo del grado inversor. Rinde bastante más, pero en las crisis se comporta más parecido a las acciones que a la renta fija." },
  { ticker: "TIP", nombre: "Bonos ajustados por inflación", detalle: "TIPS del Tesoro", familia: "renta_fija",
    descripcion: "Bonos del Tesoro estadounidense ajustados por inflación con más de un año de plazo. Protegen del índice de precios, no de la suba de la tasa real." },
  { ticker: "EMB", nombre: "Deuda emergente", detalle: "soberanos en dólares", familia: "renta_fija",
    descripcion: "Deuda soberana y cuasi soberana de países emergentes emitida en dólares. Es la referencia de la categoría en la que juegan los bonos argentinos." },

  { ticker: "SLV", nombre: "Plata", detalle: "lingotes en custodia", familia: "materias_primas",
    descripcion: "Un fideicomiso que guarda lingotes de plata. Igual que el de oro, sigue el precio del metal menos los gastos; no hay empresas detrás." },
  { ticker: "USO", nombre: "Petróleo", detalle: "futuros, no crudo físico", familia: "materias_primas",
    descripcion: "No compra petróleo físico sino contratos de futuros de crudo. Ojo con esto: cuando la curva de futuros está en contango, el fondo pierde valor al renovar posiciones aunque el precio spot no baje." },

  { ticker: "RSP", nombre: "S&P 500 equiponderado", detalle: "todas pesan igual", familia: "estrategias",
    descripcion: "El mismo S&P 500 pero con las 500 empresas pesando igual en vez de por tamaño. Comparado contra SPY muestra si el índice sube por todo el mercado o por un puñado de gigantes." },
  { ticker: "SCHD", nombre: "Dividendos", detalle: "pagadores consistentes", familia: "estrategias",
    descripcion: "Empresas estadounidenses con historial de pagar dividendos de forma consistente, filtradas además por calidad del balance. Más defensivo y con más renta que el índice." },
  { ticker: "MTUM", nombre: "Momentum", detalle: "las que vienen subiendo", familia: "estrategias",
    descripcion: "Toma las acciones estadounidenses que vienen subiendo más fuerte y las sostiene mientras dure la tendencia. Es la estrategia de momentum empaquetada." },
  { ticker: "QUAL", nombre: "Calidad", detalle: "balances sólidos", familia: "estrategias",
    descripcion: "Filtra el mercado estadounidense por calidad: alto retorno sobre el patrimonio, ganancias estables y poca deuda." },

  { ticker: "IBIT", nombre: "Bitcoin", detalle: "cripto en cuenta de valores", familia: "tematicos",
    descripcion: "Tiene bitcoin en custodia. Permite tomar exposición a la cripto desde una cuenta de valores común, sin manejar billeteras ni exchanges." },
  { ticker: "VNQ", nombre: "Inmobiliario amplio", detalle: "más que el XLRE", familia: "tematicos",
    descripcion: "REITs e inmobiliarias estadounidenses con un universo bastante más amplio que el sector inmobiliario del S&P 500." },
  { ticker: "XBI", nombre: "Biotecnología", detalle: "pesos parejos", familia: "tematicos",
    descripcion: "Biotecnología estadounidense con pesos parejos entre empresas, así que las chicas influyen tanto como las grandes. Mucho más volátil que el sector salud completo." },
  { ticker: "ITA", nombre: "Aeroespacial y defensa", detalle: "presupuesto militar", familia: "tematicos",
    descripcion: "Aeroespacial y defensa de Estados Unidos. Se mueve con los presupuestos militares y con la tensión geopolítica más que con el ciclo económico." },
] as const satisfies readonly {
  ticker: string; nombre: string; detalle: string; familia: FamiliaETF; descripcion: string;
}[];

/**
 * El índice local de referencia de cada fondo.
 *
 * Un ETF de país cotiza en dólares y el índice de ese país en su moneda, así
 * que los dos retornos no coinciden: la diferencia es el tipo de cambio. Tener
 * el índice al lado lo hace explícito — el KOSPI puede subir en wones mientras
 * EWY queda plano en dólares.
 *
 * No es el índice que el fondo replica: EWY sigue a MSCI Korea, no al KOSPI.
 * Es el termómetro del mercado subyacente.
 */
export const INDICE_REFERENCIA: Record<string, string> = {
  SPY: "^GSPC", VOO: "^GSPC", QQQ: "^NDX", DIA: "^DJI", IWM: "^RUT",
  ARGT: "^MERV", EWZ: "^BVSP", EWW: "^MXX", EWY: "^KS11", EWJ: "^N225",
  MCHI: "^HSI", INDA: "^BSESN", EWT: "^TWII", EWG: "^GDAXI", EWU: "^FTSE",
  EWC: "^GSPTSE", VGK: "^STOXX50E",
};

export interface IndiceReferencia {
  ticker: string;
  nombre: string;
  nivel: number | null;
  dia: number | null;
  moneda: string | null;
}

/** Todos los índices de referencia en un solo request. Cacheado 10 minutos. */
export function getIndicesReferencia(): Promise<Record<string, IndiceReferencia>> {
  return memo("indices-referencia", 600, async () => {
    const simbolos = [...new Set(Object.values(INDICE_REFERENCIA))];
    const quotes = await yf.quote(
      simbolos,
      { fields: ["symbol", "longName", "shortName", "regularMarketPrice", "regularMarketChangePercent", "currency"] },
      { validateResult: false }
    );

    const porSimbolo = new Map(
      (quotes as Record<string, unknown>[]).map((q) => [String(q.symbol), q])
    );

    const salida: Record<string, IndiceReferencia> = {};
    for (const [etf, indice] of Object.entries(INDICE_REFERENCIA)) {
      const q = porSimbolo.get(indice);
      if (!q) continue;
      salida[etf] = {
        ticker: indice,
        nombre: String(q.longName ?? q.shortName ?? indice).trim(),
        nivel: numero(q.regularMarketPrice as number),
        dia: numero(q.regularMarketChangePercent as number),
        moneda: (q.currency as string) ?? null,
      };
    }
    return salida;
  });
}

/** Los cuatro que se muestran resumidos en el monitor. */
export const ETFS_DESTACADOS = ["SPY", "QQQ", "DIA", "IWM"] as const;

export interface Tenencia {
  /** El símbolo tal como lo reporta el fondo. */
  ticker: string;
  nombre: string;
  /** Peso dentro del fondo, en %. */
  peso: number;
  /** Ticker equivalente en el dashboard, si existe. Null = no hay ficha. */
  destino: string | null;
  /** Dónde cotiza, cuando el símbolo no es de NYSE ni Nasdaq. */
  mercado: string | null;
  /** Los ETF guardan liquidez en fondos money market: no son empresas. */
  esLiquidez: boolean;
}

export interface Composicion {
  ticker: string;
  nombre: string;
  detalle: string;
  familia: FamiliaETF;
  precio: number | null;
  dia: number | null;
  año: number | null;
  tenencias: Tenencia[];
  /** Peso por sector GICS, en %. */
  sectores: { sector: Sector; peso: number }[];
  /** Cuánto del fondo explican las tenencias que se muestran. */
  concentracion: number;
  /** Comisión anual del fondo, en %. */
  gastoAnual: number | null;
  /** Qué es el fondo, en castellano. Escrito a mano en la lista de ETFS. */
  descripcion: string;
  /** Quién lo gestiona, según Yahoo. */
  gestora: string | null;
}

/**
 * De qué bolsa es un símbolo que no es de NYSE ni Nasdaq.
 *
 * Un ETF de país compra en la bolsa local: EWZ tiene VALE3.SA de B3, no VALE
 * de NYSE. Decir en qué mercado cotiza es más útil que un genérico "no está".
 */
const SUFIJO_MERCADO: Record<string, string> = {
  SA: "B3, Brasil", MX: "BMV, México", TO: "Toronto", V: "Toronto Venture",
  L: "Londres", DE: "Fráncfort", PA: "París", AS: "Ámsterdam", BR: "Bruselas",
  MC: "Madrid", MI: "Milán", SW: "Suiza", VI: "Viena", LS: "Lisboa",
  ST: "Estocolmo", OL: "Oslo", CO: "Copenhague", HE: "Helsinki", IR: "Dublín",
  T: "Tokio", HK: "Hong Kong", KS: "Corea (KOSPI)", KQ: "Corea (KOSDAQ)",
  TW: "Taiwán", TWO: "Taiwán OTC", NS: "India (NSE)", BO: "India (BSE)",
  AX: "Australia", NZ: "Nueva Zelanda", SI: "Singapur", JO: "Johannesburgo",
  TA: "Tel Aviv", IS: "Estambul", WA: "Varsovia", SN: "Santiago", BA: "Buenos Aires",
};

function mercadoDe(simbolo: string): string | null {
  const sufijo = simbolo.includes(".") ? simbolo.split(".").pop()!.toUpperCase() : null;
  if (sufijo) return SUFIJO_MERCADO[sufijo] ?? `bolsa .${sufijo.toLowerCase()}`;
  // Códigos puramente numéricos: Hong Kong, Corea, India según el largo
  if (/^\d{4,6}$/.test(simbolo)) {
    if (simbolo.length === 5) return "Hong Kong";
    if (simbolo.length === 6) return "Corea o India";
    return "bolsa local";
  }
  // Sufijo numérico sin punto: la línea local brasileña (ITUB4, PETR4)
  if (/^[A-Z]{4}\d{1,2}$/.test(simbolo)) return "B3, Brasil";
  return null;
}

/** Yahoo nombra los sectores en camelCase; acá se traducen a los del dashboard. */
const SECTOR_YAHOO_A_GICS: Record<string, Sector> = {
  technology: "Information Technology",
  financial_services: "Financials",
  healthcare: "Health Care",
  consumer_cyclical: "Consumer Discretionary",
  consumer_defensive: "Consumer Staples",
  communication_services: "Communication Services",
  industrials: "Industrials",
  energy: "Energy",
  basic_materials: "Materials",
  realestate: "Real Estate",
  utilities: "Utilities",
};

interface TopHoldingsCrudo {
  topHoldings?: {
    holdings?: { symbol?: string; holdingName?: string; holdingPercent?: number }[];
    sectorWeightings?: Record<string, number>[];
  };
  fundProfile?: {
    feesExpensesInvestment?: { annualReportExpenseRatio?: number };
    family?: string;
  };
}

/**
 * Cómo se compone un ETF: sus mayores tenencias y el peso de cada sector.
 *
 * Yahoo devuelve las diez principales, no el fondo entero. La composición
 * completa habría que raspársela a cada emisor —State Street publica un Excel,
 * Invesco directamente bloquea la descarga— y cada uno tiene su formato. En
 * SPY esas diez ya son más de un tercio del fondo, así que para entender de
 * qué depende el índice alcanza; por eso se muestra la concentración al lado.
 */
export function getComposicion(ticker: string): Promise<Composicion | null> {
  return memo(`composicion:${ticker}`, 3600, async () => {
    const meta = ETFS.find((e) => e.ticker === ticker);
    if (!meta) return null;

    const [resumen, cotizacion] = await Promise.all([
      yf.quoteSummary(
        ticker,
        { modules: ["topHoldings", "fundProfile"] },
        { validateResult: false }
      ) as Promise<TopHoldingsCrudo>,
      yf.quote(ticker, {
        fields: ["regularMarketPrice", "regularMarketChangePercent", "fiftyTwoWeekChangePercent"],
      }),
    ]);

    const crudas = resumen.topHoldings?.holdings ?? [];
    const tenencias: Tenencia[] = crudas
      .filter((h) => h.symbol && h.holdingPercent != null)
      .map((h) => {
        const simbolo = h.symbol!;
        const nombre = h.holdingName ?? simbolo;
        return {
          ticker: simbolo,
          nombre,
          peso: h.holdingPercent! * 100,
          destino: POR_TICKER.has(simbolo) ? simbolo : TENENCIA_A_TICKER[simbolo] ?? null,
          mercado: mercadoDe(simbolo),
          esLiquidez: /Cash Fund|Money Market|Treasury SL|SL Agency|Liquidity/i.test(nombre),
        };
      });

    // Yahoo manda cada sector como un objeto de una sola clave: [{technology: 0.31}, …]
    const sectores = (resumen.topHoldings?.sectorWeightings ?? [])
      .flatMap((entrada) =>
        Object.entries(entrada).map(([clave, peso]) => ({
          sector: SECTOR_YAHOO_A_GICS[clave],
          peso: (peso ?? 0) * 100,
        }))
      )
      .filter((s): s is { sector: Sector; peso: number } => Boolean(s.sector) && s.peso > 0)
      .sort((a, b) => b.peso - a.peso);

    return {
      ticker,
      nombre: meta.nombre,
      detalle: meta.detalle,
      familia: meta.familia,
      gastoAnual: aPorcentaje(resumen.fundProfile?.feesExpensesInvestment?.annualReportExpenseRatio),
      descripcion: meta.descripcion,
      gestora: resumen.fundProfile?.family ?? null,
      precio: numero(cotizacion.regularMarketPrice),
      dia: numero(cotizacion.regularMarketChangePercent),
      año: numero(cotizacion.fiftyTwoWeekChangePercent),
      tenencias,
      sectores,
      concentracion: tenencias.reduce((total, t) => total + t.peso, 0),
    };
  });
}

/** Varios ETF en paralelo, sin que uno que falle voltee al resto. */
export async function getComposiciones(
  tickers: readonly string[] = ETFS.map((e) => e.ticker)
): Promise<Composicion[]> {
  const todas = await conLimite(tickers, 8, (t) => getComposicion(t));
  return todas.filter((c): c is Composicion => c != null);
}
