/**
 * Ingesta de datos de mercado — fuentes pluggables.
 *
 * Cada fuente declara su fetch aislado: timeout propio, errores capturados por
 * fetchAllFuentes. La caída de una fuente nunca rompe el resto. Los valores se
 * upsertean en market_series con fuente = id de la fuente (idempotente por
 * UNIQUE(fecha, instrumento, metrica)).
 *
 * Endpoints verificados 31-jul-2026:
 *  - data912.com/live/{arg_bonds,arg_notes,arg_corp,arg_cedears}
 *    → {symbol, px_bid, px_ask, c, ...}. Sufijos: X=pesos, XC=cable, XD=MEP/USD.
 *    API educativa, cache ~2hs, sin SLA: nunca asumirla disponible.
 *  - dolarapi.com/v1/dolares (API live de argentinadatos)
 *    → [{casa, compra, venta, fechaActualizacion}]
 *  - api.bcra.gob.ar/estadisticas/v4.0/monetarias/{id}?limit=1
 *    → id 44: TAMAR bancos privados (TNA) · id 1: reservas internacionales (MUSD).
 *    (La serie "tasa de política monetaria" dejó de publicarse en jul-2025.)
 *  - api.argentinadatos.com/v1/finanzas/indices/{riesgo-pais/ultimo,inflacion}
 *  - yahoo-finance2 (ya en el proyecto): ^GSPC → SPX, ^TNX → UST10Y (ya en %).
 */

import YahooFinance from "yahoo-finance2";
import { defaultMetric } from "@/lib/mercado";
import type { MarketInstrument } from "@/lib/mercado";
import { getCaucion1DiaARS } from "@/lib/byma";
import { fredSerie, ultimo, variacionInteranual, desdeHaceAnios } from "@/lib/fred";
import { localDateStr } from "@/lib/utils";

export interface FetchedValue {
  instrumento: string;
  metrica: string;
  valor: number;
  fecha: string; // YYYY-MM-DD
}

export interface FuenteResult {
  fuente: string;
  label: string;
  ok: boolean;
  valores: FetchedValue[];
  error?: string;
}

interface FuenteCtx {
  /** Instrumentos activos registrados, por ticker. */
  instruments: Map<string, MarketInstrument>;
}

interface Fuente {
  id: string;
  label: string;
  /** Devuelve [] si no hay nada que buscar (p. ej. sin instrumentos del tipo). */
  fetchValues(ctx: FuenteCtx): Promise<FetchedValue[]>;
}

const TIMEOUT_MS = 8000;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/** Fecha AR (UTC-3) de un timestamp ISO. */
function fechaAR(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

// ─── data912 ───────────────────────────────────────────────────────────────────

interface Data912Row {
  symbol: string;
  px_bid: number;
  px_ask: number;
  c: number;
}

function data912Price(row: Data912Row): number | null {
  if (row.c > 0) return row.c;
  if (row.px_bid > 0 && row.px_ask > 0) return (row.px_bid + row.px_ask) / 2;
  if (row.px_bid > 0) return row.px_bid;
  if (row.px_ask > 0) return row.px_ask;
  return null;
}

/**
 * Un endpoint de data912 → precios de los instrumentos registrados de esos tipos.
 * Para instrumentos en USD se busca el ticker D (MEP) y si no existe el C (cable);
 * para instrumentos en ARS, el ticker pelado.
 */
function data912Fuente(id: string, label: string, endpoint: string, tipos: string[]): Fuente {
  return {
    id,
    label,
    async fetchValues(ctx) {
      const targets = [...ctx.instruments.values()].filter((i) => tipos.includes(i.tipo));
      if (targets.length === 0) return [];

      const rows = await getJson<Data912Row[]>(`https://data912.com/live/${endpoint}`);
      const bySymbol = new Map(rows.map((r) => [r.symbol, r]));
      const hoy = localDateStr();

      const out: FetchedValue[] = [];
      for (const inst of targets) {
        const candidates =
          inst.unidad === "USD" || inst.moneda === "USD"
            ? [`${inst.ticker}D`, `${inst.ticker}C`]
            : [inst.ticker];
        for (const sym of candidates) {
          const row = bySymbol.get(sym);
          const valor = row ? data912Price(row) : null;
          if (valor !== null) {
            out.push({ instrumento: inst.ticker, metrica: defaultMetric(inst.tipo), valor, fecha: hoy });
            break;
          }
        }
      }
      return out;
    },
  };
}

// ─── dolarapi (argentinadatos live) ────────────────────────────────────────────

const DOLAR_CASAS: Record<string, string> = {
  oficial: "OFICIAL",
  blue: "BLUE",
  bolsa: "MEP",
  contadoconliqui: "CCL",
};

const dolarapiFuente: Fuente = {
  id: "dolarapi",
  label: "Dólares",
  async fetchValues() {
    const rows = await getJson<{ casa: string; venta: number; fechaActualizacion: string }[]>(
      "https://dolarapi.com/v1/dolares"
    );
    const out: FetchedValue[] = [];
    for (const row of rows) {
      const ticker = DOLAR_CASAS[row.casa];
      if (!ticker || !Number.isFinite(row.venta)) continue;
      out.push({
        instrumento: ticker,
        metrica: "precio",
        valor: row.venta,
        fecha: row.fechaActualizacion ? fechaAR(row.fechaActualizacion) : localDateStr(),
      });
    }
    return out;
  },
};

// ─── BCRA ──────────────────────────────────────────────────────────────────────

interface BcraSerie {
  results: { detalle: { fecha: string; valor: number }[] }[];
}

const BCRA_VARS: { idVariable: number; ticker: string; metrica: string }[] = [
  { idVariable: 44, ticker: "TAMAR",     metrica: "tna" },
  { idVariable: 7,  ticker: "BADLAR",    metrica: "tna" },
  { idVariable: 1,  ticker: "RESERVAS",  metrica: "valor" },
  { idVariable: 15, ticker: "BASE_MON",  metrica: "valor" },
  { idVariable: 5,  ticker: "MAYORISTA", metrica: "precio" },
];

const bcraFuente: Fuente = {
  id: "bcra",
  label: "BCRA",
  async fetchValues() {
    const out: FetchedValue[] = [];
    // Secuencial y por-variable: si una serie falla, las otras sobreviven.
    for (const v of BCRA_VARS) {
      try {
        const data = await getJson<BcraSerie>(
          `https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/${v.idVariable}?limit=1`
        );
        const punto = data.results?.[0]?.detalle?.[0];
        if (punto && Number.isFinite(punto.valor)) {
          out.push({ instrumento: v.ticker, metrica: v.metrica, valor: punto.valor, fecha: punto.fecha });
        }
      } catch {
        // esta variable falló; seguir con la próxima
      }
    }
    if (out.length === 0) throw new Error("sin datos de ninguna variable");
    return out;
  },
};

// ─── argentinadatos ────────────────────────────────────────────────────────────

/** Último punto de una serie [{fecha, valor}] de argentinadatos. */
async function ultimoDeSerie(url: string, ticker: string): Promise<FetchedValue | null> {
  const rows = await getJson<{ fecha: string; valor: number }[]>(url);
  if (!rows.length) return null;
  const ultimo = rows[rows.length - 1];
  if (!Number.isFinite(ultimo.valor)) return null;
  return { instrumento: ticker, metrica: "valor", valor: ultimo.valor, fecha: ultimo.fecha };
}

const AD_SERIES: { url: string; ticker: string }[] = [
  { url: "https://api.argentinadatos.com/v1/finanzas/indices/inflacion",           ticker: "IPC" },
  { url: "https://api.argentinadatos.com/v1/finanzas/indices/inflacionInteranual", ticker: "IPC_IA" },
  { url: "https://api.argentinadatos.com/v1/finanzas/indices/uva",                 ticker: "UVA" },
];

const argentinaDatosFuente: Fuente = {
  id: "argentinadatos",
  label: "Riesgo país, IPC, UVA",
  async fetchValues() {
    const out: FetchedValue[] = [];

    const [rp, ...series] = await Promise.allSettled([
      getJson<{ valor: number; fecha: string }>(
        "https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais/ultimo"
      ),
      ...AD_SERIES.map((s) => ultimoDeSerie(s.url, s.ticker)),
    ]);

    if (rp.status === "fulfilled" && Number.isFinite(rp.value.valor)) {
      out.push({ instrumento: "RIESGO_PAIS", metrica: "valor", valor: rp.value.valor, fecha: rp.value.fecha });
    }
    for (const r of series) {
      if (r.status === "fulfilled" && r.value) out.push(r.value);
    }

    if (out.length === 0) throw new Error("sin datos");
    return out;
  },
};

/**
 * Plazo fijo minorista: el endpoint devuelve la TNA de cada banco, no una serie.
 * Se guarda la mediana (más representativa que el promedio, que se distorsiona
 * con los bancos que publican 0) como referencia de lo que consigue un cliente.
 */
const plazoFijoFuente: Fuente = {
  id: "plazofijo",
  label: "Plazo fijo",
  async fetchValues() {
    const rows = await getJson<{ tnaClientes: number | null }[]>(
      "https://api.argentinadatos.com/v1/finanzas/tasas/plazoFijo"
    );
    const tnas = rows
      .map((r) => r.tnaClientes)
      .filter((t): t is number => typeof t === "number" && t > 0)
      .sort((a, b) => a - b);
    if (tnas.length === 0) throw new Error("sin tasas publicadas");

    const mid = Math.floor(tnas.length / 2);
    const mediana = tnas.length % 2 === 0 ? (tnas[mid - 1] + tnas[mid]) / 2 : tnas[mid];

    return [{
      instrumento: "PLAZOFIJO",
      metrica: "tna",
      valor: mediana * 100, // viene como fracción (0,19 = 19% TNA)
      fecha: localDateStr(),
    }];
  },
};

// ─── BYMA (caución a 1 día en pesos) ────────────────────────────────────────────

/**
 * Llena CAUCION1 (tasa corta en pesos) con la TNA a 1 día de BYMA. Es el
 * instrumento que antes se cargaba a mano: ahora se rebaja solo. La curva
 * completa de cauciones vive en el panel de /mercado (ver `@/lib/byma`).
 */
const bymaCaucionFuente: Fuente = {
  id: "byma_caucion",
  label: "Caución (BYMA)",
  async fetchValues() {
    const tna = await getCaucion1DiaARS();
    if (tna == null) throw new Error("sin caución operada");
    return [{ instrumento: "CAUCION1", metrica: "tna", valor: tna, fecha: localDateStr() }];
  },
};

// ─── FRED (tasa de la Fed e inflación de EE.UU.) ───────────────────────────────

/**
 * Los tres datos de EE.UU. que merecen entrar al panel argentino y no quedarse
 * sólo en `/eeuu`: la tasa de la Fed, la inflación norteamericana y el VIX.
 *
 * Es lo que da la escala para leer el resto. Un riesgo país de 500 pb significa
 * una cosa con el Tesoro a 4,7% y otra bien distinta con el Tesoro a 2%, porque
 * lo que paga el bono es la suma de los dos.
 *
 * La serie va a `market_series` como cualquier otra: así queda el histórico para
 * los deltas de 30 y 90 días del panel, que es lo que `@/lib/fred` —pensado para
 * consulta en vivo— no guarda.
 */
const fredFuente: Fuente = {
  id: "fred",
  label: "Fed & EE.UU.",
  async fetchValues() {
    const out: FetchedValue[] = [];

    // Cada serie aislada: si FRED se cae para una, las otras entran igual.
    const [tasa, cpi, vix] = await Promise.allSettled([
      fredSerie("DFEDTARU", desdeHaceAnios(1)),
      fredSerie("CPIAUCSL", desdeHaceAnios(2)),
      fredSerie("VIXCLS", desdeHaceAnios(1)),
    ]);

    if (tasa.status === "fulfilled") {
      const u = ultimo(tasa.value);
      if (u) out.push({ instrumento: "FED_FUNDS", metrica: "tna", valor: u.valor, fecha: u.fecha });
    }
    if (cpi.status === "fulfilled") {
      const u = ultimo(cpi.value);
      const ia = variacionInteranual(cpi.value);
      // FRED publica el nivel del índice: la inflación hay que calcularla.
      if (u && ia != null) {
        out.push({ instrumento: "CPI_USA", metrica: "valor", valor: ia, fecha: u.fecha });
      }
    }
    if (vix.status === "fulfilled") {
      const u = ultimo(vix.value);
      if (u) out.push({ instrumento: "VIX", metrica: "valor", valor: u.valor, fecha: u.fecha });
    }

    if (out.length === 0) throw new Error("sin datos de FRED");
    return out;
  },
};

// ─── Yahoo (global, commodities, Merval) ───────────────────────────────────────

/**
 * Se usa chart() y no quote(): varios símbolos (futuros de commodities) fallan la
 * validación de schema de quote(), y chart() además devuelve la serie histórica,
 * así que sirve para el panel y para el backfill con la misma llamada.
 *
 * factor ajusta unidades de cotización: ^TNX ya viene en % (no ×10, verificado
 * jul-2026) y ZS=F cotiza en centavos de dólar por bushel.
 */
const YAHOO_SYMS: { symbol: string; ticker: string; factor?: number }[] = [
  { symbol: "^GSPC",      ticker: "SPX" },
  { symbol: "^TNX",       ticker: "UST10Y" },
  { symbol: "DX-Y.NYB",   ticker: "DXY" },
  { symbol: "BRL=X",      ticker: "BRL" },
  { symbol: "BZ=F",       ticker: "PETROLEO" },
  { symbol: "ZS=F",       ticker: "SOJA", factor: 0.01 },
  { symbol: "GC=F",       ticker: "ORO" },
  { symbol: "^MERV",      ticker: "MERVAL" },
];

async function yahooSerie(
  symbol: string,
  ticker: string,
  factor: number,
  dias: number
): Promise<FetchedValue[]> {
  const yf = new YahooFinance({ validation: { logErrors: false } });
  const res = await yf.chart(symbol, {
    period1: new Date(Date.now() - dias * 86_400_000),
    interval: "1d",
  });
  return (res.quotes ?? [])
    .filter((q) => q.close != null && q.date != null)
    .map((q) => ({
      instrumento: ticker,
      metrica: "valor",
      valor: (q.close as number) * factor,
      fecha: new Date(q.date).toISOString().slice(0, 10),
    }));
}

/** Solo el último punto de cada símbolo (refresh diario). */
const yahooFuente: Fuente = {
  id: "yahoo",
  label: "Global & commodities",
  async fetchValues() {
    const settled = await Promise.allSettled(
      YAHOO_SYMS.map((s) => yahooSerie(s.symbol, s.ticker, s.factor ?? 1, 7))
    );
    const out: FetchedValue[] = [];
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value.length > 0) out.push(r.value[r.value.length - 1]);
    }
    if (out.length === 0) throw new Error("sin datos de ningún símbolo");
    return out;
  },
};

// ─── Registro + runner ─────────────────────────────────────────────────────────

const FUENTES: Fuente[] = [
  data912Fuente("data912_bonos",   "Soberanos",  "arg_bonds",   ["soberano_usd"]),
  data912Fuente("data912_letras",  "Lecaps/CER", "arg_notes",   ["lecap", "cer"]),
  data912Fuente("data912_ons",     "ONs",        "arg_corp",    ["on"]),
  data912Fuente("data912_cedears", "CEDEARs",    "arg_cedears", ["cedear"]),
  dolarapiFuente,
  bcraFuente,
  argentinaDatosFuente,
  plazoFijoFuente,
  bymaCaucionFuente,
  fredFuente,
  yahooFuente,
];

/**
 * Backfill histórico — corre una sola vez (o cuando el usuario lo pida).
 *
 * Sin esto los deltas de 30d/90d tardan tres meses en aparecer. argentinadatos
 * publica las series completas de dólares, riesgo país e inflación, así que el
 * panel muestra tendencias desde el primer día. Se limita a ~400 días: alcanza
 * para 90d y evita insertar 7.000 filas por serie.
 */
export async function fetchBackfill(): Promise<FuenteResult[]> {
  const desde = localDateStr(-400);
  const results: FuenteResult[] = [];

  // Dólares (serie diaria por casa)
  try {
    const rows = await getJson<{ casa: string; venta: number; fecha: string }[]>(
      "https://api.argentinadatos.com/v1/cotizaciones/dolares"
    );
    const valores: FetchedValue[] = [];
    for (const r of rows) {
      const ticker = DOLAR_CASAS[r.casa];
      if (!ticker || !Number.isFinite(r.venta) || r.fecha < desde) continue;
      valores.push({ instrumento: ticker, metrica: "precio", valor: r.venta, fecha: r.fecha });
    }
    results.push({ fuente: "backfill_dolares", label: "Histórico dólares", ok: true, valores });
  } catch (e) {
    results.push({
      fuente: "backfill_dolares", label: "Histórico dólares", ok: false, valores: [],
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // Riesgo país (serie diaria)
  try {
    const rows = await getJson<{ fecha: string; valor: number }[]>(
      "https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais"
    );
    const valores = rows
      .filter((r) => Number.isFinite(r.valor) && r.fecha >= desde)
      .map((r) => ({ instrumento: "RIESGO_PAIS", metrica: "valor", valor: r.valor, fecha: r.fecha }));
    results.push({ fuente: "backfill_riesgo", label: "Histórico riesgo país", ok: true, valores });
  } catch (e) {
    results.push({
      fuente: "backfill_riesgo", label: "Histórico riesgo país", ok: false, valores: [],
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // Inflación mensual, interanual y UVA (series de argentinadatos)
  for (const s of AD_SERIES) {
    try {
      const rows = await getJson<{ fecha: string; valor: number }[]>(s.url);
      const valores = rows
        .filter((r) => Number.isFinite(r.valor) && r.fecha >= desde)
        .map((r) => ({ instrumento: s.ticker, metrica: "valor", valor: r.valor, fecha: r.fecha }));
      results.push({ fuente: `backfill_${s.ticker}`, label: `Histórico ${s.ticker}`, ok: true, valores });
    } catch (e) {
      results.push({
        fuente: `backfill_${s.ticker}`, label: `Histórico ${s.ticker}`, ok: false, valores: [],
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Global, commodities y Merval (chart() de Yahoo ya devuelve la serie)
  const yahooSettled = await Promise.allSettled(
    YAHOO_SYMS.map((s) => yahooSerie(s.symbol, s.ticker, s.factor ?? 1, 400))
  );
  yahooSettled.forEach((r, i) => {
    const { ticker } = YAHOO_SYMS[i];
    if (r.status === "fulfilled") {
      results.push({
        fuente: `backfill_yahoo_${ticker}`, label: `Histórico ${ticker}`, ok: true,
        valores: r.value.filter((v) => v.fecha >= desde),
      });
    } else {
      results.push({
        fuente: `backfill_yahoo_${ticker}`, label: `Histórico ${ticker}`, ok: false, valores: [],
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  });

  // BCRA: TAMAR y reservas (una serie por variable, aisladas entre sí)
  for (const v of BCRA_VARS) {
    try {
      const data = await getJson<BcraSerie>(
        `https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/${v.idVariable}?limit=400`
      );
      const valores = (data.results?.[0]?.detalle ?? [])
        .filter((p) => Number.isFinite(p.valor) && p.fecha >= desde)
        .map((p) => ({ instrumento: v.ticker, metrica: v.metrica, valor: p.valor, fecha: p.fecha }));
      results.push({ fuente: `backfill_bcra_${v.ticker}`, label: `Histórico ${v.ticker}`, ok: true, valores });
    } catch (e) {
      results.push({
        fuente: `backfill_bcra_${v.ticker}`, label: `Histórico ${v.ticker}`, ok: false, valores: [],
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return results;
}

export async function fetchAllFuentes(instruments: MarketInstrument[]): Promise<FuenteResult[]> {
  const ctx: FuenteCtx = {
    instruments: new Map(instruments.map((i) => [i.ticker, i])),
  };

  const settled = await Promise.allSettled(FUENTES.map((f) => f.fetchValues(ctx)));

  return FUENTES.map((f, i) => {
    const r = settled[i];
    if (r.status === "fulfilled") {
      return { fuente: f.id, label: f.label, ok: true, valores: r.value };
    }
    const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
    return { fuente: f.id, label: f.label, ok: false, valores: [], error: msg };
  });
}
