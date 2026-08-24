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

export interface Flujo {
  /** Fecha de pago, ISO. */
  fecha: string;
  /** Renta por cada 100 de valor nominal residual. */
  cupon: number;
  /** Amortización por cada 100 de valor nominal original. */
  amortizacion: number;
}

export interface EsquemaBono {
  ticker: string;
  nombre: string;
  ley: "AR" | "NY";
  /** Año de vencimiento, para ordenar la curva. */
  vencimiento: number;
  flujos: Flujo[];
}

// ─── Armado de esquemas ─────────────────────────────────────────────────────

/**
 * Los bonos del canje 2020 comparten estructura: pagan el 9 de enero y el 9 de
 * julio, amortizan en cuotas iguales desde una fecha, y el cupón sube por
 * tramos. Se declara eso y se expanden los flujos.
 */
function construir(
  ticker: string,
  nombre: string,
  ley: "AR" | "NY",
  opciones: {
    /** Primera cuota de capital, y cuántas son. */
    amortizaDesde: string;
    cuotas: number;
    /** Cupón anual vigente desde cada fecha, en %. */
    cupones: { desde: string; tasa: number }[];
    vencimiento: number;
  }
): EsquemaBono {
  const { amortizaDesde, cuotas, cupones, vencimiento } = opciones;

  const [añoIni, mesIni] = amortizaDesde.split("-").map(Number);
  const fechas: string[] = [];
  let año = añoIni;
  let mes = mesIni;
  for (let i = 0; i < cuotas; i++) {
    fechas.push(`${año}-${String(mes).padStart(2, "0")}-09`);
    mes += 6;
    if (mes > 12) { mes -= 12; año += 1; }
  }

  // La renta se paga desde el primer semestre posterior a hoy hasta el final,
  // aunque el capital todavía no haya empezado a amortizar
  const primeraRenta = cupones[0].desde;
  const [añoR, mesR] = primeraRenta.split("-").map(Number);
  const fechasRenta: string[] = [];
  let aR = añoR, mR = mesR;
  const ultima = fechas[fechas.length - 1];
  while (`${aR}-${String(mR).padStart(2, "0")}-09` <= ultima) {
    fechasRenta.push(`${aR}-${String(mR).padStart(2, "0")}-09`);
    mR += 6;
    if (mR > 12) { mR -= 12; aR += 1; }
  }

  const cuota = 100 / cuotas;
  const flujos: Flujo[] = [];

  for (const fecha of fechasRenta) {
    // Capital que sigue vivo justo antes de este pago
    const amortizado = fechas.filter((f) => f < fecha).length * cuota;
    const residual = Math.max(0, 100 - amortizado);

    const tasa = [...cupones].reverse().find((c) => c.desde <= fecha)?.tasa ?? 0;
    const amortiza = fechas.includes(fecha) ? cuota : 0;

    flujos.push({
      fecha,
      cupon: (residual * tasa) / 100 / 2, // semestral
      amortizacion: amortiza,
    });
  }

  return { ticker, nombre, ley, vencimiento, flujos };
}

/**
 * Los soberanos del canje 2020.
 *
 * Sólo importan los cupones vigentes de acá en adelante: los tramos anteriores
 * ya se pagaron y no entran en el cálculo. Cada par Global/Bonar comparte
 * condiciones económicas y se diferencia sólo por la ley aplicable.
 */
const CONDICIONES = [
  { base: "29", venc: 2029, amortizaDesde: "2025-07", cuotas: 10,
    cupones: [{ desde: "2021-07", tasa: 1.0 }] },
  { base: "30", venc: 2030, amortizaDesde: "2024-07", cuotas: 13,
    cupones: [{ desde: "2023-07", tasa: 0.75 }, { desde: "2027-07", tasa: 1.75 }] },
  { base: "35", venc: 2035, amortizaDesde: "2031-07", cuotas: 10,
    cupones: [{ desde: "2024-07", tasa: 4.125 }, { desde: "2027-07", tasa: 4.375 }] },
  { base: "38", venc: 2038, amortizaDesde: "2027-01", cuotas: 22,
    cupones: [{ desde: "2023-07", tasa: 4.25 }] },
  { base: "41", venc: 2041, amortizaDesde: "2028-07", cuotas: 28,
    cupones: [{ desde: "2022-07", tasa: 3.5 }, { desde: "2029-07", tasa: 4.875 }] },
  { base: "46", venc: 2046, amortizaDesde: "2025-07", cuotas: 44,
    cupones: [{ desde: "2024-07", tasa: 4.125 }, { desde: "2027-07", tasa: 4.375 }] },
];

/** Qué ticker existe para cada ley. El 46 no tiene par en ley argentina. */
const TICKERS: Record<string, { NY: string; AR: string | null; nombre: string }> = {
  "29": { NY: "GD29", AR: "AL29", nombre: "2029" },
  "30": { NY: "GD30", AR: "AL30", nombre: "2030" },
  "35": { NY: "GD35", AR: "AL35", nombre: "2035" },
  "38": { NY: "GD38", AR: "AE38", nombre: "2038" },
  "41": { NY: "GD41", AR: "AL41", nombre: "2041" },
  "46": { NY: "GD46", AR: null, nombre: "2046" },
};

export const ESQUEMAS: Record<string, EsquemaBono> = {};
for (const c of CONDICIONES) {
  const t = TICKERS[c.base];
  for (const ley of ["NY", "AR"] as const) {
    const ticker = t[ley];
    if (!ticker) continue;
    ESQUEMAS[ticker] = construir(
      ticker,
      `${ley === "NY" ? "Global" : "Bonar"} ${t.nombre}`,
      ley,
      { amortizaDesde: c.amortizaDesde, cuotas: c.cuotas, cupones: c.cupones, vencimiento: c.venc }
    );
  }
}

// ─── Cálculo ────────────────────────────────────────────────────────────────

const DIAS_AÑO = 365;

function añosHasta(desde: Date, fecha: string): number {
  return (new Date(`${fecha}T00:00:00Z`).getTime() - desde.getTime()) / (DIAS_AÑO * 86400000);
}

/** Valor presente de los flujos futuros a una tasa dada. */
function valorPresente(flujos: Flujo[], tasa: number, hoy: Date): number {
  let vp = 0;
  for (const f of flujos) {
    const t = añosHasta(hoy, f.fecha);
    if (t <= 0) continue;
    vp += (f.cupon + f.amortizacion) / Math.pow(1 + tasa, t);
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

/** Duration modificada: cuánto cae el precio por cada punto que sube la tasa. */
export function calcularDuration(flujos: Flujo[], tir: number, hoy = new Date()): number | null {
  const vp = valorPresente(flujos, tir, hoy);
  if (vp <= 0) return null;

  let ponderado = 0;
  for (const f of flujos) {
    const t = añosHasta(hoy, f.fecha);
    if (t <= 0) continue;
    ponderado += (t * (f.cupon + f.amortizacion)) / Math.pow(1 + tir, t);
  }
  const macaulay = ponderado / vp;
  return macaulay / (1 + tir);
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
