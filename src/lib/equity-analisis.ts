/**
 * El armado de los paneles cuantitativos: quién le pasa qué a las cuentas.
 *
 * `equity-riesgo` y `equity-valuacion` son funciones puras y no saben de dónde
 * salen sus insumos. Acá se juntan las fuentes —Yahoo para la serie y los
 * estados financieros, FRED para la tasa larga, Finviz para el consenso— y se
 * arma lo que las dos páginas de un ticker dibujan.
 *
 * Todo lo que se pide acá ya está memoizado en su módulo, así que llamar a
 * `waccDe` desde tres bloques distintos no cuesta tres requests: cuesta tres
 * multiplicaciones. Por eso los bloques piden lo que necesitan en vez de
 * recibirlo enhebrado por props desde la página.
 */

import {
  getFicha, getSerie, getSerieFinanciera, getSerieLarga, type Ficha, type SerieFinanciera,
} from "@/lib/equity";
import { fredSerie, ultimo } from "@/lib/fred";
import { getFinviz } from "@/lib/finviz";
import { estimarWacc, type Wacc } from "@/lib/equity-ficha";
import { calcularRiesgo, type Riesgo } from "@/lib/equity-riesgo";
import { armarValuacion, type Referencia, type Valuacion } from "@/lib/equity-valuacion";

/** El ETF contra el que se mide todo: el mercado estadounidense. */
const BENCHMARK = "SPY";

/** Tesoro a 10 años, en %. Es la tasa libre de riesgo de todo el módulo. */
function tasaLarga(): Promise<number | null> {
  return fredSerie("DGS10")
    .then(ultimo)
    .then((u) => u?.valor ?? null)
    .catch(() => null);
}

/**
 * El WACC del papel. Lo piden el cuadro de números, la radiografía y la
 * valuación; las dos fuentes que necesita están memoizadas.
 */
export async function waccDe(ticker: string, ficha: Ficha): Promise<Wacc | null> {
  const [serie, tasa] = await Promise.all([getSerieFinanciera(ticker), tasaLarga()]);

  return estimarWacc({
    beta: ficha.fundamentals.beta,
    capitalizacion: ficha.fundamentals.capitalizacion,
    deudaTotal: serie.deudaTotal,
    interesesPagados: serie.interesesPagados,
    tasaImpositiva: serie.tasaImpositiva,
    tasaLibre: tasa,
  });
}

/**
 * Perfil de riesgo contra el S&P.
 *
 * La serie del benchmark se pide una vez por proceso y se comparte entre todos
 * los tickers, así que el costo real es un request: el del papel.
 */
export async function riesgoDe(ticker: string): Promise<Riesgo | null> {
  const [serie, indice, tasa] = await Promise.all([
    getSerieLarga(ticker),
    getSerieLarga(BENCHMARK).catch(() => null),
    tasaLarga(),
  ]);

  // Un papel que salió a bolsa hace ocho meses no tiene tres años de ruedas.
  // Con lo que haya se calcula igual —la ventana se informa en pantalla—, y si
  // ni siquiera hay un trimestre, `calcularRiesgo` devuelve null.
  if (serie.length < 60) {
    const corta = await getSerie(ticker).catch(() => []);
    return calcularRiesgo(corta, indice, tasa);
  }
  return calcularRiesgo(serie, indice, tasa);
}

/**
 * Crecimiento anual de una serie de ejercicios, en %.
 *
 * No es el CAGR punta a punta, que con cuatro o cinco puntos depende
 * demasiado de los extremos: la caja libre de Apple entre 2022 y 2025 da −3,9%
 * anual por un 2022 alto y un 2025 flojo, cuando lo que hizo fue quedarse
 * quieta. Se ajusta una recta a los logaritmos y se anualiza la pendiente, que
 * usa todos los puntos y aguanta un año malo en el medio.
 *
 * El eje x son los años de cierre y no las posiciones: si falta un ejercicio,
 * el hueco tiene que contar como el año que es.
 */
function crecimientoTendencial(puntos: { periodo: string; valor: number | null }[]): number | null {
  const limpios = puntos
    .map((p) => ({ x: Number(p.periodo), y: p.valor }))
    .filter((p): p is { x: number; y: number } => Number.isFinite(p.x) && p.y != null && p.y > 0);

  // Con dos puntos la recta pasa por los dos y no hay tendencia que estimar:
  // es el CAGR punta a punta con otro nombre. Desde tres, sí.
  if (limpios.length < 3) return null;

  const n = limpios.length;
  const mediaX = limpios.reduce((a, p) => a + p.x, 0) / n;
  const mediaY = limpios.reduce((a, p) => a + Math.log(p.y), 0) / n;
  const sxy = limpios.reduce((a, p) => a + (p.x - mediaX) * (Math.log(p.y) - mediaY), 0);
  const sxx = limpios.reduce((a, p) => a + (p.x - mediaX) ** 2, 0);
  if (sxx === 0) return null;

  return (Math.exp(sxy / sxx) - 1) * 100;
}

/**
 * Los crecimientos con los que se arman los escenarios. Ninguno lo inventa el
 * modelo: cada uno viene de algún lado y se muestra con la fuente al lado.
 *
 * El del consenso es crecimiento de **EPS** y se usa como proxy del de la caja.
 * No son lo mismo —la ganancia contable y el flujo se separan por capex y
 * capital de trabajo—, pero es el único número prospectivo que hay y la ficha
 * lo dice donde se muestra.
 */
function referenciasDe(serie: SerieFinanciera, consenso: number | null): Referencia[] {
  const cerrados = serie.periodos.filter((p) => !p.esUdm);
  const porFcf = crecimientoTendencial(cerrados.map((p) => ({ periodo: p.periodo, valor: p.fcf })));
  const porVentas = crecimientoTendencial(
    cerrados.map((p) => ({ periodo: p.periodo, valor: p.ventas }))
  );

  const refs: Referencia[] = [];
  if (consenso != null) {
    refs.push({
      nombre: "Lo que espera el consenso",
      fuente: "crecimiento de EPS a 5 años, Finviz",
      crecimiento: consenso,
    });
  }
  if (porFcf != null) {
    refs.push({
      nombre: "Lo que viene haciendo",
      fuente: `tendencia de la caja libre, ${cerrados.length} ejercicios`,
      crecimiento: porFcf,
    });
  } else if (porVentas != null) {
    refs.push({
      nombre: "Lo que viene haciendo",
      fuente: `tendencia de las ventas, ${cerrados.length} ejercicios (la caja libre no alcanza para una serie)`,
      crecimiento: porVentas,
    });
  }
  return refs;
}

/**
 * La valuación por flujos: DCF inverso, escenarios y sensibilidad.
 *
 * Dos decisiones sobre los insumos:
 *
 *  - **Las acciones salen de capitalización sobre precio.** Yahoo publica
 *    `sharesOutstanding` en el quote, pero llega desfasado de la capitalización
 *    en las empresas que recompran; el cociente es consistente por construcción
 *    con el precio contra el que se compara el resultado.
 *  - **La deuda neta sale del enterprise value menos la capitalización**, que
 *    es la que el mercado está usando hoy e incluye minoritarios y preferidas.
 *    Cuando Yahoo no publica EV se cae a la del último balance, que es contable
 *    y puede tener meses.
 */
/**
 * Sectores donde descontar caja libre no aplica, y por qué.
 *
 * En un banco el flujo de caja operativo se mueve con los depósitos, los
 * préstamos y la cartera de trading: JP Morgan da −162 mil millones de "caja
 * libre" en los últimos doce meses y no está quemando un peso. Decir "quema
 * caja" ahí sería un error de lectura grave, así que el panel dice qué pasa en
 * vez de mostrar el número.
 */
const SIN_FCF: Partial<Record<Ficha["sector"], string>> = {
  Financials:
    "En un banco o una aseguradora el flujo de caja operativo se mueve con los depósitos, la cartera de créditos y el trading: la caja libre puede dar cientos de miles de millones en negativo sin que la empresa esté quemando un peso. Los flujos descontados de un financiero se hacen sobre dividendos o resultado distribuible, no sobre FCF — acá se lee por múltiplos (P/BV contra ROE) y por la serie de números.",
};

export async function valuacionDe(ticker: string, ficha: Ficha): Promise<Valuacion | null> {
  const [serie, wacc, finviz] = await Promise.all([
    getSerieFinanciera(ticker),
    waccDe(ticker, ficha),
    getFinviz(ticker).catch(() => null),
  ]);

  const f = ficha.fundamentals;
  const udm = [...serie.periodos].reverse().find((p) => p.esUdm);
  const ultimoCerrado = [...serie.periodos].reverse().find((p) => !p.esUdm);
  const cerrados = serie.periodos.filter((p) => !p.esUdm && p.fcf != null);

  const deudaNeta =
    f.enterpriseValue != null && f.capitalizacion != null
      ? f.enterpriseValue - f.capitalizacion
      : (ultimoCerrado?.deudaNeta ?? null);

  return armarValuacion({
    fcf: udm?.fcf ?? ultimoCerrado?.fcf ?? null,
    fcfPromedio: cerrados.length
      ? cerrados.reduce((a, p) => a + p.fcf!, 0) / cerrados.length
      : null,
    wacc: wacc?.wacc ?? null,
    deudaNeta,
    acciones: f.capitalizacion != null && ficha.precio ? f.capitalizacion / ficha.precio : null,
    precio: ficha.precio,
    referencias: referenciasDe(serie, finviz?.epsProximos5 ?? null),
    motivoNoAplica: SIN_FCF[ficha.sector] ?? null,
  });
}

/** Lo que la página de la empresa dibuja junto al precio objetivo del consenso. */
export async function analisisDe(ticker: string) {
  const ficha = await getFicha(ticker);
  if (!ficha) return null;
  const [riesgo, valuacion] = await Promise.all([
    riesgoDe(ticker).catch(() => null),
    valuacionDe(ticker, ficha).catch(() => null),
  ]);
  return { ficha, riesgo, valuacion };
}
