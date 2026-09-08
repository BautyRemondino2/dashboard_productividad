/**
 * SEC EDGAR — los balances como los reportó la empresa.
 *
 * Yahoo publica **cinco ejercicios y no diez**: pedirle a `fundamentalsTimeSeries`
 * desde 2014 devuelve lo mismo que pedirle desde 2021. Eso se paga en todo el
 * análisis cuantitativo. El caso que lo dejó a la vista: la tendencia de la caja
 * libre de Apple sobre cuatro puntos daba −3,9% anual, cuando lo que hizo fue
 * quedarse quieta; con cuatro observaciones cualquier año flojo en la punta
 * mueve la conclusión entera.
 *
 * La SEC publica lo mismo pero completo, gratis y sin clave: cada 10-K se
 * presenta etiquetado en XBRL y `data.sec.gov` lo devuelve como JSON. **Es la
 * fuente de la que derivan Yahoo, Google y el resto** — no un proveedor más,
 * sino el original. De Apple salen 19 ejercicios (2007–2025); de GitLab, los 7
 * que lleva cotizando.
 *
 * ## Qué pedir
 *
 * `companyfacts` trae todo en una request pero pesa 3,8 MB en Apple. Se usa
 * `companyconcept`, que es una request por concepto y pesa entre 2 y 18 KB: seis
 * pedidos en paralelo contra un JSON de cuatro megas que hay que parsear entero.
 *
 * ## Las tres trampas del XBRL
 *
 *  1. **No hay un tag único por métrica.** Apple informa ventas como `Revenues`;
 *     GitLab, como `RevenueFromContractWithCustomerExcludingAssessedTax`. Por eso
 *     cada métrica es una cadena de tags con fallback, no un nombre.
 *  2. **Cada 10-K reexpresa los dos ejercicios anteriores**, así que el mismo
 *     cierre aparece tres veces con valores que pueden diferir. Gana la
 *     presentación más reciente: es la cifra reexpresada, la que la empresa
 *     sostiene hoy.
 *  3. **Hay hechos de duración y hechos de instante.** Las ventas cubren un
 *     período (`start`–`end`); el patrimonio es una foto (`end` solo). Mezclarlos
 *     mete trimestres adentro de una serie anual: por eso los de duración se
 *     filtran a 11–13 meses.
 *
 * ## El límite, declarado
 *
 * Sólo sirve para quien reporta en **US GAAP**. Un emisor extranjero que
 * presenta 40-F o 20-F bajo IFRS —Agnico Eagle, los ADR argentinos— no tiene
 * estos conceptos y la serie vuelve vacía. Eso no es un error: es el alcance de
 * EDGAR, y la ficha lo dice en pantalla en vez de mostrar un panel vacío.
 */

/** La SEC pide identificarse con un contacto real y limita a 10 req/s. */
const UA = "personal-dashboard/1.0 (bauty.remondino@gmail.com)";
const TIMEOUT_MS = 20_000;

/** Formularios que traen un ejercicio anual. */
const FORMULARIOS_ANUALES = new Set(["10-K", "10-K/A", "20-F", "40-F"]);

// ─── Caché en memoria (patrón equity/finviz, sin DB) ────────────────────────

interface Entrada<T> {
  valor: T;
  vence: number;
}

declare global {
  var __secCache: Map<string, Entrada<unknown>> | undefined;
}

const cache = (globalThis.__secCache ??= new Map<string, Entrada<unknown>>());

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

async function getJson<T>(url: string): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`SEC HTTP ${r.status}`);
    return (await r.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

// ─── Ticker → CIK ────────────────────────────────────────────────────────────

/**
 * El mapa oficial de tickers a CIK. Son 800 KB y unas diez mil empresas, así
 * que se baja una vez por proceso y se cachea un día: la lista cambia cuando
 * alguien sale o entra a cotizar, no entre dos visitas a una ficha.
 */
function mapaCik(): Promise<Map<string, number>> {
  return memo("cik", 86400, async () => {
    const crudo = await getJson<Record<string, { cik_str: number; ticker: string }>>(
      "https://www.sec.gov/files/company_tickers.json"
    );
    const m = new Map<string, number>();
    for (const fila of Object.values(crudo)) m.set(fila.ticker.toUpperCase(), fila.cik_str);
    return m;
  });
}

export async function cikDe(ticker: string): Promise<number | null> {
  return (await mapaCik()).get(ticker.toUpperCase()) ?? null;
}

// ─── Conceptos ───────────────────────────────────────────────────────────────

/**
 * Las cadenas de tags, en orden de preferencia.
 *
 * Sólo se incluyen métricas cuyo tag es estable y verificable. El EBITDA y el
 * capital invertido no están a propósito: no son conceptos XBRL sino cuentas
 * que cada analista arma distinto, y reconstruirlas de veinte tags sería
 * inventar precisión. Para eso ya está la serie de Yahoo, que llega a cinco
 * años pero viene calculada.
 */
const CONCEPTOS = {
  ventas: [
    "Revenues",
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "RevenueFromContractWithCustomerIncludingAssessedTax",
    "SalesRevenueNet",
  ],
  neto: ["NetIncomeLoss", "ProfitLoss"],
  fco: [
    "NetCashProvidedByUsedInOperatingActivities",
    "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
  ],
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"],
  patrimonio: [
    "StockholdersEquity",
    "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
  ],
  acciones: ["WeightedAverageNumberOfDilutedSharesOutstanding"],
} as const;

type Metrica = keyof typeof CONCEPTOS;

interface HechoXbrl {
  start?: string;
  end: string;
  val: number;
  form?: string;
  filed?: string;
  fy?: number;
}

/**
 * Un concepto anual, indexado por fecha de cierre.
 *
 * Se recorre **toda** la cadena de tags y se fusiona, no se corta en el primero
 * que devuelve algo: Apple informó ventas como `Revenues` hasta 2018 y como
 * `RevenueFromContractWithCustomerExcludingAssessedTax` desde 2019. Cortando en
 * el primero, la serie quedaba con tres años y catorce huecos.
 */
async function conceptoAnual(
  cik: number,
  tags: readonly string[],
  duracion: boolean
): Promise<{ serie: Map<string, number>; historial: Map<string, { valor: number; filed: string }[]> }> {
  // Con qué presentación quedó cada cierre: una reexpresión posterior gana.
  const ultima = new Map<string, { valor: number; filed: string }>();
  // Todas las presentaciones de cada cierre: de ahí salen los splits.
  const historial = new Map<string, { valor: number; filed: string }[]>();

  for (const tag of tags) {
    let datos: { units?: Record<string, HechoXbrl[]> };
    try {
      datos = await getJson(
        `https://data.sec.gov/api/xbrl/companyconcept/CIK${String(cik).padStart(10, "0")}/us-gaap/${tag}.json`
      );
    } catch {
      // Un tag que la empresa no usa devuelve 404: se prueba el siguiente.
      continue;
    }

    // Las acciones vienen en unidad "shares"; el resto, en USD.
    const hechos = datos.units?.USD ?? datos.units?.shares ?? [];
    for (const h of hechos) {
      if (!h.form || !FORMULARIOS_ANUALES.has(h.form)) continue;

      if (duracion) {
        if (!h.start) continue;
        const meses =
          (Number(h.end.slice(0, 4)) * 12 + Number(h.end.slice(5, 7))) -
          (Number(h.start.slice(0, 4)) * 12 + Number(h.start.slice(5, 7)));
        if (meses < 11 || meses > 13) continue;
      } else if (h.start) {
        continue;
      }

      const filed = h.filed ?? "";
      const versiones = historial.get(h.end) ?? [];
      if (!versiones.some((v) => v.filed === filed && v.valor === h.val)) {
        versiones.push({ valor: h.val, filed });
        historial.set(h.end, versiones);
      }

      // Gana la presentación más reciente, sin importar de qué tag vino: es la
      // cifra reexpresada, la que la empresa sostiene hoy.
      const previa = ultima.get(h.end);
      if (previa && previa.filed >= filed) continue;
      ultima.set(h.end, { valor: h.val, filed });
    }
  }

  return {
    serie: new Map(
      [...ultima.entries()]
        .map(([k, v]) => [k, v.valor] as [string, number])
        .sort((a, b) => a[0].localeCompare(b[0]))
    ),
    historial,
  };
}

/**
 * Ajusta la serie de acciones por los splits, que XBRL no marca.
 *
 * El problema, con el caso que lo destapó: Apple partió la acción 4 a 1 en
 * agosto de 2020. El 10-K de ese año reexpresó 2018 y 2019 en términos nuevos
 * —de 5.000 a 20.000 millones de acciones— pero **un 10-K sólo reexpresa los
 * dos ejercicios anteriores**, así que 2017 quedó para siempre en términos
 * viejos. La serie cruda mezcla las dos escalas y el FCF por acción se
 * desploma de US$9,86 a US$3,21 entre dos años en los que no pasó nada.
 *
 * El split se puede *deducir* sin fuente externa: cuando un ejercicio ya
 * cerrado aparece en dos presentaciones con valores distintos, el cociente es
 * el factor y la fecha de la presentación nueva es cuándo se aplicó. Todo
 * ejercicio cuya última presentación sea anterior a esa fecha se multiplica.
 *
 * El guardarraíl es que el cociente tiene que ser **casi exacto** —dentro del
 * 0,5% de un entero, y de al menos 1,5— porque un split es una razón entera y
 * una reexpresión contable cualquiera no. Si no cierra, no se toca nada: es
 * preferible una serie que se corta a una corregida por una regla que adivinó.
 */
function ajustarPorSplits(
  porCierre: Map<string, { valor: number; filed: string }>,
  historial: Map<string, { valor: number; filed: string }[]>
): Map<string, number> {
  const splits: { factor: number; desde: string }[] = [];

  for (const versiones of historial.values()) {
    const orden = [...versiones].sort((a, b) => a.filed.localeCompare(b.filed));
    for (let i = 1; i < orden.length; i++) {
      const previo = orden[i - 1].valor;
      const nuevo = orden[i].valor;
      if (!(previo > 0) || !(nuevo > 0)) continue;

      const factor = nuevo / previo;
      const redondo = Math.round(factor);
      if (factor < 1.5 || redondo < 2) continue;
      if (Math.abs(factor - redondo) / redondo > 0.005) continue;

      // El mismo split aparece en varios ejercicios reexpresados a la vez.
      if (!splits.some((s) => s.desde === orden[i].filed && s.factor === redondo)) {
        splits.push({ factor: redondo, desde: orden[i].filed });
      }
    }
  }

  const out = new Map<string, number>();
  for (const [cierre, { valor, filed }] of porCierre) {
    const factor = splits
      .filter((s) => filed < s.desde)
      .reduce((acumulado, s) => acumulado * s.factor, 1);
    out.set(cierre, valor * factor);
  }
  return out;
}

// ─── La serie ────────────────────────────────────────────────────────────────

export interface EjercicioSec {
  /** Fecha de cierre del ejercicio, YYYY-MM-DD. */
  cierre: string;
  /** El año que se muestra: el del cierre. */
  año: string;
  ventas: number | null;
  /** Contra el ejercicio anterior, en %. */
  crecimiento: number | null;
  neto: number | null;
  margenNeto: number | null;
  fco: number | null;
  capex: number | null;
  fcf: number | null;
  patrimonio: number | null;
  /** Acciones diluidas promedio del ejercicio. */
  acciones: number | null;
  /** Caja libre por acción: el número que la dilución puede desmentir. */
  fcfPorAccion: number | null;
}

export interface SerieSec {
  ticker: string;
  cik: number;
  ejercicios: EjercicioSec[];
  /**
   * Por qué la serie vino vacía, cuando vino vacía. Se muestra en pantalla: un
   * panel en blanco no distingue "no cotiza en EE.UU." de "se cayó la SEC".
   */
  problema: string | null;
}

/**
 * Los ejercicios anuales de una empresa, como los presentó ante la SEC.
 *
 * Seis requests en paralelo, cacheadas un día: un 10-K no cambia entre dos
 * visitas a la ficha, y los que sí cambian —una reexpresión— tardan meses.
 */
export function getSerieSec(ticker: string): Promise<SerieSec> {
  return memo(`sec:${ticker}`, 86400, async () => {
    const cik = await cikDe(ticker);
    if (cik == null) {
      return {
        ticker,
        cik: 0,
        ejercicios: [],
        problema:
          "Este papel no figura en el índice de emisores de la SEC. Pasa con los ADR que cotizan sin registro propio y con los fondos.",
      };
    }

    const claves = Object.keys(CONCEPTOS) as Metrica[];
    const vacio = { serie: new Map<string, number>(), historial: new Map() };
    const resultados = await Promise.all(
      claves.map((k) => conceptoAnual(cik, CONCEPTOS[k], k !== "patrimonio").catch(() => vacio))
    );
    const crudo = Object.fromEntries(claves.map((k, i) => [k, resultados[i]])) as Record<
      Metrica,
      { serie: Map<string, number>; historial: Map<string, { valor: number; filed: string }[]> }
    >;

    const por = Object.fromEntries(
      claves.map((k) => [k, crudo[k].serie] as const)
    ) as Record<Metrica, Map<string, number>>;

    // Sólo las acciones se ajustan por splits: en los montos, que un ejercicio
    // cambie entre presentaciones es una reexpresión contable de verdad y hay
    // que respetarla.
    const ultimaAcciones = new Map(
      [...crudo.acciones.historial.entries()].map(([cierre, versiones]) => {
        const orden = [...versiones].sort((a, b) => a.filed.localeCompare(b.filed));
        return [cierre, orden[orden.length - 1]] as const;
      })
    );
    por.acciones = ajustarPorSplits(ultimaAcciones, crudo.acciones.historial);

    // El eje son los cierres con ventas o resultado: sin ninguno de los dos no
    // hay ejercicio que mostrar, sólo una fila de guiones.
    const cierres = [...new Set([...por.ventas.keys(), ...por.neto.keys()])].sort();

    if (cierres.length === 0) {
      return {
        ticker,
        cik,
        ejercicios: [],
        problema:
          "La empresa presenta ante la SEC pero no en US GAAP: los emisores extranjeros que reportan bajo IFRS (formularios 20-F y 40-F) usan otro juego de etiquetas. Para estos papeles la serie larga hay que sacarla del balance publicado.",
      };
    }

    let ventasPrevias: number | null = null;
    const ejercicios: EjercicioSec[] = cierres.map((cierre) => {
      const ventas = por.ventas.get(cierre) ?? null;
      const neto = por.neto.get(cierre) ?? null;
      const fco = por.fco.get(cierre) ?? null;
      const capexCrudo = por.capex.get(cierre) ?? null;
      // La SEC informa los pagos por capex en positivo: son salidas de caja.
      const capex = capexCrudo == null ? null : Math.abs(capexCrudo);
      const fcf = fco != null && capex != null ? fco - capex : null;
      const acciones = por.acciones.get(cierre) ?? null;

      const crecimiento =
        ventas != null && ventasPrevias
          ? ((ventas - ventasPrevias) / Math.abs(ventasPrevias)) * 100
          : null;
      if (ventas != null) ventasPrevias = ventas;

      return {
        cierre,
        año: cierre.slice(0, 4),
        ventas,
        crecimiento,
        neto,
        margenNeto: neto != null && ventas ? (neto / ventas) * 100 : null,
        fco,
        capex,
        fcf,
        patrimonio: por.patrimonio.get(cierre) ?? null,
        acciones,
        fcfPorAccion: fcf != null && acciones ? fcf / acciones : null,
      };
    });

    // Una serie que termina hace años no está incompleta: está discontinuada.
    // Es lo que pasa cuando un emisor extranjero migra a IFRS —Agnico Eagle
    // dejó de reportar en US GAAP en 2014— y mostrarla sin avisar haría pensar
    // que la empresa dejó de facturar.
    const ultimoAño = Number(ejercicios[ejercicios.length - 1].año);
    const desactualizada = new Date().getFullYear() - ultimoAño > 2;

    return {
      ticker,
      cik,
      ejercicios,
      problema: desactualizada
        ? `La serie en US GAAP se corta en ${ultimoAño}: el emisor pasó a reportar bajo IFRS (formularios 20-F o 40-F), que usan otro juego de etiquetas. Lo de abajo es historia, no el estado actual.`
        : null,
    };
  });
}
