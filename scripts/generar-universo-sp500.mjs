/**
 * Regenera `src/lib/equity-universo.ts` — la lista de constituyentes del S&P 500.
 *
 *   node scripts/generar-universo-sp500.mjs
 *
 * La lista se baja de datahub (mismo cuadro que Wikipedia: símbolo, nombre y
 * sector GICS) y **se valida contra Yahoo antes de escribir nada**: si un ticker
 * no cotiza o cambió de símbolo, queda afuera y se avisa. El índice cambia unas
 * pocas veces al año, así que esto se corre a mano cuando hace falta.
 */
import fs from "node:fs";
import YahooFinance from "yahoo-finance2";

const FUENTE =
  "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv";
const DESTINO = "src/lib/equity-universo.ts";
const DESTINO_SECTORES = "src/lib/equity-sectores.ts";
const LOTE = 200;

/** Los 11 sectores GICS en castellano, para no mostrar la UI mitad en inglés. */
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
};

const yf = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
  validation: { logErrors: false },
});

/** Parser de CSV mínimo: alcanza para este archivo (comillas dobles, sin saltos internos). */
function parseCsv(texto) {
  const filas = [];
  for (const linea of texto.trim().split("\n")) {
    const campos = [];
    let actual = "";
    let entreComillas = false;
    for (let i = 0; i < linea.length; i++) {
      const c = linea[i];
      if (c === '"') entreComillas = !entreComillas;
      else if (c === "," && !entreComillas) { campos.push(actual); actual = ""; }
      else actual += c;
    }
    campos.push(actual);
    filas.push(campos);
  }
  return filas;
}

console.log("Bajando la lista…");
const csv = await fetch(FUENTE, { headers: { "user-agent": "personal-dashboard" } });
if (!csv.ok) throw new Error(`La fuente respondió ${csv.status}`);

const [encabezado, ...filas] = parseCsv(await csv.text());
const col = (n) => encabezado.indexOf(n);
const iSimbolo = col("Symbol");
const iNombre = col("Security");
const iSector = col("GICS Sector");
if (iSimbolo < 0 || iNombre < 0 || iSector < 0) {
  throw new Error(`Cambió el formato del CSV: ${encabezado.join(", ")}`);
}

const candidatos = filas
  .filter((f) => f[iSimbolo])
  .map((f) => ({
    // Yahoo usa guion donde el índice usa punto: BRK.B → BRK-B
    ticker: f[iSimbolo].trim().replace(/\./g, "-"),
    nombre: f[iNombre].trim(),
    sector: f[iSector].trim(),
  }))
  .sort((a, b) => a.ticker.localeCompare(b.ticker));

console.log(`${candidatos.length} candidatos. Validando contra Yahoo…`);

const vivos = new Set();
for (let i = 0; i < candidatos.length; i += LOTE) {
  const tanda = candidatos.slice(i, i + LOTE);
  const quotes = await yf.quote(
    tanda.map((c) => c.ticker),
    { fields: ["symbol", "regularMarketPrice"] },
    { validateResult: false }
  );
  for (const q of quotes) if (q?.symbol && q.regularMarketPrice != null) vivos.add(q.symbol);
  process.stdout.write(`  ${Math.min(i + LOTE, candidatos.length)}/${candidatos.length}\r`);
}
console.log();

const universo = candidatos.filter((c) => vivos.has(c.ticker));
const descartados = candidatos.filter((c) => !vivos.has(c.ticker));
if (descartados.length) {
  console.log(`Sin precio en Yahoo, quedan afuera: ${descartados.map((d) => d.ticker).join(", ")}`);
}

const sectores = [...new Set(universo.map((u) => u.sector))].sort();
const hoy = new Date().toISOString().slice(0, 10);

// Los sectores van en su propio archivo: los usa la UI (que corre en el
// navegador) y así no se arrastra la lista de 500 empresas al bundle del
// cliente — el Map de `POR_TICKER` impide que el bundler la descarte.
const tsSectores = `/**
 * Los 11 sectores GICS. Generado por \`node scripts/generar-universo-sp500.mjs\`.
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
`;

const ts = `/**
 * Constituyentes del S&P 500 — universo del monitor de equity.
 *
 * Generado por \`node scripts/generar-universo-sp500.mjs\` el ${hoy}.
 * No editar a mano: correr el script cuando el índice cambie.
 *
 * El sector es el GICS del índice y viene acá, no de Yahoo: pedirlo por API
 * costaría un request por ticker y sólo cambia cuando la empresa se reclasifica.
 */
import type { Sector } from "@/lib/equity-sectores";

export interface EmpresaUniverso {
  ticker: string;
  nombre: string;
  sector: Sector;
}

export const UNIVERSO_SP500: EmpresaUniverso[] = [
${universo.map((u) => `  { ticker: ${JSON.stringify(u.ticker)}, nombre: ${JSON.stringify(u.nombre)}, sector: ${JSON.stringify(u.sector)} },`).join("\n")}
];

export const POR_TICKER = new Map(UNIVERSO_SP500.map((e) => [e.ticker, e]));
`;

fs.writeFileSync(DESTINO_SECTORES, tsSectores);
fs.writeFileSync(DESTINO, ts);
console.log(`Listo: ${universo.length} empresas en ${DESTINO}, ${sectores.length} sectores en ${DESTINO_SECTORES}.`);
