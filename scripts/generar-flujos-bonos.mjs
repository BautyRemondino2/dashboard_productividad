/**
 * Genera `src/lib/bonos-flujos.ts`: los flujos de fondos de los soberanos
 * hard-dollar y de las obligaciones negociables.
 *
 *   node scripts/generar-flujos-bonos.mjs
 *
 * Los cronogramas salen de rendimientos.co, que los publica en su API de
 * configuración. Antes estaban escritos a mano desde los prospectos y tenían
 * errores: los 2029 y 2030 quedaban fuera de la curva que formaban los demás.
 *
 * Se bajan **una vez y quedan en el repo** porque son datos fijos —un
 * cronograma de amortización no cambia—. Así el dashboard no depende de que ese
 * sitio esté arriba, y no se le pega un request por cada visita. Los precios
 * siguen viniendo de data912, que es la fuente que ya usa el panel.
 */
import fs from "node:fs";

const CONFIG = "https://rendimientos.co/api/config";
const DESTINO = "src/lib/bonos-flujos.ts";

console.log("Bajando los cronogramas…");
const r = await fetch(CONFIG, {
  headers: { "user-agent": "personal-dashboard/1.0", referer: "https://rendimientos.co/" },
});
if (!r.ok) throw new Error(`La API de configuración respondió ${r.status}`);

const cfg = await r.json();
const soberanos = cfg.soberanos ?? {};
const ons = cfg.ons ?? {};

if (Object.keys(soberanos).length === 0) throw new Error("No vinieron soberanos: ¿cambió el formato?");
if (Object.keys(ons).length === 0) throw new Error("No vinieron ONs: ¿cambió el formato?");

/**
 * Un flujo sin fecha o sin monto no sirve para calcular nada.
 *
 * Y hay una trampa de escala: la fuente publica los soberanos por cada 100 de
 * valor nominal (suman entre 71 y 135) y las ONs por cada 1 (suman entre 1,01 y
 * 1,93). Los precios de las dos vienen en base 100, así que sin normalizar la
 * TIR de una ON no se puede calcular: el valor presente daba ~1 contra un
 * precio de ~101 y la bisección devolvía null para las 51.
 */
function flujosValidos(fs_) {
  const limpios = (fs_ ?? [])
    .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(String(f.fecha)) && Number.isFinite(Number(f.monto)) && Number(f.monto) > 0)
    .map((f) => ({ fecha: String(f.fecha), monto: Number(f.monto) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  if (limpios.length === 0) return [];

  // Ningún bono vivo devuelve menos de 10 por cada 100 de nominal
  const suma = limpios.reduce((s, f) => s + f.monto, 0);
  const escala = suma < 10 ? 100 : 1;

  return limpios.map((f) => ({ fecha: f.fecha, monto: +(f.monto * escala).toFixed(6) }));
}

const listaSoberanos = Object.entries(soberanos)
  .map(([ticker, b]) => ({
    ticker,
    ley: b.ley === "NY" || b.ley === "ny" ? "NY" : "AR",
    vencimiento: String(b.vencimiento ?? "").slice(0, 10),
    flujos: flujosValidos(b.flujos),
  }))
  .filter((b) => b.flujos.length > 0 && b.vencimiento)
  .sort((a, b) => a.ticker.localeCompare(b.ticker));

const listaOns = Object.entries(ons)
  .map(([ticker, o]) => ({
    ticker,
    nombre: String(o.nombre ?? ticker),
    // El símbolo con que cotiza en la fuente de precios que ya usa el panel
    simboloPrecio: String(o.ticker_d912 ?? ""),
    vencimiento: String(o.vencimiento ?? "").slice(0, 10),
    flujos: flujosValidos(o.flujos),
  }))
  .filter((o) => o.flujos.length > 0 && o.vencimiento && o.simboloPrecio)
  .sort((a, b) => a.ticker.localeCompare(b.ticker));

console.log(`  ${listaSoberanos.length} soberanos · ${listaOns.length} obligaciones negociables`);

// ── Controles ────────────────────────────────────────────────────────────────
const hoy = new Date().toISOString().slice(0, 10);

const sinFuturo = [...listaSoberanos, ...listaOns].filter((b) => !b.flujos.some((f) => f.fecha > hoy));
if (sinFuturo.length) {
  console.log(`  Ya vencidos o sin flujos futuros, quedan afuera: ${sinFuturo.map((b) => b.ticker).join(", ")}`);
}
const vivos = (b) => b.flujos.some((f) => f.fecha > hoy);

const soberanosVivos = listaSoberanos.filter(vivos);
const onsVivas = listaOns.filter(vivos);

// Después de normalizar, todo tiene que estar en base 100. Un bono que siga
// sumando poco quedó con la escala mal y su TIR saldría absurda.
const malaEscala = [...soberanosVivos, ...onsVivas].filter(
  (b) => b.flujos.reduce((s, f) => s + f.monto, 0) < 10
);
if (malaEscala.length) {
  throw new Error(`Escala sospechosa en: ${malaEscala.map((b) => b.ticker).join(", ")}`);
}

const rango = (lista) => {
  const sumas = lista.map((b) => b.flujos.reduce((s, f) => s + f.monto, 0));
  return `${Math.min(...sumas).toFixed(1)} a ${Math.max(...sumas).toFixed(1)}`;
};
console.log(`  Suma de flujos por cada 100 VN — soberanos: ${rango(soberanosVivos)} · ONs: ${rango(onsVivas)}`);

const fecha = new Date().toISOString().slice(0, 10);

fs.writeFileSync(DESTINO, `/**
 * Flujos de fondos de los bonos, por cada 100 de valor nominal.
 *
 * Generado por \`node scripts/generar-flujos-bonos.mjs\` el ${fecha}.
 * No editar a mano.
 *
 * Fuente: rendimientos.co, que publica los cronogramas en su API. Cada monto ya
 * combina renta y amortización, que es como se descuentan para sacar la TIR.
 *
 * Se guardan en el repo en vez de pedirlos en cada visita: un cronograma de
 * amortización no cambia, así que no tiene sentido depender de que ese sitio
 * esté arriba. Los precios sí se piden en vivo, a data912.
 */

export interface FlujoBono {
  fecha: string;
  /** Renta + amortización por cada 100 de valor nominal. */
  monto: number;
}

export interface BonoSoberano {
  ticker: string;
  ley: "AR" | "NY";
  vencimiento: string;
  flujos: FlujoBono[];
}

export interface ObligacionNegociable {
  ticker: string;
  nombre: string;
  /** Símbolo con que cotiza en data912. */
  simboloPrecio: string;
  vencimiento: string;
  flujos: FlujoBono[];
}

export const SOBERANOS: BonoSoberano[] = [
${soberanosVivos.map((b) => `  { ticker: ${JSON.stringify(b.ticker)}, ley: ${JSON.stringify(b.ley)}, vencimiento: ${JSON.stringify(b.vencimiento)}, flujos: ${JSON.stringify(b.flujos)} },`).join("\n")}
];

export const ONS: ObligacionNegociable[] = [
${onsVivas.map((o) => `  { ticker: ${JSON.stringify(o.ticker)}, nombre: ${JSON.stringify(o.nombre)}, simboloPrecio: ${JSON.stringify(o.simboloPrecio)}, vencimiento: ${JSON.stringify(o.vencimiento)}, flujos: ${JSON.stringify(o.flujos)} },`).join("\n")}
];
`);

console.log(`Listo: ${soberanosVivos.length} soberanos y ${onsVivas.length} ONs en ${DESTINO} (${(fs.statSync(DESTINO).size/1024).toFixed(0)} KB).`);
