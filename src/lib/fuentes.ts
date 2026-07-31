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
  { idVariable: 44, ticker: "TAMAR", metrica: "tna" },
  { idVariable: 1, ticker: "RESERVAS", metrica: "valor" },
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

const argentinaDatosFuente: Fuente = {
  id: "argentinadatos",
  label: "Riesgo país + IPC",
  async fetchValues() {
    const out: FetchedValue[] = [];

    const [rp, inflacion] = await Promise.allSettled([
      getJson<{ valor: number; fecha: string }>(
        "https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais/ultimo"
      ),
      getJson<{ fecha: string; valor: number }[]>(
        "https://api.argentinadatos.com/v1/finanzas/indices/inflacion"
      ),
    ]);

    if (rp.status === "fulfilled" && Number.isFinite(rp.value.valor)) {
      out.push({ instrumento: "RIESGO_PAIS", metrica: "valor", valor: rp.value.valor, fecha: rp.value.fecha });
    }
    if (inflacion.status === "fulfilled" && inflacion.value.length > 0) {
      const ultimo = inflacion.value[inflacion.value.length - 1];
      if (Number.isFinite(ultimo.valor)) {
        out.push({ instrumento: "IPC", metrica: "valor", valor: ultimo.valor, fecha: ultimo.fecha });
      }
    }

    if (out.length === 0) throw new Error("sin datos");
    return out;
  },
};

// ─── Yahoo (contexto global) ───────────────────────────────────────────────────

const yahooFuente: Fuente = {
  id: "yahoo",
  label: "Global (S&P, UST)",
  async fetchValues() {
    const yf = new YahooFinance();
    const hoy = localDateStr();
    const out: FetchedValue[] = [];

    const [gspc, tnx] = await Promise.allSettled([
      yf.quote("^GSPC", { fields: ["regularMarketPrice"] }),
      yf.quote("^TNX", { fields: ["regularMarketPrice"] }),
    ]);

    if (gspc.status === "fulfilled" && gspc.value.regularMarketPrice) {
      out.push({ instrumento: "SPX", metrica: "valor", valor: gspc.value.regularMarketPrice, fecha: hoy });
    }
    if (tnx.status === "fulfilled" && tnx.value.regularMarketPrice) {
      // ^TNX ya viene en porcentaje (4,745 = 4,745%), no escalado ×10 — verificado jul-2026
      out.push({ instrumento: "UST10Y", metrica: "valor", valor: tnx.value.regularMarketPrice, fecha: hoy });
    }

    if (out.length === 0) throw new Error("sin datos");
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

  // Inflación (serie mensual)
  try {
    const rows = await getJson<{ fecha: string; valor: number }[]>(
      "https://api.argentinadatos.com/v1/finanzas/indices/inflacion"
    );
    const valores = rows
      .filter((r) => Number.isFinite(r.valor) && r.fecha >= desde)
      .map((r) => ({ instrumento: "IPC", metrica: "valor", valor: r.valor, fecha: r.fecha }));
    results.push({ fuente: "backfill_ipc", label: "Histórico IPC", ok: true, valores });
  } catch (e) {
    results.push({
      fuente: "backfill_ipc", label: "Histórico IPC", ok: false, valores: [],
      error: e instanceof Error ? e.message : String(e),
    });
  }

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
