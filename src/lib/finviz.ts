/**
 * Finviz — la foto de mercado de un papel.
 *
 * Trae lo que Yahoo no da y que hace falta para leer qué está pasando con una
 * acción: **PEG y crecimiento esperado a 5 años** del consenso, **short float**,
 * **insiders e institucionales** (tenencia y movimiento del trimestre), la
 * **posición contra las medias móviles** y el **RSI**, la sorpresa del último
 * balance y el precio objetivo. Todo eso está en la tabla de la ficha de
 * `finviz.com/quote.ashx?t=TICKER`, que `robots.txt` no bloquea (sí bloquea
 * `/export`, `/screener?*` y los gráficos: de ahí no se saca nada).
 *
 * ## Cómo se lee
 *
 * La página es HTML: no hay API pública. La tabla de métricas son celdas
 * alternadas etiqueta/valor, unas noventa por papel. Se guardan **todas** en
 * crudo y aparte se parsean las que usa la lectura; así, cuando haga falta una
 * más, ya está bajada.
 *
 * Formatos que hay que desarmar, con su trampa:
 *  - `4760.77B` → sufijos B/M/K, en escala inglesa (B = mil millones).
 *  - `344.57 -5.33%` → dos valores en una celda: nivel y distancia (52W).
 *  - `2.10 (0.36%)` → dividendo y su rendimiento.
 *  - `39.86% 18.41%` → 3 años y 5 años en la misma celda.
 *  - `-` → sin dato. **No es cero**: una empresa sin dividendo y una que lo
 *    cortó se leen distinto, y `Number("-")` da NaN, no null.
 *
 * ## Fragilidad, asumida
 *
 * Es scraping: el día que Finviz cambie el HTML, el parseo devuelve menos
 * métricas y la radiografía no se dibuja. Es a propósito —mejor sin panel que
 * con números inventados— y por eso `getFinviz` exige un mínimo de métricas
 * conocidas antes de dar por buena una respuesta.
 *
 * Caché en memoria de 30 minutos (patrón equity, sin DB): la ficha se abre para
 * leerla un rato, no para refrescar un precio.
 */

const BASE = "https://finviz.com/quote.ashx?t=";
const TIMEOUT_MS = 12_000;

/** Debajo de esto, lo que volvió no es la tabla que esperábamos. */
const MINIMO_METRICAS = 40;

// ─── Caché en memoria (patrón equity) ────────────────────────────────────────

interface Entrada<T> {
  valor: T;
  vence: number;
}

declare global {
  var __finvizCache: Map<string, Entrada<unknown>> | undefined;
}

const cache = (globalThis.__finvizCache ??= new Map<string, Entrada<unknown>>());

async function memo<T>(clave: string, ttlSegundos: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(clave);
  if (hit && hit.vence > Date.now()) return hit.valor as T;

  const promesa = fn();
  cache.set(clave, { valor: promesa, vence: Date.now() + ttlSegundos * 1000 });
  try {
    return await promesa;
  } catch (e) {
    cache.delete(clave);
    throw e;
  }
}

// ─── Parseo de valores ───────────────────────────────────────────────────────

const SIN_DATO = new Set(["-", "", "—", "N/A"]);

/** Un número suelto: `37.40`, `-5.02%`, `4760.77B`. Null si no hay dato. */
export function numeroFinviz(v: string | undefined): number | null {
  if (v == null) return null;
  const t = v.trim();
  if (SIN_DATO.has(t)) return null;

  const m = t.match(/^(-?[\d.,]+)\s*([BMK])?%?$/);
  if (!m) return null;

  const base = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(base)) return null;

  const escala = m[2] === "B" ? 1e9 : m[2] === "M" ? 1e6 : m[2] === "K" ? 1e3 : 1;
  return base * escala;
}

/** Celdas con dos números: `344.57 -5.33%`, `39.86% 18.41%`. */
function dosNumeros(v: string | undefined): [number | null, number | null] {
  const partes = (v ?? "").trim().split(/\s+/);
  return [numeroFinviz(partes[0]), numeroFinviz(partes[1])];
}

/** `2.10 (0.36%)` → monto y rendimiento. */
function dividendo(v: string | undefined): { monto: number | null; yield: number | null } {
  const m = (v ?? "").match(/^([\d.]+)\s*\(([\d.]+)%\)$/);
  return m
    ? { monto: Number(m[1]), yield: Number(m[2]) }
    : { monto: numeroFinviz(v), yield: null };
}

// ─── Lo que se usa ───────────────────────────────────────────────────────────

export interface MetricasFinviz {
  /** Todas las celdas tal como vinieron, por si hace falta una que no esté acá. */
  crudas: Record<string, string>;

  capitalizacion: number | null;
  enterpriseValue: number | null;
  ventas: number | null;

  // Valuación
  per: number | null;
  perForward: number | null;
  peg: number | null;
  precioVentas: number | null;
  precioLibros: number | null;
  precioFcf: number | null;
  evEbitda: number | null;

  // Crecimiento (todo en %)
  epsEsteAño: number | null;
  epsProximoAño: number | null;
  /** Lo que el consenso espera por año para los próximos cinco. */
  epsProximos5: number | null;
  epsPasado5: number | null;
  ventasPasado5: number | null;
  epsTtm: number | null;
  ventasTtm: number | null;
  epsTrimestre: number | null;
  ventasTrimestre: number | null;

  // Rentabilidad (en %)
  roa: number | null;
  roe: number | null;
  roic: number | null;
  margenBruto: number | null;
  margenOperativo: number | null;
  margenNeto: number | null;

  // Balance
  deudaPatrimonio: number | null;
  liquidezSeca: number | null;
  liquidezCorriente: number | null;

  // Posicionamiento (en %)
  insiderTenencia: number | null;
  insiderMovimiento: number | null;
  institucionalTenencia: number | null;
  institucionalMovimiento: number | null;
  shortFloat: number | null;
  /** Días de volumen que tardaría en recomprarse el corto. */
  shortRatio: number | null;

  // Tape
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  maximo52: number | null;
  /** Distancia al máximo de 52 semanas, negativa. */
  desdeMaximo52: number | null;
  minimo52: number | null;
  /** Distancia sobre el mínimo de 52 semanas, positiva. */
  desdeMinimo52: number | null;
  rsi: number | null;
  beta: number | null;
  volatilidadSemana: number | null;
  volumenRelativo: number | null;

  // Performance (en %)
  perfSemana: number | null;
  perfMes: number | null;
  perfTrimestre: number | null;
  perfYtd: number | null;
  perfAño: number | null;
  perf3Años: number | null;

  // Consenso y eventos
  /** 1 = compra fuerte, 5 = venta. */
  recomendacion: number | null;
  precioObjetivo: number | null;
  /** Sorpresa de EPS del último balance, en %. Negativa = le erró para abajo. */
  sorpresaEps: number | null;
  sorpresaVentas: number | null;
  /** Cómo lo publica Finviz: `Jul 29 AMC`. */
  ultimoBalance: string | null;

  dividendo: { monto: number | null; yield: number | null };
  payout: number | null;
  empleados: number | null;
}

/**
 * Las celdas de la tabla de métricas: son `<td>` alternados etiqueta/valor.
 *
 * Se corta el HTML desde `snapshot-table2` —la tabla de fundamentals— para no
 * levantar las tablas de noticias ni la de insiders, que tienen otra forma.
 */
function celdas(html: string): Record<string, string> {
  const i = html.indexOf("snapshot-table2");
  if (i < 0) return {};

  const trozo = html.slice(i, i + 60_000);
  const limpias = [...trozo.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
    m[1]
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim()
  );

  const out: Record<string, string> = {};
  for (let j = 0; j + 1 < limpias.length; j += 2) {
    if (limpias[j]) out[limpias[j]] = limpias[j + 1];
  }
  return out;
}

function armar(crudas: Record<string, string>): MetricasFinviz {
  const v = (k: string) => numeroFinviz(crudas[k]);
  const [max52, desdeMax] = dosNumeros(crudas["52W High"]);
  const [min52, desdeMin] = dosNumeros(crudas["52W Low"]);
  const [, epsPasado5] = dosNumeros(crudas["EPS past 3/5Y"]);
  const [, ventasPasado5] = dosNumeros(crudas["Sales past 3/5Y"]);
  const [sorpresaEps, sorpresaVentas] = dosNumeros(crudas["EPS/Sales Surpr."]);
  const [volatilidadSemana] = dosNumeros(crudas["Volatility"]);

  return {
    crudas,
    capitalizacion: v("Market Cap"),
    enterpriseValue: v("Enterprise Value"),
    ventas: v("Sales"),

    per: v("P/E"),
    perForward: v("Forward P/E"),
    peg: v("PEG"),
    precioVentas: v("P/S"),
    precioLibros: v("P/B"),
    precioFcf: v("P/FCF"),
    evEbitda: v("EV/EBITDA"),

    epsEsteAño: v("EPS this Y"),
    epsProximoAño: v("EPS next Y"),
    epsProximos5: v("EPS next 5Y"),
    epsPasado5,
    ventasPasado5,
    epsTtm: v("EPS Y/Y TTM"),
    ventasTtm: v("Sales Y/Y TTM"),
    epsTrimestre: v("EPS Q/Q"),
    ventasTrimestre: v("Sales Q/Q"),

    roa: v("ROA"),
    roe: v("ROE"),
    roic: v("ROIC"),
    margenBruto: v("Gross Margin"),
    margenOperativo: v("Oper. Margin"),
    margenNeto: v("Profit Margin"),

    deudaPatrimonio: v("Debt/Eq"),
    liquidezSeca: v("Quick Ratio"),
    liquidezCorriente: v("Current Ratio"),

    insiderTenencia: v("Insider Own"),
    insiderMovimiento: v("Insider Trans"),
    institucionalTenencia: v("Inst Own"),
    institucionalMovimiento: v("Inst Trans"),
    shortFloat: v("Short Float"),
    shortRatio: v("Short Ratio"),

    sma20: v("SMA20"),
    sma50: v("SMA50"),
    sma200: v("SMA200"),
    maximo52: max52,
    desdeMaximo52: desdeMax,
    minimo52: min52,
    desdeMinimo52: desdeMin,
    rsi: v("RSI (14)"),
    beta: v("Beta"),
    volatilidadSemana,
    volumenRelativo: v("Rel Volume"),

    perfSemana: v("Perf Week"),
    perfMes: v("Perf Month"),
    perfTrimestre: v("Perf Quarter"),
    perfYtd: v("Perf YTD"),
    perfAño: v("Perf Year"),
    perf3Años: v("Perf 3Y"),

    recomendacion: v("Recom"),
    precioObjetivo: v("Target Price"),
    sorpresaEps,
    sorpresaVentas,
    ultimoBalance: crudas["Earnings"] || null,

    dividendo: dividendo(crudas["Dividend TTM"]),
    payout: v("Payout"),
    empleados: v("Employees"),
  };
}

/** La foto de Finviz de un papel. Cacheada media hora. */
export function getFinviz(ticker: string): Promise<MetricasFinviz> {
  return memo(`finviz:${ticker}`, 1800, async () => {
    const res = await fetch(`${BASE}${encodeURIComponent(ticker)}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
      headers: {
        // Sin esto contesta igual, pero identificarse es lo correcto con un
        // sitio gratuito del que se leen dos páginas por sesión.
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        accept: "text/html",
      },
    });
    if (!res.ok) throw new Error(`Finviz ${ticker} HTTP ${res.status}`);

    const crudas = celdas(await res.text());
    if (Object.keys(crudas).length < MINIMO_METRICAS) {
      throw new Error(`Finviz ${ticker}: la tabla vino con ${Object.keys(crudas).length} métricas`);
    }
    return armar(crudas);
  });
}
