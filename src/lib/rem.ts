/**
 * REM — Relevamiento de Expectativas de Mercado (BCRA).
 *
 * La encuesta que el BCRA les hace a consultoras, centros de investigación y
 * bancos los últimos tres días hábiles de cada mes, y publica en los primeros
 * días del siguiente. De ahí sale la inflación que el mercado espera para el
 * mes en curso, que es el número que se mira acá.
 *
 * **No son proyecciones del BCRA**: el propio banco lo aclara arriba de todo en
 * la publicación. Es la mediana de los pronósticos de los participantes, y la
 * tarjeta lo dice para que no se lea como una meta oficial.
 *
 * ## De dónde sale el dato
 *
 * No hay API. Se probaron y descartaron dos caminos antes de éste:
 *  - **BCRA API v4.0** sólo publica la variable 29 (mediana de la variación
 *    i.a. esperada para los próximos 12 meses). No tiene el sendero mensual.
 *  - **apis.datos.gob.ar** tiene el dataset del REM completo y bien armado
 *    (`430.1_REM_IPC_NAL_T_M_0_0_25_28` y compañía), pero está congelado en
 *    diciembre de 2025: para "el mes en curso" no sirve.
 *
 * Queda el xlsx de resultados del propio BCRA, que sí está al día. Se lee el
 * link de la portada del REM —el nombre del archivo lleva el mes, así que
 * hardcodearlo lo dejaría viejo en la próxima publicación— y se parsea el
 * cuadro de precios minoristas.
 *
 * ## Por qué el xlsx se parsea a mano
 *
 * Un .xlsx es un zip con XML adentro. Leerlo son ~60 líneas (directorio
 * central + `inflateRawSync`, ambos de Node) contra una dependencia nueva de
 * varios megas para tres columnas de una sola hoja. La estructura del cuadro
 * es estable desde hace años y, si algún día cambia, el parseo tira y la
 * tarjeta no se dibuja: nunca inventa un número.
 */
import { inflateRawSync } from "node:zlib";

const BASE = "https://www.bcra.gob.ar";
const PORTADA = `${BASE}/relevamiento-expectativas-mercado-rem/`;
const TIMEOUT_MS = 15_000;

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// ─── Tipos ───────────────────────────────────────────────────────────────────

/** Un mes del sendero esperado, con la dispersión entre participantes. */
export interface RemMes {
  /** "2026-08". */
  mes: string;
  /** "ago-26". */
  etiqueta: string;
  /** Mediana de la variación mensual esperada, en %. */
  mediana: number;
  /** Percentiles 25 y 75: el rango donde cae la mitad central de las respuestas. */
  p25: number | null;
  p75: number | null;
  participantes: number | null;
}

/** Un horizonte largo: próximos 12 meses, cierre de un año. Todo interanual. */
export interface RemHorizonte {
  /** "próx. 12 meses", "2026". */
  clave: string;
  /** "var. % i.a.; jul-27" tal como lo publica el cuadro. */
  referencia: string;
  mediana: number;
}

export interface Rem {
  /** Mes relevado, "2026-07". */
  relevamiento: string;
  /** "julio de 2026". */
  relevamientoLabel: string;
  /** Sendero mensual del IPC nivel general, en orden. */
  mensual: RemMes[];
  /** El mismo sendero para el IPC núcleo. */
  nucleo: RemMes[];
  /** Interanuales del IPC nivel general. */
  interanual: RemHorizonte[];
  /** Cuántos pronosticaron el mes más cercano. */
  participantes: number | null;
  /** El xlsx del que salió todo. */
  fuente: string;
}

// ─── Caché en memoria (patrón equity) ────────────────────────────────────────

interface Entrada<T> {
  valor: T;
  vence: number;
}

declare global {
  var __remCache: Map<string, Entrada<unknown>> | undefined;
}

const cache = (globalThis.__remCache ??= new Map<string, Entrada<unknown>>());

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

// ─── Lector de xlsx (zip + XML, sin dependencias) ────────────────────────────

/** Las entradas de un zip, descomprimidas, leídas del directorio central. */
function abrirZip(buf: Buffer): Map<string, Buffer> {
  // El fin del directorio central está al final del archivo, después de un
  // comentario de largo variable: se busca la firma hacia atrás.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66_000); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("REM: el archivo no es un zip válido");

  const cantidad = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = new Map<string, Buffer>();

  for (let i = 0; i < cantidad; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("REM: entrada de zip inesperada");
    const metodo = buf.readUInt16LE(p + 10);
    const comprimido = buf.readUInt32LE(p + 20);
    const largoNombre = buf.readUInt16LE(p + 28);
    const largoExtra = buf.readUInt16LE(p + 30);
    const largoComentario = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nombre = buf.toString("utf8", p + 46, p + 46 + largoNombre);

    // El header local repite el nombre y trae su propio campo extra, que puede
    // tener otro largo que el del directorio: los datos arrancan después de ambos.
    const ini = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const datos = buf.subarray(ini, ini + comprimido);
    out.set(nombre, metodo === 0 ? datos : inflateRawSync(datos));

    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  return out;
}

const desescapar = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&");

/** Una fila de la hoja: columna ("B", "D"…) → texto ya resuelto. */
type Fila = Record<string, string>;

/**
 * Las filas no vacías de la primera hoja, en orden.
 *
 * Excel guarda los textos en una tabla aparte (`sharedStrings`) y en la celda
 * deja el índice con `t="s"`; los números van tal cual. Es todo lo que hace
 * falta resolver para este cuadro.
 */
function leerHoja(archivos: Map<string, Buffer>): Fila[] {
  const compartidas = [
    ...(archivos.get("xl/sharedStrings.xml")?.toString("utf8") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g),
  ].map((si) =>
    [...si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => desescapar(t[1])).join("")
  );

  const hoja = archivos.get("xl/worksheets/sheet1.xml");
  if (!hoja) throw new Error("REM: el xlsx no trae la hoja de resultados");

  const filas: Fila[] = [];
  for (const fila of hoja.toString("utf8").matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const celdas: Fila = {};
    for (const c of fila[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g)) {
      const v = c[3].match(/<v>([\s\S]*?)<\/v>/);
      if (!v) continue;
      celdas[c[1]] = /t="s"/.test(c[2]) ? (compartidas[Number(v[1])] ?? "") : desescapar(v[1]);
    }
    if (Object.keys(celdas).length > 0) filas.push(celdas);
  }
  return filas;
}

// ─── Parseo del cuadro ───────────────────────────────────────────────────────

/** Sin acentos y en minúscula, para comparar títulos sin depender de la tilde. */
const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const numero = (s: string | undefined): number | null => {
  if (s == null || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/**
 * El período de la columna B. Excel guarda las fechas como días desde el
 * 30/12/1899 y el cuadro usa el último día del mes, así que alcanza con el
 * año y el mes en UTC.
 */
function mesDeSerie(serie: number): { mes: string; etiqueta: string } {
  const d = new Date(Date.UTC(1899, 11, 30) + serie * 86_400_000);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return {
    mes: `${y}-${String(m + 1).padStart(2, "0")}`,
    etiqueta: `${MESES[m]}-${String(y).slice(2)}`,
  };
}

/**
 * Un bloque del cuadro: arranca en la fila cuyo título coincide y termina en el
 * siguiente título (una fila con B y sin C). La fila de encabezados se saltea.
 */
function bloque(filas: Fila[], titulo: string): { meses: RemMes[]; horizontes: RemHorizonte[] } {
  const inicio = filas.findIndex((f) => f.B != null && normalizar(f.B).includes(titulo));
  if (inicio < 0) throw new Error(`REM: no aparece el cuadro "${titulo}"`);

  const meses: RemMes[] = [];
  const horizontes: RemHorizonte[] = [];

  for (const f of filas.slice(inicio + 1)) {
    if (f.C == null) break; // el título del bloque siguiente
    if (f.C === "Referencia") continue; // encabezados
    const mediana = numero(f.D);
    if (mediana == null) continue;

    const serie = numero(f.B);
    if (serie != null && serie > 40_000) {
      meses.push({
        ...mesDeSerie(serie),
        mediana,
        p25: numero(f.K),
        p75: numero(f.J),
        participantes: numero(f.M),
      });
    } else if (f.B) {
      horizontes.push({ clave: f.B, referencia: f.C, mediana });
    }
  }

  if (meses.length === 0) throw new Error(`REM: el cuadro "${titulo}" vino sin sendero mensual`);
  return { meses, horizontes };
}

/** "…- BCRA - Julio 2026" → { relevamiento: "2026-07", label: "julio de 2026" }. */
function leerTitulo(filas: Fila[]): { relevamiento: string; relevamientoLabel: string } {
  const titulo = filas.find((f) => f.B?.includes("Relevamiento de Expectativas"))?.B ?? "";
  const m = normalizar(titulo).match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(\d{4})/);
  if (!m) throw new Error("REM: no se pudo leer el mes del relevamiento");
  const i = MESES_LARGOS.indexOf(m[1]);
  return {
    relevamiento: `${m[2]}-${String(i + 1).padStart(2, "0")}`,
    relevamientoLabel: `${MESES_LARGOS[i]} de ${m[2]}`,
  };
}

// ─── API ─────────────────────────────────────────────────────────────────────

async function bajarRem(): Promise<Rem> {
  const portada = await fetch(PORTADA, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!portada.ok) throw new Error(`REM: portada HTTP ${portada.status}`);

  // El nombre del archivo lleva el mes ("…-jul-2026.xlsx"): se lee de la
  // portada en vez de armarlo, así el mes siguiente sale solo.
  const link = (await portada.text()).match(
    /href="([^"]*tablas-relevamiento-expectativas-mercado[^"]*\.xlsx)"/i
  );
  if (!link) throw new Error("REM: la portada no publica el xlsx de resultados");
  const fuente = new URL(link[1], BASE).toString();

  const res = await fetch(fuente, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) throw new Error(`REM: xlsx HTTP ${res.status}`);

  const filas = leerHoja(abrirZip(Buffer.from(await res.arrayBuffer())));
  const general = bloque(filas, "ipc nivel general");
  const nucleo = bloque(filas, "ipc nucleo");

  return {
    ...leerTitulo(filas),
    mensual: general.meses,
    nucleo: nucleo.meses,
    interanual: general.horizontes,
    participantes: general.meses[0]?.participantes ?? null,
    fuente,
  };
}

/**
 * El último REM publicado. Cacheado seis horas: sale una vez por mes, pero el
 * día que sale conviene no quedarse con el anterior toda la jornada.
 */
export function getRem(): Promise<Rem> {
  return memo("rem", 6 * 3600, bajarRem);
}

/** "2026-08" para hoy. */
export function mesEnCurso(hoy = new Date()): string {
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

/** Cómo se lee un mes "2026-08" en castellano: "agosto de 2026". */
export function mesLargo(mes: string): string {
  const [y, m] = mes.split("-");
  return `${MESES_LARGOS[Number(m) - 1]} de ${y}`;
}
