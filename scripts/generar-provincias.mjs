/**
 * Genera `src/lib/provincias.ts`: geometría y datos de referencia de las 24
 * jurisdicciones argentinas.
 *
 *   node scripts/generar-provincias.mjs
 *
 * La geometría sale de Natural Earth (dominio público), se simplifica con
 * Douglas-Peucker y se proyecta a coordenadas de SVG. Se guarda ya proyectada
 * para que el navegador no tenga que hacer nada: son paths listos para pintar.
 *
 * Lo que NO se genera acá son los datos económicos — exportaciones y empleo
 * se piden en runtime a las APIs del Estado, porque cambian.
 */
import fs from "node:fs";

const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson";
const DESTINO = "src/lib/provincias.ts";

/** Tolerancia de simplificación en grados. Más alto = menos puntos. */
const TOLERANCIA = 0.02;
const ANCHO = 460;

// ─── Simplificación ─────────────────────────────────────────────────────────

function distanciaAPerpendicular(p, a, b) {
  const [x, y] = p, [x1, y1] = a, [x2, y2] = b;
  const dx = x2 - x1, dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

/** Douglas-Peucker: conserva la silueta y tira los puntos que no aportan. */
function simplificar(puntos, tol) {
  if (puntos.length < 3) return puntos;
  let maxD = 0, idx = 0;
  for (let i = 1; i < puntos.length - 1; i++) {
    const d = distanciaAPerpendicular(puntos[i], puntos[0], puntos[puntos.length - 1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= tol) return [puntos[0], puntos[puntos.length - 1]];
  return [
    ...simplificar(puntos.slice(0, idx + 1), tol).slice(0, -1),
    ...simplificar(puntos.slice(idx), tol),
  ];
}

// ─── Datos de referencia ────────────────────────────────────────────────────

/**
 * Gobernadores en ejercicio del período 2023-2027 y su fuerza política.
 *
 * `bloque` es el espacio al que responde; `orientacion` es una simplificación
 * gruesa del eje izquierda-derecha, útil para leer el mapa de un vistazo pero
 * que no captura las alianzas provinciales. Se corre a mano cuando cambia.
 */
const GOBERNADORES = {
  "AR-C": { gobernador: "Jorge Macri",              partido: "PRO",                     bloque: "PRO",         orientacion: "centroderecha" },
  "AR-B": { gobernador: "Axel Kicillof",            partido: "Frente Renovador / PJ",   bloque: "Peronismo",   orientacion: "izquierda" },
  "AR-K": { gobernador: "Raúl Jalil",               partido: "Partido Justicialista",   bloque: "Peronismo",   orientacion: "centroizquierda" },
  "AR-H": { gobernador: "Leandro Zdero",            partido: "UCR",                     bloque: "UCR",         orientacion: "centroderecha" },
  "AR-U": { gobernador: "Ignacio Torres",           partido: "PRO",                     bloque: "PRO",         orientacion: "centroderecha" },
  "AR-X": { gobernador: "Martín Llaryora",          partido: "Hacemos Unidos por Córdoba", bloque: "Provincial", orientacion: "centro" },
  "AR-W": { gobernador: "Gustavo Valdés",           partido: "UCR",                     bloque: "UCR",         orientacion: "centroderecha" },
  "AR-E": { gobernador: "Rogelio Frigerio",         partido: "PRO",                     bloque: "PRO",         orientacion: "centroderecha" },
  "AR-P": { gobernador: "Gildo Insfrán",            partido: "Partido Justicialista",   bloque: "Peronismo",   orientacion: "izquierda" },
  "AR-Y": { gobernador: "Carlos Sadir",             partido: "UCR",                     bloque: "UCR",         orientacion: "centroderecha" },
  "AR-L": { gobernador: "Sergio Ziliotto",          partido: "Partido Justicialista",   bloque: "Peronismo",   orientacion: "centroizquierda" },
  "AR-M": { gobernador: "Alfredo Cornejo",          partido: "UCR",                     bloque: "UCR",         orientacion: "centroderecha" },
  "AR-N": { gobernador: "Hugo Passalacqua",         partido: "Frente Renovador de la Concordia", bloque: "Provincial", orientacion: "centro" },
  "AR-Q": { gobernador: "Rolando Figueroa",         partido: "La Neuquinidad",          bloque: "Provincial",  orientacion: "centro" },
  "AR-R": { gobernador: "Alberto Weretilneck",      partido: "Juntos Somos Río Negro",  bloque: "Provincial",  orientacion: "centro" },
  "AR-A": { gobernador: "Gustavo Sáenz",            partido: "Partido Renovador de Salta", bloque: "Provincial", orientacion: "centro" },
  "AR-J": { gobernador: "Marcelo Orrego",           partido: "Producción y Trabajo",    bloque: "UCR",         orientacion: "centroderecha" },
  "AR-D": { gobernador: "Claudio Poggi",            partido: "Avanzar San Luis",        bloque: "Provincial",  orientacion: "centroderecha" },
  "AR-Z": { gobernador: "Claudio Vidal",            partido: "Por Santa Cruz",          bloque: "Provincial",  orientacion: "centro" },
  "AR-S": { gobernador: "Maximiliano Pullaro",      partido: "UCR",                     bloque: "UCR",         orientacion: "centroderecha" },
  "AR-G": { gobernador: "Gerardo Zamora",           partido: "Frente Cívico",           bloque: "Peronismo",   orientacion: "centroizquierda" },
  "AR-V": { gobernador: "Gustavo Melella",          partido: "Forja",                   bloque: "Peronismo",   orientacion: "izquierda" },
  "AR-T": { gobernador: "Osvaldo Jaldo",            partido: "Partido Justicialista",   bloque: "Peronismo",   orientacion: "centroizquierda" },
  "AR-F": { gobernador: "Ricardo Quintela",         partido: "Partido Justicialista",   bloque: "Peronismo",   orientacion: "izquierda" },
};

/** Natural Earth nombra igual a la Ciudad y a la Provincia de Buenos Aires. */
const NOMBRE_PROPIO = { "AR-C": "CABA" };

/** Población del Censo Nacional 2022 (INDEC). */
const POBLACION = {
  "AR-B": 17569053, "AR-C": 3120612, "AR-S": 3556522, "AR-X": 3978984, "AR-M": 2014533,
  "AR-T": 1694656, "AR-A": 1424397, "AR-E": 1426426, "AR-W": 1197553, "AR-H": 1129606,
  "AR-G": 1054028, "AR-J": 818234, "AR-Y": 797955, "AR-R": 747610, "AR-N": 1280960,
  "AR-Q": 726590, "AR-F": 384607, "AR-D": 508328, "AR-K": 429556, "AR-P": 605193,
  "AR-L": 358428, "AR-U": 603120, "AR-Z": 333473, "AR-V": 190641,
};

// ─── Descarga y proyección ──────────────────────────────────────────────────

console.log("Bajando geometría de Natural Earth (38 MB)…");
const r = await fetch(NE);
if (!r.ok) throw new Error(`Natural Earth respondió ${r.status}`);
const geo = JSON.parse(await r.text());

const argentinas = geo.features.filter((f) => f.properties?.admin === "Argentina");
if (argentinas.length !== 24) {
  throw new Error(`Se esperaban 24 jurisdicciones y vinieron ${argentinas.length}`);
}
console.log(`  ${argentinas.length} jurisdicciones`);

// Anillos de cada provincia, ya simplificados
const crudas = argentinas.map((f) => {
  const g = f.geometry;
  const poligonos = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  const anillos = poligonos
    .map((poly) => simplificar(poly[0], TOLERANCIA)) // sólo el anillo exterior
    .filter((a) => a.length >= 4);
  return {
    iso: f.properties.iso_3166_2,
    nombre: NOMBRE_PROPIO[f.properties.iso_3166_2] ?? f.properties.name_es ?? f.properties.name,
    anillos,
  };
});

// Límites geográficos para la proyección
let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
for (const p of crudas) for (const a of p.anillos) for (const [lon, lat] of a) {
  if (lon < minLon) minLon = lon;
  if (lon > maxLon) maxLon = lon;
  if (lat < minLat) minLat = lat;
  if (lat > maxLat) maxLat = lat;
}

/**
 * Proyección equirectangular con corrección por latitud. Para un país largo y
 * angosto como Argentina alcanza: sin la corrección el mapa sale achatado a lo
 * ancho porque un grado de longitud mide menos cerca del polo.
 */
const latMedia = ((minLat + maxLat) / 2) * Math.PI / 180;
const kx = Math.cos(latMedia);
const anchoGeo = (maxLon - minLon) * kx;
const altoGeo = maxLat - minLat;
const escala = ANCHO / anchoGeo;
const ALTO = Math.round(altoGeo * escala);

const proyectar = ([lon, lat]) => [
  +(((lon - minLon) * kx) * escala).toFixed(1),
  +((maxLat - lat) * escala).toFixed(1),
];

const provincias = crudas.map((p) => {
  const d = p.anillos
    .map((anillo) => anillo.map(proyectar).map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join("") + "Z")
    .join("");
  // Centroide del anillo más grande, para poner la etiqueta
  const mayor = p.anillos.reduce((a, b) => (a.length >= b.length ? a : b));
  const pts = mayor.map(proyectar);
  const cx = +(pts.reduce((s, q) => s + q[0], 0) / pts.length).toFixed(1);
  const cy = +(pts.reduce((s, q) => s + q[1], 0) / pts.length).toFixed(1);
  const ref = GOBERNADORES[p.iso];
  if (!ref) console.log(`  Ojo: sin gobernador cargado para ${p.iso} (${p.nombre})`);
  return { ...p, d, cx, cy, ref, poblacion: POBLACION[p.iso] ?? null };
});

// ── Controles ────────────────────────────────────────────────────────────────
// Un gobernador que figura en dos provincias significa que alguien está en la
// que no es. Pasó con Weretilneck, cargado en Río Negro y en La Rioja.
const porGobernador = new Map();
for (const p of provincias) {
  const g = p.ref?.gobernador;
  if (!g || g === "—") continue;
  if (porGobernador.has(g)) {
    throw new Error(`${g} figura en ${porGobernador.get(g)} y en ${p.nombre}: uno de los dos está mal`);
  }
  porGobernador.set(g, p.nombre);
}

const nombresRepetidos = provincias.map((p) => p.nombre).filter((n, i, a) => a.indexOf(n) !== i);
if (nombresRepetidos.length) throw new Error(`Nombres duplicados: ${nombresRepetidos.join(", ")}`);

const sinPoblacion = provincias.filter((p) => !p.poblacion).map((p) => p.nombre);
if (sinPoblacion.length) throw new Error(`Sin población: ${sinPoblacion.join(", ")}`);

const sinGobernador = provincias.filter((p) => !p.ref).map((p) => p.iso);
if (sinGobernador.length) throw new Error(`Sin gobernador: ${sinGobernador.join(", ")}`);

const puntos = provincias.reduce((s, p) => s + p.anillos.reduce((t, a) => t + a.length, 0), 0);
console.log(`  ${puntos} puntos tras simplificar · lienzo ${ANCHO}×${ALTO}`);

const hoy = new Date().toISOString().slice(0, 10);

fs.writeFileSync(DESTINO, `/**
 * Las 24 jurisdicciones argentinas: geometría y datos de referencia.
 *
 * Generado por \`node scripts/generar-provincias.mjs\` el ${hoy}.
 * No editar a mano.
 *
 * Los \`d\` son paths de SVG ya proyectados sobre un lienzo de ${ANCHO}×${ALTO}:
 * el navegador sólo tiene que pintarlos. La geometría es de Natural Earth
 * (dominio público), simplificada con Douglas-Peucker.
 *
 * Acá NO hay datos económicos: exportaciones y empleo se piden en runtime a las
 * APIs del Estado porque cambian. Ver \`src/lib/macro-provincias.ts\`.
 */

export const MAPA_ANCHO = ${ANCHO};
export const MAPA_ALTO = ${ALTO};

export type Orientacion = "izquierda" | "centroizquierda" | "centro" | "centroderecha" | "derecha";
export type Bloque = "Peronismo" | "UCR" | "PRO" | "LLA" | "Provincial";

export interface Provincia {
  /** Código ISO 3166-2, p. ej. "AR-B" para Buenos Aires. */
  iso: string;
  nombre: string;
  /** Path SVG ya proyectado. */
  d: string;
  /** Dónde poner la etiqueta. */
  cx: number;
  cy: number;
  gobernador: string;
  partido: string;
  bloque: Bloque;
  orientacion: Orientacion;
  /** Censo Nacional 2022 (INDEC). */
  poblacion: number | null;
}

export const PROVINCIAS: Provincia[] = [
${provincias.map((p) => `  {
    iso: ${JSON.stringify(p.iso)},
    nombre: ${JSON.stringify(p.nombre)},
    gobernador: ${JSON.stringify(p.ref?.gobernador ?? "—")},
    partido: ${JSON.stringify(p.ref?.partido ?? "—")},
    bloque: ${JSON.stringify(p.ref?.bloque ?? "Provincial")},
    orientacion: ${JSON.stringify(p.ref?.orientacion ?? "centro")},
    poblacion: ${p.poblacion},
    cx: ${p.cx}, cy: ${p.cy},
    d: ${JSON.stringify(p.d)},
  },`).join("\n")}
];

export const PROVINCIA_POR_ISO = new Map(PROVINCIAS.map((p) => [p.iso, p]));
`);

console.log(`Listo: ${provincias.length} jurisdicciones en ${DESTINO} (${(fs.statSync(DESTINO).size/1024).toFixed(0)} KB).`);
