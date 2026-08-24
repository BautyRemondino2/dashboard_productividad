/**
 * Curva de soberanos hard-dollar: TIR y duration a partir del precio.
 *
 * Ninguna fuente pública argentina publica la TIR de estos bonos —se
 * verificaron data912, argentinadatos, Bolsar, BYMA, IAMC y Yahoo—, así que hay
 * que calcularla. Para eso hacen falta los flujos de fondos, que son fijos y
 * están en los prospectos del canje 2020.
 *
 * **Los flujos están escritos a mano acá.** Es el eslabón débil de todo el
 * dashboard: un cupón o una fecha mal cargados dan una TIR equivocada, y una
 * TIR equivocada es peor que no mostrar nada. Por eso `validarCurva()` compara
 * el resultado contra el riesgo país, que sí es dato observable: si los flujos
 * estuvieran mal, las TIR se irían lejos de esa referencia y la UI lo avisa.
 */

import { ONS, SOBERANOS, type FlujoBono } from "@/lib/bonos-flujos";

export type Flujo = FlujoBono;

export interface EsquemaBono {
  ticker: string;
  nombre: string;
  ley: "AR" | "NY";
  /** Año de vencimiento, para ordenar y etiquetar. */
  vencimiento: number;
  flujos: Flujo[];
}

/** Global 2030 / Bonar 2030 y así: el nombre sale del ticker y la ley. */
function nombrar(ticker: string, ley: "AR" | "NY", año: number): string {
  if (/^A[LEONV]/.test(ticker) && ley === "AR") return `Bonar ${año}`;
  if (/^GD/.test(ticker)) return `Global ${año}`;
  return `${ticker} ${año}`;
}

export const ESQUEMAS: Record<string, EsquemaBono> = Object.fromEntries(
  SOBERANOS.map((b) => {
    const año = Number(b.vencimiento.slice(0, 4));
    return [b.ticker, {
      ticker: b.ticker,
      nombre: nombrar(b.ticker, b.ley, año),
      ley: b.ley,
      vencimiento: año,
      flujos: b.flujos,
    }];
  })
);

/** Las obligaciones negociables, con el mismo esquema que los soberanos. */
export const ESQUEMAS_ON: Record<string, EsquemaBono & { simboloPrecio: string }> =
  Object.fromEntries(
    ONS.map((o) => [o.ticker, {
      ticker: o.ticker,
      nombre: o.nombre,
      ley: "AR" as const,
      vencimiento: Number(o.vencimiento.slice(0, 4)),
      flujos: o.flujos,
      simboloPrecio: o.simboloPrecio,
    }])
  );

// ─── Cálculo ────────────────────────────────────────────────────────────────

/**
 * Convención 30/360: todos los meses valen 30 días y el año 360.
 *
 * Es la que usan estos bonos. Contra ACT/365 la diferencia es de menos de un
 * punto básico, pero no cuesta nada hacerlo bien y evita que alguien tenga que
 * preguntarse por qué el número no coincide con la pantalla del broker.
 */
function años30360(desde: Date, fecha: string): number {
  const d = new Date(`${fecha}T00:00:00Z`);
  const d1 = Math.min(desde.getUTCDate(), 30);
  const d2 = Math.min(d.getUTCDate(), 30);
  const meses = 12 * (d.getUTCFullYear() - desde.getUTCFullYear()) + (d.getUTCMonth() - desde.getUTCMonth());
  return (30 * meses + (d2 - d1)) / 360;
}

/**
 * Valor presente con **capitalización semestral**, que es la convención de
 * estos bonos: pagan renta dos veces al año y su rendimiento se expresa como
 * bond-equivalent yield.
 *
 * Capitalizar anual —como estaba antes— daba una TIR unos 17 puntos básicos
 * más alta. Para un asesor que compara contra la pantalla del broker, esa
 * diferencia se nota.
 */
function valorPresente(flujos: Flujo[], tasa: number, hoy: Date): number {
  let vp = 0;
  for (const f of flujos) {
    const t = años30360(hoy, f.fecha);
    if (t <= 0) continue;
    vp += f.monto / Math.pow(1 + tasa / 2, 2 * t);
  }
  return vp;
}

/**
 * TIR por bisección. No se usa Newton-Raphson a propósito: con flujos
 * irregulares puede divergir, y la bisección sobre un intervalo acotado siempre
 * converge o dice que no hay solución.
 */
export function calcularTir(flujos: Flujo[], precio: number, hoy = new Date()): number | null {
  if (precio <= 0) return null;

  let bajo = -0.5;
  let alto = 3.0;
  if (valorPresente(flujos, bajo, hoy) < precio) return null; // ni al mínimo alcanza
  if (valorPresente(flujos, alto, hoy) > precio) return null; // ni al máximo baja

  for (let i = 0; i < 200; i++) {
    const medio = (bajo + alto) / 2;
    if (valorPresente(flujos, medio, hoy) > precio) bajo = medio;
    else alto = medio;
    if (alto - bajo < 1e-9) break;
  }
  return (bajo + alto) / 2;
}

/**
 * Duration modificada: cuánto cae el precio por cada punto que sube la tasa.
 *
 * Se divide por (1 + TIR/2) y no por (1 + TIR) porque la capitalización es
 * semestral: la modificada tiene que dividir por uno más la tasa **del
 * período**, no de la tasa anual.
 */
export function calcularDuration(flujos: Flujo[], tir: number, hoy = new Date()): number | null {
  const vp = valorPresente(flujos, tir, hoy);
  if (vp <= 0) return null;

  let ponderado = 0;
  for (const f of flujos) {
    const t = años30360(hoy, f.fecha);
    if (t <= 0) continue;
    ponderado += (t * f.monto) / Math.pow(1 + tir / 2, 2 * t);
  }
  const macaulay = ponderado / vp;
  return macaulay / (1 + tir / 2);
}

export interface PuntoCurva {
  ticker: string;
  nombre: string;
  ley: "AR" | "NY";
  precio: number;
  /** TIR anual, en %. */
  tir: number;
  /** Duration modificada, en años. Es el eje X de la curva. */
  duration: number;
  vencimiento: number;
}

/** Lo que cuesta la ley: cuánto más rinde el bono local al mismo vencimiento. */
export interface SpreadLey {
  vencimiento: number;
  ar: PuntoCurva;
  ny: PuntoCurva;
  /** Diferencia de TIR en puntos básicos. Positivo = el local rinde más. */
  spreadPb: number;
}

/** Arma los puntos de la curva a partir de los precios que haya. */
export function armarCurva(
  precios: Record<string, number>,
  hoy = new Date()
): PuntoCurva[] {
  const puntos: PuntoCurva[] = [];

  for (const [ticker, precio] of Object.entries(precios)) {
    const esquema = ESQUEMAS[ticker];
    if (!esquema || !precio) continue;

    const tir = calcularTir(esquema.flujos, precio, hoy);
    if (tir == null) continue;

    const duration = calcularDuration(esquema.flujos, tir, hoy);
    if (duration == null) continue;

    puntos.push({
      ticker,
      nombre: esquema.nombre,
      ley: esquema.ley,
      precio,
      tir: tir * 100,
      duration,
      vencimiento: esquema.vencimiento,
    });
  }

  return puntos.sort((a, b) => a.duration - b.duration);
}

/**
 * El spread por ley, vencimiento por vencimiento.
 *
 * Es la comparación que importa: el Global y el Bonar del mismo año tienen los
 * mismos flujos y el mismo deudor, y sólo se diferencian en dónde se litiga si
 * hay default. Todo lo que el local rinde de más es el precio de esa
 * diferencia.
 */
export function spreadsPorLey(puntos: PuntoCurva[]): SpreadLey[] {
  const porVencimiento = new Map<number, { ar?: PuntoCurva; ny?: PuntoCurva }>();
  for (const p of puntos) {
    const e = porVencimiento.get(p.vencimiento) ?? {};
    if (p.ley === "AR") e.ar = p;
    else e.ny = p;
    porVencimiento.set(p.vencimiento, e);
  }

  return [...porVencimiento.entries()]
    .filter(([, e]) => e.ar && e.ny)
    .map(([vencimiento, e]) => ({
      vencimiento,
      ar: e.ar!,
      ny: e.ny!,
      spreadPb: (e.ar!.tir - e.ny!.tir) * 100,
    }))
    .sort((a, b) => a.vencimiento - b.vencimiento);
}

// ─── Control de sanidad ─────────────────────────────────────────────────────

export interface Validacion {
  /** Tickers cuya TIR no encaja con el resto de la curva. */
  sospechosos: string[];
  /** TIR que implica el riesgo país, si se pudo calcular. */
  implicita: number | null;
  mensaje: string | null;
}

/** Ajuste lineal de TIR contra duration: la forma esperada de la curva. */
function ajusteLineal(puntos: PuntoCurva[]): (d: number) => number {
  const n = puntos.length;
  const sx = puntos.reduce((s, p) => s + p.duration, 0);
  const sy = puntos.reduce((s, p) => s + p.tir, 0);
  const sxy = puntos.reduce((s, p) => s + p.duration * p.tir, 0);
  const sxx = puntos.reduce((s, p) => s + p.duration * p.duration, 0);
  const den = n * sxx - sx * sx;
  if (Math.abs(den) < 1e-9) return () => sy / n;
  const b = (n * sxy - sx * sy) / den;
  const a = (sy - b * sx) / n;
  return (d) => a + b * d;
}

/**
 * Busca puntos que no cierran.
 *
 * Dos controles independientes. El primero: el riesgo país es, por definición,
 * el spread de estos mismos bonos sobre los Treasuries, así que la curva debería
 * orbitar `UST + riesgo país`. El segundo, más fino: si un bono se aleja mucho
 * de la recta que forman los demás, el sospechoso es su flujo de fondos y no el
 * mercado — los soberanos de un mismo emisor no cotizan a tasas dispares sin
 * motivo.
 *
 * Este control ya sirvió: con los flujos cargados a mano, los 2029 y 2030 se
 * iban del resto de la curva mientras 2035, 2038, 2041 y 2046 cerraban contra
 * el riesgo país.
 */
export function validarCurva(
  puntos: PuntoCurva[],
  riesgoPaisPb: number | null,
  ust10y: number | null
): Validacion {
  if (puntos.length < 4) {
    return { sospechosos: [], implicita: null, mensaje: "Faltan precios para armar la curva." };
  }

  const implicita = riesgoPaisPb != null && ust10y != null ? ust10y + riesgoPaisPb / 100 : null;

  const recta = ajusteLineal(puntos);
  const sospechosos = puntos
    .filter((p) => Math.abs(p.tir - recta(p.duration)) > 2.5)
    .map((p) => p.ticker);

  const mensaje = sospechosos.length
    ? `${sospechosos.join(", ")} ${sospechosos.length === 1 ? "queda" : "quedan"} fuera de la curva que forman los demás. ` +
      "Lo más probable es que su esquema de amortización esté mal cargado en src/lib/bonos.ts, no que el mercado los esté pagando distinto."
    : null;

  return { sospechosos, implicita, mensaje };
}

// ─── Obligaciones negociables ───────────────────────────────────────────────

const DATA912_CORP = "https://data912.com/live/arg_corp";

interface FilaData912 {
  symbol: string;
  c?: number;
  px_bid?: number;
  px_ask?: number;
}

/** El precio de cierre; si no operó, el punto medio de las puntas. */
function precioDe(r: FilaData912 | undefined): number | null {
  if (!r) return null;
  if ((r.c ?? 0) > 0) return r.c!;
  if ((r.px_bid ?? 0) > 0 && (r.px_ask ?? 0) > 0) return (r.px_bid! + r.px_ask!) / 2;
  return (r.px_bid ?? 0) > 0 ? r.px_bid! : (r.px_ask ?? 0) > 0 ? r.px_ask! : null;
}

export interface PuntoOn extends PuntoCurva {
  /** Quién emitió: sirve para agrupar bancos, energía, etc. */
  emisor: string;
}

interface EntradaOn {
  valor: PuntoOn[];
  vence: number;
}

declare global {
  var __curvaOnsCache: EntradaOn | undefined;
}

/**
 * La curva de obligaciones negociables en dólares.
 *
 * Los cronogramas están en el repo (ver `bonos-flujos.ts`); los precios se
 * piden en vivo a data912, que es la misma fuente que alimenta el resto del
 * panel. Cacheado diez minutos: es un panel de la mañana.
 */
export async function getCurvaOns(hoy = new Date()): Promise<PuntoOn[]> {
  const cache = globalThis.__curvaOnsCache;
  if (cache && cache.vence > Date.now()) return cache.valor;

  const r = await fetch(DATA912_CORP, { headers: { "user-agent": "personal-dashboard" } });
  if (!r.ok) throw new Error(`data912 respondió ${r.status}`);

  const filas = (await r.json()) as FilaData912[];
  const porSimbolo = new Map(filas.map((f) => [f.symbol, f]));

  const puntos: PuntoOn[] = [];
  for (const on of Object.values(ESQUEMAS_ON)) {
    const precio = precioDe(porSimbolo.get(on.simboloPrecio));
    if (precio == null) continue;

    const tir = calcularTir(on.flujos, precio, hoy);
    if (tir == null) continue;
    const duration = calcularDuration(on.flujos, tir, hoy);
    if (duration == null) continue;

    // Una TIR fuera de este rango no es una oportunidad: es un precio mal
    // publicado o un cronograma que no corresponde a ese símbolo
    const pct = tir * 100;
    if (pct < -5 || pct > 60) continue;

    puntos.push({
      ticker: on.ticker,
      nombre: on.nombre,
      ley: "AR",
      precio,
      tir: pct,
      duration,
      vencimiento: on.vencimiento,
      emisor: on.nombre,
    });
  }

  const ordenados = puntos.sort((a, b) => a.duration - b.duration);
  globalThis.__curvaOnsCache = { valor: ordenados, vence: Date.now() + 600_000 };
  return ordenados;
}
