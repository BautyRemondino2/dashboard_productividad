/**
 * BYMA open data — https://open.bymadata.com.ar
 *
 * La mejor fuente pública de renta fija argentina: cauciones, soberanos, ONs.
 * API REST bajo `/vanoms-be-core/rest/api/bymadata/free/`, POST con body `{}`.
 * El cert valida bien, así que el `fetch` de Node entra directo (sin -k).
 *
 * Caché en memoria del proceso con TTL, igual que `equity.ts`: no toca la DB.
 *
 * `/cauciones` devuelve una fila por contrato (símbolo `PESOS-DDMM…` /
 * `DOLAR-DDMM…`):
 *  - `daysToMaturity`: plazo en días
 *  - `denominationCcy`: "ARS" | "USD"
 *  - `settlementPrice`: TNA del día, ya en % (0 si no operó hoy)
 *  - `previousSettlementPrice`: TNA del cierre anterior, en fracción (0,21 = 21%)
 *  - `tradeVolume`: monto operado, en la moneda del contrato
 */
import { localDateStr } from "@/lib/utils";

const BASE = "https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free";
const TIMEOUT_MS = 9000;

async function postByma<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${BASE}/${endpoint}`, {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: "{}",
  });
  if (!res.ok) throw new Error(`BYMA ${endpoint} HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Caché en memoria (patrón equity) ────────────────────────────────────────

interface Entrada<T> {
  valor: T;
  vence: number;
}

declare global {
  var __bymaCache: Map<string, Entrada<unknown>> | undefined;
}

const cache = (globalThis.__bymaCache ??= new Map<string, Entrada<unknown>>());

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

// ─── Cauciones ───────────────────────────────────────────────────────────────

interface CaucionCruda {
  denominationCcy?: string;
  daysToMaturity?: number;
  settlementPrice?: number;
  previousSettlementPrice?: number;
  tradeVolume?: number;
}

export interface Caucion {
  /** Plazo en días. */
  plazo: number;
  /** Tasa nominal anual, en %. */
  tna: number;
  /** Monto operado, en la moneda del contrato. */
  volumen: number;
  /** true = tasa operada hoy; false = cierre anterior (fuera de rueda). */
  operadoHoy: boolean;
}

export interface CaucionesData {
  ars: Caucion[];
  usd: Caucion[];
  fecha: string;
}

/**
 * Una fila por plazo para una moneda. Se toma la tasa operada hoy; si un plazo
 * no operó, cae al cierre anterior. Cuando hay algo operado hoy se muestran sólo
 * esos plazos (la curva viva); fuera de rueda, la del cierre previo.
 */
function procesar(rows: CaucionCruda[], ccy: "ARS" | "USD"): Caucion[] {
  const porPlazo = new Map<number, Caucion>();

  for (const r of rows) {
    if (r.denominationCcy !== ccy || r.daysToMaturity == null) continue;

    const hoy = typeof r.settlementPrice === "number" && r.settlementPrice > 0 ? r.settlementPrice : null;
    const previa =
      typeof r.previousSettlementPrice === "number" && r.previousSettlementPrice > 0
        ? r.previousSettlementPrice * 100
        : null;
    const tna = hoy ?? previa;
    if (tna == null) continue;

    const c: Caucion = {
      plazo: r.daysToMaturity,
      tna,
      volumen: r.tradeVolume ?? 0,
      operadoHoy: hoy != null,
    };
    // Puede haber más de un contrato por plazo: se queda el de más volumen.
    const prev = porPlazo.get(c.plazo);
    if (!prev || c.volumen > prev.volumen) porPlazo.set(c.plazo, c);
  }

  let lista = [...porPlazo.values()];
  const operadas = lista.filter((c) => c.operadoHoy);
  if (operadas.length > 0) lista = operadas;
  return lista.sort((a, b) => a.plazo - b.plazo);
}

/** La curva de cauciones de hoy, por moneda. Cacheada 5 minutos. */
export function getCauciones(): Promise<CaucionesData> {
  return memo("cauciones", 300, async () => {
    const rows = await postByma<CaucionCruda[]>("cauciones");
    return {
      ars: procesar(rows, "ARS"),
      usd: procesar(rows, "USD"),
      fecha: localDateStr(),
    };
  });
}

/**
 * TNA de la caución a 1 día en pesos — la líquida, la referencia de tasa corta.
 * Es lo que consume la fuente automática para llenar CAUCION1. Si justo no operó
 * el plazo 1, cae al plazo más corto disponible. Null si no hay nada.
 */
export async function getCaucion1DiaARS(): Promise<number | null> {
  const { ars } = await getCauciones();
  const uno = ars.find((c) => c.plazo === 1) ?? ars[0];
  return uno?.tna ?? null;
}
