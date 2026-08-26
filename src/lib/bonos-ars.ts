/**
 * Curvas en pesos: CER y dólar linked.
 *
 * Los dos son bonos que cotizan en pesos pero no rinden en pesos. Un CER paga
 * inflación más una tasa real; un dólar linked paga la devaluación oficial más
 * una tasa en dólares. En los dos casos la TIR que interesa es la del "más": el
 * ajuste no es rendimiento, es mantener el poder de compra.
 *
 * La cuenta es la misma para los dos y tiene una sola idea. El bono paga
 * `flujo × coeficiente_del_pago`, y el coeficiente futuro no se conoce. Pero si
 * se divide el precio por el coeficiente de **hoy**, el ajuste se cancela: lo
 * que queda es un bono común, en unidades constantes, y su TIR es la tasa real
 * (o la tasa en dólares). Por eso los cronogramas se guardan en unidades de
 * emisión y acá sólo se aplica el coeficiente del día.
 *
 * ── El rezago, que es donde está la trampa ──────────────────────────────────
 *
 * Ninguno de los dos ajustes usa el índice del día. Un CER usa el de diez días
 * hábiles antes; un dólar linked, el A3500 de tres hábiles antes. Parece un
 * detalle de letra chica y no lo es: diez días de CER son ~1% de coeficiente, y
 * en un bono a tres meses 1% de precio son varios puntos de TIR anualizada.
 * Usando el índice del día, todo el tramo corto de la curva CER daba entre tres
 * y seis puntos más de lo que cotiza.
 *
 * Los dos rezagos se verificaron contra los rendimientos que publica rava: con
 * ellos, cada cronograma descontado a la TIR de esa fuente llega al precio al
 * que el bono cotiza. El control corre en `scripts/generar-flujos-ars.mjs` y
 * decide qué bonos entran al archivo de cronogramas.
 */

import { CONV_ARS, calcularDuration, calcularTir, precioDe, type FilaData912 } from "@/lib/bonos";
import { BONOS_CER, DOLAR_LINKED } from "@/lib/bonos-flujos-ars";

/** Los dos paneles donde cotizan: los bonos largos y las letras. */
const DATA912 = [
  "https://data912.com/live/arg_bonds",
  "https://data912.com/live/arg_notes",
];

/** CER (id 30) y tipo de cambio mayorista de referencia, el A3500 (id 5). */
const BCRA_CER = "https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/30?limit=60";
const BCRA_A3500 = "https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/5?limit=20";

const REZAGO_CER_HABILES = 10;
const REZAGO_FX_HABILES = 3;

/**
 * Menos de un mes al vencimiento y la TIR anualizada deja de significar algo:
 * un peso de diferencia en el precio mueve el rendimiento decenas de puntos.
 * Esos bonos no entran a la curva —no es que estén mal, es que ya no son curva—.
 */
const DURATION_MINIMA = 0.08;

export interface PuntoArs {
  ticker: string;
  nombre: string;
  /** Lo que cotiza, en pesos por cada 100 VN. */
  precio: number;
  /** El precio dividido por el coeficiente: en unidades constantes. */
  precioAjustado: number;
  /** TIR real (CER) o en dólares (dólar linked), en %. */
  tir: number;
  /** Duration modificada, en años. */
  duration: number;
  vencimiento: string;
}

/** El índice con que se ajusta la curva, y de qué día salió. */
export interface Referencia {
  etiqueta: string;
  fecha: string;
  valor: number;
}

export interface CurvaArs {
  puntos: PuntoArs[];
  referencia: Referencia;
}

// ─── Fechas ─────────────────────────────────────────────────────────────────

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * La fecha de `n` días hábiles antes.
 *
 * No contempla feriados, que correrían el índice un día más: son ~0,07% de
 * coeficiente, dos puntos básicos de TIR en un bono a un año. Contemplarlos
 * pediría un calendario de feriados cambiarios mantenido a mano, que es más
 * superficie de error de la que resuelve.
 */
function habilesAtras(desde: string, n: number): string {
  const d = new Date(`${desde}T00:00:00Z`);
  let quedan = n;
  while (quedan > 0) {
    d.setUTCDate(d.getUTCDate() - 1);
    const dia = d.getUTCDay();
    if (dia !== 0 && dia !== 6) quedan--;
  }
  return iso(d);
}

// ─── Fuentes ────────────────────────────────────────────────────────────────

interface SerieBcra {
  results: { detalle: { fecha: string; valor: number }[] }[];
}

interface Cache<T> {
  valor: T;
  vence: number;
}

declare global {
  var __preciosArsCache: Cache<Map<string, FilaData912>> | undefined;
  var __ajustesArsCache: Cache<{ cer: Map<string, number>; fx: Map<string, number> }> | undefined;
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, {
    headers: { "user-agent": "personal-dashboard", accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`${url} respondió ${r.status}`);
  return r.json() as Promise<T>;
}

/** Los precios de los dos paneles de data912, en un solo mapa. Cacheado 10'. */
async function getPrecios(): Promise<Map<string, FilaData912>> {
  const cache = globalThis.__preciosArsCache;
  if (cache && cache.vence > Date.now()) return cache.valor;

  const paneles = await Promise.all(DATA912.map((u) => getJson<FilaData912[]>(u)));
  const mapa = new Map<string, FilaData912>();
  for (const filas of paneles) for (const f of filas) mapa.set(f.symbol, f);

  globalThis.__preciosArsCache = { valor: mapa, vence: Date.now() + 600_000 };
  return mapa;
}

/**
 * Las dos series del BCRA con que se ajusta. Cacheadas una hora: el CER se
 * publica una vez por día y el A3500 al cierre.
 */
async function getAjustes() {
  const cache = globalThis.__ajustesArsCache;
  if (cache && cache.vence > Date.now()) return cache.valor;

  const [cer, fx] = await Promise.all([
    getJson<SerieBcra>(BCRA_CER),
    getJson<SerieBcra>(BCRA_A3500),
  ]);

  const aMapa = (s: SerieBcra) =>
    new Map((s.results?.[0]?.detalle ?? []).map((d) => [d.fecha, d.valor]));

  const valor = { cer: aMapa(cer), fx: aMapa(fx) };
  if (valor.cer.size === 0 || valor.fx.size === 0) throw new Error("El BCRA no devolvió series");

  globalThis.__ajustesArsCache = { valor, vence: Date.now() + 3_600_000 };
  return valor;
}

/** El valor vigente `n` hábiles atrás, retrocediendo si ese día no se publicó. */
function vigente(serie: Map<string, number>, hoy: string, rezago: number): Referencia | null {
  let fecha = habilesAtras(hoy, rezago);
  for (let i = 0; i < 30 && !serie.has(fecha); i++) fecha = habilesAtras(fecha, 1);
  const valor = serie.get(fecha);
  return valor == null ? null : { etiqueta: "", fecha, valor };
}

// ─── Curvas ─────────────────────────────────────────────────────────────────

/** Un bono listo para entrar a la curva: cronograma, precio y coeficiente. */
interface Candidato {
  ticker: string;
  nombre: string;
  vencimiento: string;
  flujos: { fecha: string; monto: number }[];
  /** Lo que cotiza en data912, o null si hoy no tiene precio. */
  precio: number | null;
  /** Por cuánto multiplica el ajuste cada pago: CER de hoy sobre el de emisión. */
  coeficiente: number;
}

/**
 * El armado es común a las dos curvas: dividir el precio por el coeficiente y
 * sacarle la TIR al cronograma, que ya está en unidades constantes.
 */
function armar(candidatos: Candidato[], hoy: Date): PuntoArs[] {
  const puntos: PuntoArs[] = [];

  for (const c of candidatos) {
    if (c.precio == null || c.precio <= 0) continue;
    if (!Number.isFinite(c.coeficiente) || c.coeficiente <= 0) continue;

    const precioAjustado = c.precio / c.coeficiente;
    const tir = calcularTir(c.flujos, precioAjustado, hoy, CONV_ARS);
    if (tir == null) continue;

    const duration = calcularDuration(c.flujos, tir, hoy, CONV_ARS);
    if (duration == null || duration < DURATION_MINIMA) continue;

    puntos.push({
      ticker: c.ticker,
      nombre: c.nombre,
      precio: c.precio,
      precioAjustado,
      tir: tir * 100,
      duration,
      vencimiento: c.vencimiento,
    });
  }

  return puntos.sort((a, b) => a.duration - b.duration);
}

/**
 * La curva CER: tasa real contra duration.
 *
 * Lo que se lee acá es cuánto paga el Tesoro **por encima de la inflación**.
 * Una curva con pendiente positiva dice que el mercado pide más tasa real para
 * estirar plazo, que es lo normal; una invertida dice que espera que las tasas
 * reales bajen, o que hay algo que apura a los tenedores del tramo corto.
 */
export async function getCurvaCer(hoy = new Date()): Promise<CurvaArs> {
  const [precios, ajustes] = await Promise.all([getPrecios(), getAjustes()]);

  const ref = vigente(ajustes.cer, iso(hoy), REZAGO_CER_HABILES);
  if (!ref) throw new Error("No hay CER publicado para la fecha");

  const candidatos = BONOS_CER.map((b) => ({
    ...b,
    precio: precioDe(precios.get(b.simboloPrecio)),
    coeficiente: ref.valor / b.cerEmision,
  }));

  return { puntos: armar(candidatos, hoy), referencia: { ...ref, etiqueta: "CER" } };
}

/**
 * La curva dólar linked: tasa en dólares oficiales contra duration.
 *
 * Un dólar linked paga lo que se mueva el A3500, así que su TIR es lo que rinde
 * **además** de la devaluación oficial. Comparada contra la de los hard-dollar
 * al mismo plazo, la diferencia es lo que el mercado cobra —o paga— por cubrirse
 * con el dólar oficial en vez de con el financiero.
 */
export async function getCurvaDolarLinked(hoy = new Date()): Promise<CurvaArs> {
  const [precios, ajustes] = await Promise.all([getPrecios(), getAjustes()]);

  const ref = vigente(ajustes.fx, iso(hoy), REZAGO_FX_HABILES);
  if (!ref) throw new Error("No hay A3500 publicado para la fecha");

  // El cronograma de un dólar linked ya está en dólares, así que el
  // coeficiente es directamente el tipo de cambio
  const candidatos = DOLAR_LINKED.map((b) => ({
    ...b,
    precio: precioDe(precios.get(b.simboloPrecio)),
    coeficiente: ref.valor,
  }));

  return { puntos: armar(candidatos, hoy), referencia: { ...ref, etiqueta: "A3500" } };
}
