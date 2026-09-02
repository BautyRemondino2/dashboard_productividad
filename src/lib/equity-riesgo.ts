/**
 * Riesgo de un papel: lo que los retornos por período no dicen.
 *
 * El panel de retornos contesta *cuánto* ganó. No contesta *cuánto hubo que
 * aguantar para ganarlo*, que es la otra mitad de la decisión: un papel que
 * hizo +40% en el año con una caída del 55% en el medio y otro que hizo +40%
 * derecho no son la misma inversión, y en la tabla del ranking se ven iguales.
 *
 * Todo sale de la serie de cierres diarios que la página ya baja. Son cuentas,
 * no una fuente nueva: no hay API que pueda estar caída.
 *
 * ## Decisiones que cambian los números
 *
 *  - **Retornos simples, no logarítmicos.** Los log son más prolijos para
 *    componer, pero el desvío que sale de ellos no es el que reporta ningún
 *    proveedor. Con volatilidades de acciones la diferencia es de decimales.
 *  - **252 ruedas por año.** La convención; el año bursátil real oscila entre
 *    250 y 253.
 *  - **Cierres sin ajustar por dividendos.** Es lo que trae `getSerie`. En
 *    volatilidad y beta no mueve la aguja; en el retorno acumulado de un papel
 *    que paga 4% al año, sí: ese retorno queda subestimado y acá se aclara.
 *  - **Beta propia, no la de Yahoo.** Yahoo publica una beta de 5 años
 *    mensuales contra el S&P; esta se calcula con las ruedas de la ventana que
 *    se está mirando. Cuando difieren, la diferencia es información: el papel
 *    cambió de comportamiento.
 */

import type { Cierre } from "@/lib/equity";

/** Ruedas por año: la convención del mercado estadounidense. */
const RUEDAS_AÑO = 252;

export interface Drawdown {
  /** Caída máxima punta a punta, en % (negativa). */
  caida: number;
  /** Fecha del máximo previo a la caída. */
  pico: string;
  /** Fecha del piso. */
  valle: string;
  /** Ruedas del pico al valle. */
  ruedasCaida: number;
  /** Si volvió a superar el pico dentro de la ventana. */
  recuperado: boolean;
  /** Ruedas del valle a la recuperación. Null si todavía no recuperó. */
  ruedasRecuperacion: number | null;
}

export interface MesExtremo {
  /** `2025-04`. */
  mes: string;
  retorno: number;
}

export interface Riesgo {
  desde: string;
  hasta: string;
  ruedas: number;
  /** Años calendario que cubre la ventana. */
  años: number;

  /** Retorno anualizado de la ventana (CAGR), en %. */
  retornoAnualizado: number;
  /** Desvío de los retornos diarios anualizado, en %. */
  volatilidad: number;
  /** Volatilidad de las últimas 60 ruedas, anualizada. Contra la de la ventana. */
  volatilidadReciente: number | null;
  /** Retorno excedente sobre la tasa libre por unidad de riesgo. Null sin tasa. */
  sharpe: number | null;
  /** Sharpe contando sólo la volatilidad de las bajas. */
  sortino: number | null;

  /** Sensibilidad al índice, calculada sobre esta ventana. */
  beta: number | null;
  /** Retorno que no explica el índice, anualizado y en %. */
  alfa: number | null;
  correlacion: number | null;
  /** Cuánto del movimiento explica el índice, en %. */
  r2: number | null;
  /** De cada 100% que subió el índice, cuánto subió el papel. */
  capturaAlza: number | null;
  /** De cada 100% que bajó el índice, cuánto bajó el papel. */
  capturaBaja: number | null;

  peorCaida: Drawdown | null;
  /** Cuánto está hoy por debajo de su máximo de la ventana, en % (≤ 0). */
  desdeMaximo: number;
  /** Ruedas que cerraron en verde, en %. */
  ruedasPositivas: number;
  /** El movimiento diario que sólo se supera una rueda de cada veinte, en %. */
  diaExtremo: number;
  mejorMes: MesExtremo | null;
  peorMes: MesExtremo | null;

  /** El mismo cálculo sobre el índice, para tener contra qué leer. */
  indice: { retornoAnualizado: number; volatilidad: number; peorCaida: number | null } | null;
}

// ─── Cuentas ────────────────────────────────────────────────────────────────

const promedio = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Desvío muestral (n−1): la ventana es una muestra, no la población entera. */
function desvio(xs: number[], media = promedio(xs)): number {
  if (xs.length < 2) return 0;
  const suma = xs.reduce((a, x) => a + (x - media) ** 2, 0);
  return Math.sqrt(suma / (xs.length - 1));
}

/** Variación diaria simple de una serie de cierres. */
function variaciones(serie: Cierre[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < serie.length; i++) {
    const previo = serie[i - 1].close;
    if (previo > 0) out.push(serie[i].close / previo - 1);
  }
  return out;
}

/** El percentil p (0–1) de una muestra, interpolando entre los dos vecinos. */
function percentil(xs: number[], p: number): number {
  const orden = [...xs].sort((a, b) => a - b);
  const i = (orden.length - 1) * p;
  const bajo = Math.floor(i);
  const alto = Math.ceil(i);
  return bajo === alto ? orden[bajo] : orden[bajo] + (orden[alto] - orden[bajo]) * (i - bajo);
}

/**
 * La peor caída punta a punta de la ventana.
 *
 * Se recorre una vez llevando el máximo hasta acá: cada vez que el precio queda
 * por debajo, se mide contra ese máximo. Lo que importa además de la magnitud
 * es si recuperó y cuánto tardó — una caída del 40% de la que se sale en tres
 * meses y otra de la que no se salió en dos años no son el mismo riesgo.
 */
function peorCaida(serie: Cierre[]): Drawdown | null {
  if (serie.length < 2) return null;

  let maximo = serie[0].close;
  let iMaximo = 0;
  let peor = 0;
  let iPico = 0;
  let iValle = 0;

  for (let i = 1; i < serie.length; i++) {
    const c = serie[i].close;
    if (c > maximo) {
      maximo = c;
      iMaximo = i;
      continue;
    }
    const caida = (c / maximo - 1) * 100;
    if (caida < peor) {
      peor = caida;
      iPico = iMaximo;
      iValle = i;
    }
  }

  if (peor === 0) return null;

  // Recuperado = volvió a cerrar arriba del pico en algún momento posterior.
  const nivelPico = serie[iPico].close;
  let iRecuperacion: number | null = null;
  for (let i = iValle + 1; i < serie.length; i++) {
    if (serie[i].close >= nivelPico) {
      iRecuperacion = i;
      break;
    }
  }

  return {
    caida: peor,
    pico: serie[iPico].fecha,
    valle: serie[iValle].fecha,
    ruedasCaida: iValle - iPico,
    recuperado: iRecuperacion != null,
    ruedasRecuperacion: iRecuperacion == null ? null : iRecuperacion - iValle,
  };
}

/** Retorno de cada mes calendario completo, sobre el último cierre de cada mes. */
function retornosMensuales(serie: Cierre[]): MesExtremo[] {
  const cierreDeMes = new Map<string, number>();
  for (const c of serie) cierreDeMes.set(c.fecha.slice(0, 7), c.close);

  const meses = [...cierreDeMes.keys()].sort();
  const out: MesExtremo[] = [];
  for (let i = 1; i < meses.length; i++) {
    const previo = cierreDeMes.get(meses[i - 1])!;
    if (previo > 0) out.push({ mes: meses[i], retorno: (cierreDeMes.get(meses[i])! / previo - 1) * 100 });
  }
  return out;
}

/** Deja las dos series con las mismas fechas: sin eso la beta compara peras con manzanas. */
function alinear(a: Cierre[], b: Cierre[]): { a: Cierre[]; b: Cierre[] } {
  const enB = new Map(b.map((c) => [c.fecha, c]));
  const comunes = a.filter((c) => enB.has(c.fecha));
  return { a: comunes, b: comunes.map((c) => enB.get(c.fecha)!) };
}

// ─── El cálculo ─────────────────────────────────────────────────────────────

/**
 * Perfil de riesgo de un papel sobre su serie de cierres.
 *
 * @param serie   Cierres diarios del papel, ordenados de viejo a nuevo.
 * @param indice  Cierres del benchmark (el S&P). Sin él no hay beta ni alfa.
 * @param tasaLibre Tesoro a 10 años en %, para el Sharpe. Sin ella no se estima:
 *                  un Sharpe con tasa cero infla el número y no se nota.
 */
export function calcularRiesgo(
  serie: Cierre[],
  indice: Cierre[] | null,
  tasaLibre: number | null
): Riesgo | null {
  // Menos de un trimestre de ruedas no alcanza para un desvío que signifique algo.
  if (serie.length < 60) return null;

  const r = variaciones(serie);
  const media = promedio(r);
  const sd = desvio(r, media);

  const primera = serie[0];
  const ultima = serie[serie.length - 1];
  const años =
    (Date.parse(ultima.fecha) - Date.parse(primera.fecha)) / (365.25 * 24 * 3600 * 1000);

  const retornoAnualizado =
    años > 0 && primera.close > 0 ? ((ultima.close / primera.close) ** (1 / años) - 1) * 100 : 0;
  const volatilidad = sd * Math.sqrt(RUEDAS_AÑO) * 100;

  const ultimas60 = r.slice(-60);
  const volatilidadReciente =
    ultimas60.length >= 40 ? desvio(ultimas60) * Math.sqrt(RUEDAS_AÑO) * 100 : null;

  // Sharpe y Sortino contra la tasa libre: lo que rindió por encima de no
  // arriesgar nada, dividido por lo que se movió para conseguirlo.
  const exceso = tasaLibre == null ? null : retornoAnualizado - tasaLibre;
  const sharpe = exceso == null || volatilidad === 0 ? null : exceso / volatilidad;

  // Desvío de las bajas solamente: la volatilidad para arriba no molesta a nadie.
  const bajas = r.filter((x) => x < 0);
  const desvioBaja =
    bajas.length >= 20 ? Math.sqrt(promedio(bajas.map((x) => x ** 2))) * Math.sqrt(RUEDAS_AÑO) * 100 : null;
  const sortino = exceso == null || !desvioBaja ? null : exceso / desvioBaja;

  const maximo = Math.max(...serie.map((c) => c.close));

  const mensuales = retornosMensuales(serie);
  const ordenados = [...mensuales].sort((a, b) => b.retorno - a.retorno);

  // ── Contra el índice ──────────────────────────────────────────────────────
  let beta: number | null = null;
  let alfa: number | null = null;
  let correlacion: number | null = null;
  let r2: number | null = null;
  let capturaAlza: number | null = null;
  let capturaBaja: number | null = null;
  let resumenIndice: Riesgo["indice"] = null;

  if (indice && indice.length >= 60) {
    const par = alinear(serie, indice);
    if (par.a.length >= 60) {
      const rp = variaciones(par.a);
      const rb = variaciones(par.b);
      const mp = promedio(rp);
      const mb = promedio(rb);

      const covar = rp.reduce((a, x, i) => a + (x - mp) * (rb[i] - mb), 0) / (rp.length - 1);
      const varb = desvio(rb, mb) ** 2;
      const sdp = desvio(rp, mp);
      const sdb = Math.sqrt(varb);

      if (varb > 0) {
        beta = covar / varb;
        // Alfa de Jensen, anualizado: lo que rindió por encima de lo que su
        // exposición al índice explica. La tasa libre se pasa a diaria.
        const rf = tasaLibre == null ? 0 : tasaLibre / 100 / RUEDAS_AÑO;
        alfa = (mp - rf - beta * (mb - rf)) * RUEDAS_AÑO * 100;
      }
      if (sdp > 0 && sdb > 0) {
        correlacion = covar / (sdp * sdb);
        r2 = correlacion ** 2 * 100;
      }

      // Captura: cómo se comporta el papel las ruedas que el índice sube y las
      // que baja. Un papel defensivo captura poco de las dos; uno apalancado,
      // mucho de las dos. La asimetría entre ambas es lo que se busca.
      const subas = rp.filter((_, i) => rb[i] > 0);
      const basesSuba = rb.filter((x) => x > 0);
      const bajasP = rp.filter((_, i) => rb[i] < 0);
      const basesBaja = rb.filter((x) => x < 0);
      if (basesSuba.length >= 20) capturaAlza = (promedio(subas) / promedio(basesSuba)) * 100;
      if (basesBaja.length >= 20) capturaBaja = (promedio(bajasP) / promedio(basesBaja)) * 100;

      const primeraB = par.b[0];
      const ultimaB = par.b[par.b.length - 1];
      resumenIndice = {
        retornoAnualizado:
          años > 0 && primeraB.close > 0 ? ((ultimaB.close / primeraB.close) ** (1 / años) - 1) * 100 : 0,
        volatilidad: sdb * Math.sqrt(RUEDAS_AÑO) * 100,
        peorCaida: peorCaida(par.b)?.caida ?? null,
      };
    }
  }

  return {
    desde: primera.fecha,
    hasta: ultima.fecha,
    ruedas: serie.length,
    años,
    retornoAnualizado,
    volatilidad,
    volatilidadReciente,
    sharpe,
    sortino,
    beta,
    alfa,
    correlacion,
    r2,
    capturaAlza,
    capturaBaja,
    peorCaida: peorCaida(serie),
    desdeMaximo: maximo > 0 ? (ultima.close / maximo - 1) * 100 : 0,
    ruedasPositivas: (r.filter((x) => x > 0).length / r.length) * 100,
    diaExtremo: percentil(r.map(Math.abs), 0.95) * 100,
    mejorMes: ordenados[0] ?? null,
    peorMes: ordenados[ordenados.length - 1] ?? null,
    indice: resumenIndice,
  };
}

// ─── La lectura ─────────────────────────────────────────────────────────────

/**
 * Qué dicen los números, en dos o tres oraciones.
 *
 * Los umbrales son generales y valen como orden de magnitud: una volatilidad
 * del 35% es alta para una utility y baja para una biotecnológica. Lo que la
 * lectura sí puede afirmar sin contexto sectorial son las relaciones —captura
 * más de las bajas que de las subas, el índice explica poco de lo que hace— y
 * eso es lo que dice.
 */
export function leerRiesgo(r: Riesgo): string[] {
  const out: string[] = [];
  const pct = (v: number, d = 0) => `${v.toFixed(d).replace(".", ",")}%`;

  const nivel =
    r.volatilidad > 60 ? "muy alta" : r.volatilidad > 40 ? "alta" : r.volatilidad > 25 ? "normal para una acción" : "contenida para una acción";
  const vsIndice = r.indice ? ` — ${(r.volatilidad / r.indice.volatilidad).toFixed(1).replace(".", ",")}× la del S&P` : "";
  out.push(
    `Se mueve ${pct(r.volatilidad)} anual, ${nivel}${vsIndice}. Una rueda de cada veinte se movió más de ${pct(r.diaExtremo, 1)}.`
  );

  if (r.peorCaida) {
    const d = r.peorCaida;
    const cuanto = `${pct(Math.abs(d.caida), 0)}`;
    const cierre = d.recuperado
      ? `y tardó ${d.ruedasRecuperacion} ruedas en volver al punto de partida`
      : `y todavía no volvió a ese nivel`;
    out.push(`La peor caída de la ventana fue de ${cuanto}, ${cierre}.`);
  }

  if (r.beta != null && r.r2 != null) {
    const dependencia =
      r.r2 > 70 ? "va pegado al índice" : r.r2 > 40 ? "sigue al índice a medias" : "hace bastante la suya";
    out.push(
      `Beta ${r.beta.toFixed(2).replace(".", ",")}: ${dependencia} — el S&P explica ${pct(r.r2)} de lo que hace, el resto es de la empresa.`
    );
  }

  if (r.capturaAlza != null && r.capturaBaja != null) {
    const asimetria = r.capturaAlza - r.capturaBaja;
    if (Math.abs(asimetria) >= 15) {
      out.push(
        asimetria > 0
          ? `Captura ${pct(r.capturaAlza)} de las subas del índice y ${pct(r.capturaBaja)} de las bajas: la asimetría juega a favor.`
          : `Captura ${pct(r.capturaAlza)} de las subas del índice pero ${pct(r.capturaBaja)} de las bajas: cae más de lo que sube.`
      );
    }
  }

  return out;
}
