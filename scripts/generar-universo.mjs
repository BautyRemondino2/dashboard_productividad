/**
 * Regenera el universo del monitor de equity:
 *   - `src/lib/equity-universo.ts`  · las empresas
 *   - `src/lib/equity-sectores.ts`  · los sectores y sus etiquetas
 *
 *   node scripts/generar-universo.mjs
 *
 * De dónde sale cada cosa:
 *
 *   1. El listado de NYSE y Nasdaq viene del screener de Nasdaq, que da
 *      símbolo, nombre, capitalización, precio, país, industria y sector.
 *   2. Se filtra por calidad. NYSE + Nasdaq en crudo son ~6.900 papeles e
 *      incluyen SPACs, cáscaras y biotecs de dos dólares: un ranking de "lo
 *      que más se movió" sobre eso devuelve ruido, no oportunidades.
 *   3. Los ADR argentinos entran siempre, tengan el tamaño que tengan. Este
 *      dashboard lo usa un asesor en Argentina: son los papeles por los que
 *      le preguntan, y varios (SUPV, CRESY, EDN, LOMA, IRS, GLOB) quedan
 *      abajo del filtro de capitalización.
 *   4. El sector de las empresas del S&P 500 se pisa con el GICS del índice,
 *      que es más preciso: la taxonomía de Nasdaq clasifica a Agilent como
 *      "Industrials" cuando es "Health Care".
 *
 * Cada símbolo se valida contra Yahoo antes de escribir nada.
 */
import fs from "node:fs";
import YahooFinance from "yahoo-finance2";

const DESTINO = "src/lib/equity-universo.ts";
const DESTINO_SECTORES = "src/lib/equity-sectores.ts";

const NASDAQ_API = (ex) =>
  `https://api.nasdaq.com/api/screener/stocks?download=true&exchange=${ex}`;
const SP500_CSV =
  "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv";

const CAP_MINIMA = 2e9;
const PRECIO_MINIMO = 5;
const LOTE = 200;

/** ADR argentinos: entran sí o sí, sin importar la capitalización. */
const ADR_ARGENTINOS = [
  "YPF", "GGAL", "BMA", "PAM", "TGS", "SUPV", "BBAR", "CRESY",
  "LOMA", "EDN", "IRS", "TEO", "CEPU", "GLOB", "VIST", "MELI",
];

/**
 * Nasdaq usa su propia taxonomía; el resto del dashboard habla GICS.
 * "Miscellaneous" y los que vienen sin sector caen en "Otros" — inventarles
 * un rubro rompería las medianas sectoriales de la ficha.
 */
const NASDAQ_A_GICS = {
  "Finance": "Financials",
  "Consumer Discretionary": "Consumer Discretionary",
  "Health Care": "Health Care",
  "Technology": "Information Technology",
  "Industrials": "Industrials",
  "Real Estate": "Real Estate",
  "Utilities": "Utilities",
  "Energy": "Energy",
  "Consumer Staples": "Consumer Staples",
  "Basic Materials": "Materials",
  "Telecommunications": "Communication Services",
  "Miscellaneous": "Otros",
};

const TRADUCCION = {
  "Communication Services": "Comunicaciones",
  "Consumer Discretionary": "Consumo discrecional",
  "Consumer Staples": "Consumo básico",
  "Energy": "Energía",
  "Financials": "Financiero",
  "Health Care": "Salud",
  "Industrials": "Industrial",
  "Information Technology": "Tecnología",
  "Materials": "Materiales",
  "Real Estate": "Inmobiliario",
  "Utilities": "Servicios públicos",
  "Otros": "Otros",
};

const yf = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
  validation: { logErrors: false },
});

const aNumero = (s) => Number(String(s ?? "").replace(/[$,]/g, "")) || 0;

/** Yahoo usa guion para las clases de acción: BRK/B → BRK-B */
const aSimboloYahoo = (s) => s.trim().replace(/[./]/g, "-");

/**
 * Renta fija disfrazada de acción: preferidas, notas y warrants tienen ticker
 * propio y Nasdaq les asigna la capitalización de la empresa madre, así que
 * pasan el filtro de tamaño y se cuelan en el ranking. Un preferido de AGNC a
 * US$25 con cupón del 7% no es comparable con una acción.
 *
 * Ojo con el criterio: "Depositary Shares" NO alcanza para descartar — los ADR
 * comunes (Aeroméxico, y todos los argentinos) también se describen así. Lo
 * que discrimina es la mención al instrumento de renta fija.
 */
const NO_ES_ACCION =
  /Preferred|Notes? Due|Senior Notes|Subordinated|Debenture|Fixed-to-Floating|Fixed-Rate Reset|Non-Cumulative|Warrants?\b|\bRights\b/i;

/**
 * El screener arrastra el tipo de instrumento en el nombre, a veces con
 * paréntesis anidados ("… (each representing ten (10) Common Shares)"). En vez
 * de pelear sacando sufijos, se trunca donde arranca el tipo de instrumento:
 * todo lo que viene después es descripción, no nombre de empresa.
 */
const MARCA_INSTRUMENTO =
  /\s*(Common (Stock|Shares?|Units?)|Ordinary Shares?|American Depositary|Unsponsored American|Depositary Shares?|Class [A-Z] (Common|Ordinary)|Shares of Beneficial Interest|\bUnits?\b)/i;

const PARENTESIS_FINAL =
  /\s*\((Ireland|Canada|DE|Delaware|Bermuda|Cayman Islands|Jersey|Luxembourg|Switzerland|United Kingdom|Israel|Puerto Rico|Maryland REIT|Holding Company|France|Netherlands|Japan|new|New)\)\s*$/gi;

function limpiarNombre(nombre) {
  // A veces la fuente omite el espacio: "…(Holding Company)Common Stock"
  let n = String(nombre ?? "").replace(/\)(?=[A-Z])/g, ") ");

  const marca = n.match(MARCA_INSTRUMENTO);
  if (marca) n = n.slice(0, marca.index);

  let antes;
  do { antes = n; n = n.replace(PARENTESIS_FINAL, ""); } while (n !== antes);

  // Se sacan comas y guiones colgando, pero NO el punto: "Inc." lo lleva
  return n.replace(/[\s,\-]+$/, "").trim();
}

/** Parser de CSV mínimo: alcanza para el archivo del S&P (comillas dobles). */
function parseCsv(texto) {
  return texto.trim().split("\n").map((linea) => {
    const campos = [];
    let actual = "";
    let comillas = false;
    for (const c of linea) {
      if (c === '"') comillas = !comillas;
      else if (c === "," && !comillas) { campos.push(actual); actual = ""; }
      else actual += c;
    }
    campos.push(actual);
    return campos;
  });
}

// ─── 1. El listado de las dos bolsas ────────────────────────────────────────

console.log("Bajando NYSE y Nasdaq…");
const crudos = [];
for (const ex of ["nyse", "nasdaq"]) {
  const r = await fetch(NASDAQ_API(ex), {
    headers: { "user-agent": "personal-dashboard", accept: "application/json" },
  });
  if (!r.ok) throw new Error(`El screener de ${ex} respondió ${r.status}`);
  const filas = (await r.json())?.data?.rows;
  if (!Array.isArray(filas) || filas.length === 0) {
    throw new Error(`El screener de ${ex} no devolvió filas: ¿cambió el formato?`);
  }
  for (const x of filas) crudos.push({ ...x, bolsa: ex.toUpperCase() });
  console.log(`  ${ex.toUpperCase()}: ${filas.length}`);
}

// ─── 2. El GICS del S&P 500, que es más preciso ─────────────────────────────

console.log("Bajando los constituyentes del S&P 500 para el sector GICS…");
const csv = await fetch(SP500_CSV, { headers: { "user-agent": "personal-dashboard" } });
if (!csv.ok) throw new Error(`La fuente del S&P respondió ${csv.status}`);
const [enc, ...filasSp] = parseCsv(await csv.text());
const iSim = enc.indexOf("Symbol");
const iSec = enc.indexOf("GICS Sector");
if (iSim < 0 || iSec < 0) throw new Error(`Cambió el formato del CSV: ${enc.join(", ")}`);

const gicsPorTicker = new Map(
  filasSp.filter((f) => f[iSim]).map((f) => [aSimboloYahoo(f[iSim]), f[iSec].trim()])
);
console.log(`  ${gicsPorTicker.size} con GICS`);

// ─── 3. Filtro de calidad ───────────────────────────────────────────────────

const esArgentino = new Set(ADR_ARGENTINOS);
const candidatos = [];
const vistos = new Set();

/** Nasdaq deja `marketCap` vacío en varias clases duales (BF/B, HEI/A…): sin
 *  este rescate se caen empresas de miles de millones sin que se note. */
const sinCap = [];

for (const x of crudos) {
  const ticker = aSimboloYahoo(x.symbol);
  // Los símbolos con "^" son acciones preferidas, no la acción común
  if (!ticker || ticker.includes("^") || vistos.has(ticker)) continue;

  if (NO_ES_ACCION.test(String(x.name ?? ""))) continue;

  const cap = aNumero(x.marketCap);
  const precio = aNumero(x.lastsale);
  const capVacia = !String(x.marketCap ?? "").trim();

  const privilegiado = esArgentino.has(ticker) || gicsPorTicker.has(ticker);
  const pasa = cap >= CAP_MINIMA && precio >= PRECIO_MINIMO;

  if (!pasa && !privilegiado) {
    if (capVacia && precio >= PRECIO_MINIMO) sinCap.push({ x, ticker });
    continue;
  }

  vistos.add(ticker);
  const gics = gicsPorTicker.get(ticker);
  candidatos.push({
    ticker,
    nombre: limpiarNombre(x.name),
    // El GICS del índice gana; si no está, se traduce la taxonomía de Nasdaq
    sector: gics ?? NASDAQ_A_GICS[x.sector] ?? "Otros",
    bolsa: x.bolsa,
    pais: (x.country || "").trim() || null,
    sp500: gicsPorTicker.has(ticker),
    argentino: esArgentino.has(ticker),
  });
}
// Rescate 1: a los de capitalización vacía se la pedimos a Yahoo.
if (sinCap.length) {
  const simbolos = sinCap.map((c) => c.ticker);
  const capYahoo = new Map();
  for (let i = 0; i < simbolos.length; i += LOTE) {
    try {
      const qs = await yf.quote(simbolos.slice(i, i + LOTE), { fields: ["symbol", "marketCap"] }, { validateResult: false });
      for (const q of qs) if (q?.symbol) capYahoo.set(q.symbol, q.marketCap ?? 0);
    } catch { /* si el lote falla, esas quedan afuera */ }
  }
  const rescatadas = sinCap.filter(({ ticker }) => (capYahoo.get(ticker) ?? 0) >= CAP_MINIMA);
  for (const { x, ticker } of rescatadas) {
    if (vistos.has(ticker)) continue;
    vistos.add(ticker);
    const gics = gicsPorTicker.get(ticker);
    candidatos.push({
      ticker,
      nombre: limpiarNombre(x.name),
      sector: gics ?? NASDAQ_A_GICS[x.sector] ?? "Otros",
      bolsa: x.bolsa,
      pais: (x.country || "").trim() || null,
      sp500: gicsPorTicker.has(ticker),
      argentino: esArgentino.has(ticker),
    });
  }
  console.log(`Rescatadas por capitalización vacía en Nasdaq: ${rescatadas.length} (${rescatadas.map((r) => r.ticker).join(", ") || "—"})`);
}

// Rescate 2: los del S&P que ni figuran en el listado de las dos bolsas —
// CBOE, por ejemplo, cotiza en la bolsa propia de Cboe.
const nombreSp = new Map(filasSp.filter((f) => f[iSim]).map((f) => [aSimboloYahoo(f[iSim]), f[enc.indexOf("Security")]]));
const ausentes = [...gicsPorTicker.keys()].filter((t) => !vistos.has(t));
for (const ticker of ausentes) {
  vistos.add(ticker);
  candidatos.push({
    ticker,
    nombre: limpiarNombre(nombreSp.get(ticker) ?? ticker),
    sector: gicsPorTicker.get(ticker),
    bolsa: "OTRA",
    pais: "United States",
    sp500: true,
    argentino: false,
  });
}
if (ausentes.length) console.log(`Del S&P 500 que no figuran en NYSE/Nasdaq: ${ausentes.join(", ")}`);

candidatos.sort((a, b) => a.ticker.localeCompare(b.ticker));

const faltantes = ADR_ARGENTINOS.filter((t) => !vistos.has(t));
if (faltantes.length) console.log(`Ojo — ADR argentinos que no aparecieron: ${faltantes.join(", ")}`);

console.log(`${candidatos.length} candidatos tras filtrar. Validando contra Yahoo…`);

// ─── 4. Validación contra Yahoo ─────────────────────────────────────────────

const vivos = new Set();
for (let i = 0; i < candidatos.length; i += LOTE) {
  const tanda = candidatos.slice(i, i + LOTE);
  try {
    const quotes = await yf.quote(
      tanda.map((c) => c.ticker),
      { fields: ["symbol", "regularMarketPrice"] },
      { validateResult: false }
    );
    for (const q of quotes) if (q?.symbol && q.regularMarketPrice != null) vivos.add(q.symbol);
  } catch (e) {
    console.log(`  lote ${i} falló (${e.message.slice(0, 60)}), se reintenta de a uno`);
    for (const c of tanda) {
      try {
        const q = await yf.quote(c.ticker, { fields: ["symbol", "regularMarketPrice"] }, { validateResult: false });
        if (q?.regularMarketPrice != null) vivos.add(c.ticker);
      } catch { /* el ticker no cotiza: queda afuera */ }
    }
  }
  process.stdout.write(`  ${Math.min(i + LOTE, candidatos.length)}/${candidatos.length}\r`);
}
console.log();

const universo = candidatos.filter((c) => vivos.has(c.ticker));
const descartados = candidatos.filter((c) => !vivos.has(c.ticker));
if (descartados.length) {
  console.log(`Sin precio en Yahoo (${descartados.length}): ${descartados.slice(0, 15).map((d) => d.ticker).join(", ")}${descartados.length > 15 ? "…" : ""}`);
}

const argentinosVivos = universo.filter((u) => u.argentino);
console.log(`ADR argentinos incluidos (${argentinosVivos.length}): ${argentinosVivos.map((a) => a.ticker).join(", ")}`);

// ─── 5. Escritura ───────────────────────────────────────────────────────────

// "Otros" siempre al final: es el cajón de los que no encajan
const sectores = [...new Set(universo.map((u) => u.sector))]
  .sort((a, b) => (a === "Otros" ? 1 : b === "Otros" ? -1 : a.localeCompare(b)));

const hoy = new Date().toISOString().slice(0, 10);

fs.writeFileSync(DESTINO_SECTORES, `/**
 * Sectores del universo de equity, en taxonomía GICS.
 * Generado por \`node scripts/generar-universo.mjs\` el ${hoy}.
 *
 * Separado de \`equity-universo\` a propósito: esto lo importan Client
 * Components, y la lista de empresas no tiene por qué viajar al navegador.
 */

export const SECTORES = [
${sectores.map((s) => `  ${JSON.stringify(s)},`).join("\n")}
] as const;
export type Sector = (typeof SECTORES)[number];

/** Etiquetas en castellano para la UI. */
export const SECTOR_LABEL: Record<Sector, string> = {
${sectores.map((s) => `  ${JSON.stringify(s)}: ${JSON.stringify(TRADUCCION[s] ?? s)},`).join("\n")}
};
`);

fs.writeFileSync(DESTINO, `/**
 * Universo del monitor de equity: NYSE + Nasdaq, filtrado.
 *
 * Generado por \`node scripts/generar-universo.mjs\` el ${hoy}.
 * No editar a mano: correr el script cuando haga falta actualizarlo.
 *
 * Filtro: capitalización ≥ US$${(CAP_MINIMA / 1e9).toFixed(0)}.000M y precio ≥ US$${PRECIO_MINIMO}.
 * Los ADR argentinos entran siempre, sin importar el tamaño.
 *
 * El sector es GICS. Para las empresas del S&P 500 sale del índice; para el
 * resto se traduce la taxonomía de Nasdaq, que es más gruesa.
 */
import type { Sector } from "@/lib/equity-sectores";

export interface EmpresaUniverso {
  ticker: string;
  nombre: string;
  sector: Sector;
  bolsa: "NYSE" | "NASDAQ" | "OTRA";
  pais: string | null;
  /** Si integra el S&P 500 — su sector viene del GICS del índice. */
  sp500: boolean;
  /** ADR argentino: relevante para el asesor aunque sea chico. */
  argentino: boolean;
}

export const UNIVERSO: EmpresaUniverso[] = [
${universo.map((u) => `  { ticker: ${JSON.stringify(u.ticker)}, nombre: ${JSON.stringify(u.nombre)}, sector: ${JSON.stringify(u.sector)}, bolsa: ${JSON.stringify(u.bolsa)}, pais: ${JSON.stringify(u.pais)}, sp500: ${u.sp500}, argentino: ${u.argentino} },`).join("\n")}
];

export const POR_TICKER = new Map(UNIVERSO.map((e) => [e.ticker, e]));
`);

console.log(
  `Listo: ${universo.length} empresas en ${DESTINO} ` +
  `(${universo.filter((u) => u.sp500).length} del S&P 500, ${argentinosVivos.length} ADR argentinos), ` +
  `${sectores.length} sectores en ${DESTINO_SECTORES}.`
);
