/**
 * Genera `src/lib/provincias-datos.ts`: empleo privado y exportaciones por
 * provincia, ya resueltos.
 *
 *   node scripts/generar-datos-provincias.mjs
 *
 * Antes esto se pedía en cada render. Son **27 requests secuenciales** a las
 * APIs del Estado —el CSV del SSPM, dos catálogos y veintitrés lotes de
 * series—, y el caché vive en memoria, así que cada arranque en frío los pagaba
 * de nuevo. Desde una función en Vercel, con 200-400 ms de ida y vuelta hasta
 * Argentina, eso son entre seis y once segundos con el panel en blanco.
 *
 * Y no hace falta: el empleo se publica una vez por mes y las exportaciones una
 * vez por año. Se bajan acá, quedan en el repo, y la página los lee sin tocar
 * la red. De paso el mapa sigue andando aunque datos.gob.ar esté caído.
 */
import fs from "node:fs";

const API = "https://apis.datos.gob.ar/series/api";
const CSV_EMPLEO =
  "https://infra.datos.gob.ar/catalog/sspm/dataset/154/distribution/154.1/download/asalariados-registrados-sector-privado-segun-provincia-datos-con-estacionalidad.csv";
const DESTINO = "src/lib/provincias-datos.ts";
const RUBROS = ["pp", "moa", "moi", "cye"];

const UA = { "user-agent": "personal-dashboard/1.0" };
const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");

/** Las provincias salen del archivo de geometría, que ya es la fuente de verdad. */
const fuente = fs.readFileSync("src/lib/provincias.ts", "utf8");
const PROVINCIAS = [...fuente.matchAll(/iso:\s*"([^"]+)",\s*nombre:\s*"([^"]+)"/g)]
  .map((m) => ({ iso: m[1], nombre: m[2] }));
if (PROVINCIAS.length !== 24) throw new Error(`Se esperaban 24 provincias, hay ${PROVINCIAS.length}`);

const COLUMNA = Object.fromEntries(
  Object.entries({
    "AR-B": "buenos_aires", "AR-C": "caba", "AR-K": "catamarca", "AR-H": "chaco",
    "AR-U": "chubut", "AR-X": "cordoba", "AR-W": "corrientes", "AR-E": "entre_rios",
    "AR-P": "formosa", "AR-Y": "jujuy", "AR-L": "la_pampa", "AR-F": "la_rioja",
    "AR-M": "mendoza", "AR-N": "misiones", "AR-Q": "neuquen", "AR-R": "rio_negro",
    "AR-A": "salta", "AR-J": "san_juan", "AR-D": "san_luis", "AR-Z": "santa_cruz",
    "AR-S": "santa_fe", "AR-G": "santiago_estero", "AR-V": "tierra_fuego", "AR-T": "tucuman",
  }).map(([k, v]) => [k, `asalariados_priv_${v}`])
);

const PAIS_LIMPIO = {
  Espania: "España", "Republica de Corea": "Corea del Sur", "Paises Bajos": "Países Bajos",
  Japon: "Japón", Belgica: "Bélgica", Canada: "Canadá", Mexico: "México", Peru: "Perú",
  "Reino Unido de Gran Bretania e Irlanda del Norte": "Reino Unido",
};

const ALIAS_DESTINO = { "AR-B": "pba", "AR-C": "caba" };

// ── Empleo ───────────────────────────────────────────────────────────────────
async function empleo() {
  const r = await fetch(CSV_EMPLEO, { headers: UA });
  if (!r.ok) throw new Error(`El CSV de empleo respondió ${r.status}`);

  const filas = (await r.text()).trim().split("\n").map((l) => l.split(","));
  const [cabecera, ...datos] = filas;
  if (datos.length < 13) throw new Error("El CSV de empleo vino con muy pocas filas");

  const ultima = datos.at(-1);
  const haceUnAnio = datos.at(-13); // la serie es mensual: doce atrás es el mismo mes

  const out = {};
  for (const [iso, columna] of Object.entries(COLUMNA)) {
    const i = cabecera.indexOf(columna);
    if (i < 0) continue;
    const nivel = Number(ultima[i]);
    const previo = Number(haceUnAnio?.[i]);
    if (!Number.isFinite(nivel)) continue;
    out[iso] = {
      nivel: +nivel.toFixed(1),
      interanual: Number.isFinite(previo) && previo > 0 ? +((nivel / previo - 1) * 100).toFixed(3) : null,
      fecha: ultima[0],
    };
  }
  return out;
}

// ── Exportaciones ────────────────────────────────────────────────────────────
async function pedirSeries(ids, limit) {
  const r = await fetch(`${API}/series/?ids=${ids.join(",")}&limit=${limit}&sort=desc&format=json`);
  if (!r.ok) return null;
  return (await r.json()).data ?? [];
}

async function exportaciones() {
  const cat = await fetch(`${API}/search/?q=exportaciones+total&limit=300`);
  if (!cat.ok) throw new Error(`El catálogo respondió ${cat.status}`);
  const catalogo = (await cat.json()).data ?? [];

  const idTotal = new Map();
  const idRubro = new Map();
  for (const p of PROVINCIAS) {
    const clave = norm(p.nombre === "CABA" ? "ciudad de buenos aires" : p.nombre);
    const hit = catalogo.find(
      (d) => norm(String(d.field?.description ?? "")) === `exportaciones${clave}total${clave}`
    );
    if (hit?.field?.id) idTotal.set(p.iso, hit.field.id);
    for (const rubro of RUBROS) {
      const r = catalogo.find(
        (d) => norm(String(d.field?.description ?? "")) === `exportaciones${clave}${rubro}`
      );
      if (r?.field?.id) idRubro.set(`${p.iso}:${rubro}`, r.field.id);
    }
  }
  if (idTotal.size === 0) throw new Error("No se encontró ninguna serie de exportaciones");

  const out = {};
  const entradas = [...idTotal.entries()];
  for (let i = 0; i < entradas.length; i += 20) {
    const tanda = entradas.slice(i, i + 20);
    const filas = await pedirSeries(tanda.map(([, id]) => id), 2);
    if (!filas?.length) continue;
    const [ultima, previa] = filas;
    tanda.forEach(([iso], col) => {
      const monto = Number(ultima?.[col + 1]);
      const antes = Number(previa?.[col + 1]);
      if (!Number.isFinite(monto)) return;
      out[iso] = {
        monto: +monto.toFixed(1),
        anio: String(ultima?.[0] ?? "").slice(0, 4),
        interanual: Number.isFinite(antes) && antes > 0 ? +((monto / antes - 1) * 100).toFixed(3) : null,
        composicion: [],
        destinos: [],
        destinosCubren: 0,
      };
    });
  }

  const rubros = [...idRubro.entries()];
  for (let i = 0; i < rubros.length; i += 20) {
    const tanda = rubros.slice(i, i + 20);
    const filas = await pedirSeries(tanda.map(([, id]) => id), 1);
    const fila = filas?.[0];
    if (!fila) continue;
    tanda.forEach(([clave], col) => {
      const [iso, rubro] = clave.split(":");
      const monto = Number(fila[col + 1]);
      if (!Number.isFinite(monto) || monto <= 0 || !out[iso]) return;
      out[iso].composicion.push({ rubro, monto: +monto.toFixed(1), peso: 0 });
    });
  }

  // Los pesos se calculan sobre la suma de los rubros y no sobre el total
  // declarado: si algún rubro no vino, los porcentajes igual cierran
  for (const v of Object.values(out)) {
    const suma = v.composicion.reduce((s, c) => s + c.monto, 0);
    if (suma <= 0) { v.composicion = []; continue; }
    for (const c of v.composicion) c.peso = +((c.monto / suma) * 100).toFixed(2);
    v.composicion.sort((a, b) => b.monto - a.monto);
  }

  await destinos(out);
  return out;
}

// ── Destinos ─────────────────────────────────────────────────────────────────
async function destinos(out) {
  const cat = await fetch(`${API}/search/?q=datos+exportaciones&limit=1000`);
  if (!cat.ok) return;
  const catalogo = (await cat.json()).data ?? [];

  const porProvincia = new Map();
  for (const d of catalogo) {
    const desc = String(d.field?.description ?? "");
    const id = d.field?.id;
    if (!id || !desc.startsWith("Datos exportaciones ")) continue;

    const palabras = desc.slice("Datos exportaciones ".length).trim().split(/\s+/);
    for (const p of PROVINCIAS) {
      const nombre = (ALIAS_DESTINO[p.iso] ?? p.nombre).split(/\s+/);
      // Se consumen las palabras del nombre una por una: cortar por longitud
      // del texto normalizado no sirve, porque normalizar saca acentos y
      // espacios y las posiciones dejan de coincidir con el original
      if (!nombre.every((w, i) => palabras[i] && norm(palabras[i]) === norm(w))) continue;

      const pais = palabras.slice(nombre.length).join(" ").trim();
      if (!pais || /^total$/i.test(palabras[nombre.length] ?? "")) break;

      const lista = porProvincia.get(p.iso) ?? [];
      lista.push({ id, pais: PAIS_LIMPIO[pais] ?? pais });
      porProvincia.set(p.iso, lista);
      break;
    }
  }

  const pedidos = [...porProvincia.entries()].flatMap(([iso, xs]) => xs.map((x) => ({ iso, ...x })));
  for (let i = 0; i < pedidos.length; i += 20) {
    const tanda = pedidos.slice(i, i + 20);
    const filas = await pedirSeries(tanda.map((t) => t.id), 1);
    const fila = filas?.[0];
    if (!fila) continue;
    tanda.forEach((t, col) => {
      const monto = Number(fila[col + 1]);
      if (!Number.isFinite(monto) || monto <= 0 || !out[t.iso]) return;
      out[t.iso].destinos.push({ pais: t.pais, monto: +monto.toFixed(1), peso: 0 });
    });
  }

  for (const v of Object.values(out)) {
    if (v.monto > 0) for (const d of v.destinos) d.peso = +((d.monto / v.monto) * 100).toFixed(2);
    // "Resto" es el agregado de lo que el INDEC no desglosa, no un país
    v.destinos = v.destinos
      .filter((d) => !/^resto$/i.test(d.pais))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 4);
    v.destinosCubren = +v.destinos.reduce((s, d) => s + d.peso, 0).toFixed(2);
  }
}

// ── Generación ───────────────────────────────────────────────────────────────
console.log("Bajando empleo y exportaciones provinciales…");
const t0 = Date.now();
const [emp, expo] = [await empleo(), await exportaciones()];
const segundos = ((Date.now() - t0) / 1000).toFixed(1);

// Controles: sin esto un cambio de formato de la fuente pasaría desapercibido
if (Object.keys(emp).length < 24) throw new Error(`Empleo incompleto: ${Object.keys(emp).length}/24`);
if (Object.keys(expo).length < 20) throw new Error(`Exportaciones incompletas: ${Object.keys(expo).length}/24`);

const sinRubros = Object.entries(expo).filter(([, v]) => v.composicion.length === 0).map(([k]) => k);
const conDestinos = Object.values(expo).filter((v) => v.destinos.length > 0).length;

const mesEmpleo = Object.values(emp)[0].fecha;
const anioExpo = Object.values(expo)[0].anio;

console.log(`  empleo: 24/24 · mes ${mesEmpleo}`);
console.log(`  exportaciones: ${Object.keys(expo).length}/24 · año ${anioExpo} · ${conDestinos} con destinos`);
if (sinRubros.length) console.log(`  sin desglose por rubro: ${sinRubros.join(", ")}`);
console.log(`  tardó ${segundos} s en 27 requests — eso es lo que se deja de pagar en cada render`);

const hoy = new Date().toISOString().slice(0, 10);
fs.writeFileSync(DESTINO, `/**
 * Empleo privado y exportaciones por provincia, ya resueltos.
 *
 * Generado por \`node scripts/generar-datos-provincias.mjs\` el ${hoy}.
 * No editar a mano.
 *
 * Empleo: SSPM, mes ${mesEmpleo}. Exportaciones: INDEC, año ${anioExpo}.
 *
 * Está en el repo y no se pide en vivo porque armarlo son 27 requests
 * secuenciales a las APIs del Estado, y el empleo se publica una vez por mes y
 * las exportaciones una vez por año. Para actualizarlo, correr el generador.
 */

import type { Rubro } from "@/lib/macro-provincias";

export interface EmpleoProvincial {
  /** Miles de asalariados privados registrados. */
  nivel: number;
  /** Variación contra el mismo mes del año anterior, en %. */
  interanual: number | null;
  /** Mes del dato, en ISO. */
  fecha: string;
}

export interface ExportacionesProvincia {
  /** Millones de dólares del último año disponible. */
  monto: number;
  anio: string;
  /** Variación contra el año anterior, en %. */
  interanual: number | null;
  /** Peso de cada rubro dentro del total, en %. */
  composicion: { rubro: Rubro; monto: number; peso: number }[];
  /** A dónde va, de mayor a menor. Sin "Resto", que no es un destino. */
  destinos: { pais: string; monto: number; peso: number }[];
  /** Cuánto del total cubren los destinos listados, en %. */
  destinosCubren: number;
}

/** Cuándo se generó y qué período cubre cada serie. */
export const VIGENCIA = {
  generado: ${JSON.stringify(hoy)},
  mesEmpleo: ${JSON.stringify(mesEmpleo)},
  anioExportaciones: ${JSON.stringify(anioExpo)},
} as const;

export const EMPLEO: Record<string, EmpleoProvincial> = ${JSON.stringify(emp, null, 2)};

export const EXPORTACIONES: Record<string, ExportacionesProvincia> = ${JSON.stringify(expo, null, 2)};
`);

console.log(`Listo: ${DESTINO} (${(fs.statSync(DESTINO).size / 1024).toFixed(0)} KB).`);
