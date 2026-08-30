/**
 * FRED (Federal Reserve Bank of St. Louis) — series macro de EE.UU., sin API key.
 *
 * La API oficial de FRED pide una clave por mail. El endpoint que usa el
 * graficador de su propio sitio, en cambio, es público y devuelve la serie
 * entera en CSV:
 *
 *   https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10&cosd=2020-01-01
 *
 * Es la misma data, sin trámite y sin secreto que configurar en Vercel.
 *
 * **Trampa verificada (ago-2026):** se pueden pedir varias series en un `id=`
 * separado por comas, pero sólo si comparten frecuencia *exacta*. Si se mezclan
 * —o incluso dos semanales con distinto día de corte, como ICSA (sábado) y
 * WALCL (miércoles)— FRED responde un ZIP con un CSV por frecuencia en vez de
 * texto plano. Por eso acá se pide **una serie por request**: aísla fallas y
 * nunca hay que desempaquetar nada.
 *
 * Caché en memoria del proceso con TTL, igual que `equity.ts` y `byma.ts`: no
 * toca SQLite, así que funciona igual en el deploy efímero de Vercel.
 */

const BASE = "https://fred.stlouisfed.org/graph/fredgraph.csv";
const TIMEOUT_MS = 10_000;

/** Media hora: las series diarias de FRED se publican una vez por día. */
const TTL_SEGUNDOS = 1800;

export interface PuntoSerie {
  /** YYYY-MM-DD */
  fecha: string;
  valor: number;
}

// ─── Caché ───────────────────────────────────────────────────────────────────

interface Entrada<T> {
  valor: T;
  vence: number;
}

declare global {
  var __fredCache: Map<string, Entrada<unknown>> | undefined;
}

const cache = (globalThis.__fredCache ??= new Map<string, Entrada<unknown>>());

export async function memoFred<T>(
  clave: string,
  ttlSegundos: number,
  fn: () => Promise<T>
): Promise<T> {
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

/**
 * Vacía el caché entero (lo usa el botón de refresco de `/eeuu`).
 *
 * Borra todo y no sólo las claves `fred:` porque `@/lib/fed` guarda acá mismo
 * el calendario del FOMC, el Board y el sendero de futuros: si el botón dijera
 * "actualizar" y dejara la mitad de la página congelada por veinticuatro horas,
 * mentiría. Lo que se vuelve a pedir es barato.
 */
export function invalidarFred() {
  cache.clear();
}

// ─── Ventanas ────────────────────────────────────────────────────────────────

/**
 * Cuántos años de historia se piden de cada serie.
 *
 * Vive acá y no en cada llamada a propósito. Cuando la ventana era un argumento,
 * dos paneles que necesitaban la misma serie la pedían con `cosd` distinto —el
 * de la tasa quería un año de EFFR y el de la postura seis— y como el `cosd`
 * forma parte de la clave del caché, terminaban siendo dos requests a FRED por
 * el mismo dato. Con la ventana atada a la serie eso no puede volver a pasar.
 *
 * Sólo se listan las que necesitan más que el default: los índices de precios y
 * la tasa efectiva, porque de ellos se calculan variaciones interanuales y hay
 * que traer un año extra antes del primer punto que se va a mostrar.
 */
const VENTANA_ANIOS: Record<string, number> = {
  CPIAUCSL: 7,
  CPILFESL: 7,
  PCEPI: 7,
  PCEPILFE: 7,
  EFFR: 7,
  CES0500000003: 7,
  RSAFS: 7,
  INDPRO: 7,
  A191RL1Q225SBEA: 7,
};

/** Con cinco años alcanza para cualquier gráfico de la sección. */
const VENTANA_DEFECTO = 5;

// ─── Fetch ───────────────────────────────────────────────────────────────────

/**
 * La serie completa. Los valores faltantes vienen como "." (feriados, meses sin
 * publicar) y se descartan: el consumidor recibe sólo puntos con dato.
 */
export function fredSerie(id: string): Promise<PuntoSerie[]> {
  const desde = desdeHaceAnios(VENTANA_ANIOS[id] ?? VENTANA_DEFECTO);
  return memoFred(`fred:${id}:${desde}`, TTL_SEGUNDOS, async () => {
    const url = `${BASE}?id=${encodeURIComponent(id)}&cosd=${desde}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
      headers: { accept: "text/csv,text/plain" },
    });
    if (!res.ok) throw new Error(`FRED ${id} HTTP ${res.status}`);

    const texto = await res.text();
    // Si FRED decidió empaquetar (frecuencias mezcladas) el cuerpo es un ZIP
    // binario: mejor fallar claro que parsear basura.
    if (!texto.startsWith("observation_date")) {
      throw new Error(`FRED ${id}: respuesta no es CSV`);
    }

    const out: PuntoSerie[] = [];
    for (const linea of texto.split("\n").slice(1)) {
      const [fecha, crudo] = linea.trim().split(",");
      if (!fecha || !crudo || crudo === ".") continue;
      const valor = Number(crudo);
      if (Number.isFinite(valor)) out.push({ fecha, valor });
    }
    return out;
  });
}

/**
 * Varias series a la vez. Una que falle no voltea al resto: devuelve `null` en
 * su lugar y el panel que la usa muestra "s/d" en vez de no renderizar.
 */
export async function fredVarias(ids: string[]): Promise<Map<string, PuntoSerie[] | null>> {
  const settled = await Promise.allSettled(ids.map((id) => fredSerie(id)));
  const out = new Map<string, PuntoSerie[] | null>();
  settled.forEach((r, i) => {
    out.set(ids[i], r.status === "fulfilled" && r.value.length > 0 ? r.value : null);
  });
  return out;
}

// ─── Transformaciones ────────────────────────────────────────────────────────

export const ultimo = (s: PuntoSerie[] | null | undefined): PuntoSerie | null =>
  s && s.length > 0 ? s[s.length - 1] : null;

/**
 * El punto más cercano a `n` días atrás, sin pasarse. Es lo que hace comparable
 * una curva de hoy contra la de hace un mes: las series diarias tienen feriados,
 * así que pedir la fecha exacta devuelve vacío la mitad de las veces.
 */
export function haceDias(serie: PuntoSerie[] | null | undefined, dias: number): PuntoSerie | null {
  if (!serie || serie.length === 0) return null;
  const objetivo = new Date(serie[serie.length - 1].fecha + "T00:00:00Z");
  objetivo.setUTCDate(objetivo.getUTCDate() - dias);
  const iso = objetivo.toISOString().slice(0, 10);

  let cand: PuntoSerie | null = null;
  for (const p of serie) {
    if (p.fecha <= iso) cand = p;
    else break;
  }
  return cand;
}

/**
 * Variación interanual de un índice de precios, en %.
 *
 * FRED publica el CPI y el PCE como **nivel del índice**, no como inflación: el
 * número que se mira en la prensa —"CPI 3,1%"— hay que calcularlo contra el
 * dato de doce meses antes. Se busca por fecha y no por posición: si un mes no
 * salió publicado, correr 12 lugares en el array compara contra el mes
 * equivocado y el error pasa desapercibido.
 */
export function variacionInteranual(serie: PuntoSerie[] | null | undefined): number | null {
  const u = ultimo(serie);
  if (!u || !serie) return null;
  const hace12 = restarMeses(u.fecha, 12);
  const base = serie.find((p) => p.fecha === hace12);
  if (!base || base.valor === 0) return null;
  return (u.valor / base.valor - 1) * 100;
}

/** Variación mensual de un índice, en %. */
export function variacionMensual(serie: PuntoSerie[] | null | undefined): number | null {
  if (!serie || serie.length < 2) return null;
  const u = serie[serie.length - 1];
  const prev = serie[serie.length - 2];
  if (prev.valor === 0) return null;
  return (u.valor / prev.valor - 1) * 100;
}

/** Serie de variación interanual, punto a punto, para graficar. */
export function serieInteranual(serie: PuntoSerie[] | null | undefined): PuntoSerie[] {
  if (!serie) return [];
  const porFecha = new Map(serie.map((p) => [p.fecha, p.valor]));
  const out: PuntoSerie[] = [];
  for (const p of serie) {
    const base = porFecha.get(restarMeses(p.fecha, 12));
    if (base && base !== 0) out.push({ fecha: p.fecha, valor: (p.valor / base - 1) * 100 });
  }
  return out;
}

/** Diferencia contra el punto anterior, en unidades de la serie. */
export function cambioUltimo(serie: PuntoSerie[] | null | undefined): number | null {
  if (!serie || serie.length < 2) return null;
  return serie[serie.length - 1].valor - serie[serie.length - 2].valor;
}

/** YYYY-MM-DD menos n meses, en el mismo día del mes (las series mensuales usan el día 1). */
export function restarMeses(fecha: string, meses: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const total = a * 12 + (m - 1) - meses;
  const na = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${na}-${String(nm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** YYYY-MM-DD de hace n años, para el `cosd` de cada pedido. */
export function desdeHaceAnios(anios: number): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - anios);
  return d.toISOString().slice(0, 10);
}
