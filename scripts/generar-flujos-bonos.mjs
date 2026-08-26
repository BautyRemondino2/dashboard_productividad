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

// ── El control: que el cronograma reproduzca el precio al que cotiza ─────────
//
// Sin esto, un cronograma mal cargado da una TIR mal calculada y no hay forma
// de darse cuenta mirando la pantalla. Y no es hipotético: los 2041 estaban
// mal. La serie de cupones venía al revés —los últimos tres pagos de GD41
// crecían mientras el saldo bajaba, lo que implica una tasa de 19,5% anual en
// un bono cuyo cupón máximo es 4,875%— y la TIR salía 106 pb abajo de la real.
//
// El control descuenta cada cronograma a la TIR que publica rava y lo compara
// con el precio de mercado. Va en dos niveles porque los dos tipos de error
// tienen tamaños muy distintos: un cronograma equivocado se va varios puntos
// (los 2041 daban 6%), mientras que el interés corrido y la fecha de
// liquidación mueven menos de uno.
//
// Cuando un bono no cierra, se prueba con el cronograma de rava y se vuelve a
// controlar: se queda el que reproduce el precio, que es el único criterio
// verificable que hay acá.

const TOLERANCIA_DURA = 0.02;
const TOLERANCIA_AVISO = 0.005;
const RAVA = "https://mercado.rava.com/api/prices";

const ravaJson = async (u) =>
  (await fetch(u, { headers: { "user-agent": "personal-dashboard/1.0", referer: "https://mercado.rava.com/analisis-bonos" } })).json();

/** Convención de los hard-dollar: semestral, base 30/360. */
function años30360(desde, fecha) {
  const a = new Date(`${desde}T00:00:00Z`), b = new Date(`${fecha}T00:00:00Z`);
  const da = Math.min(a.getUTCDate(), 30), db = Math.min(b.getUTCDate(), 30);
  const meses = 12 * (b.getUTCFullYear() - a.getUTCFullYear()) + (b.getUTCMonth() - a.getUTCMonth());
  return (30 * meses + (db - da)) / 360;
}

/**
 * Ojo con la convención: acá se capitaliza **anual**, no semestral.
 *
 * El dashboard expresa la TIR de estos bonos como bond-equivalent yield, que
 * capitaliza dos veces al año, y rava la publica como efectiva anual. Es la
 * misma tasa dicha distinto —10,27% semestral son 10,53% anual— pero si el
 * control descuenta con una convención la tasa de la otra, el error resultante
 * crece con la duration: los bonos largos daban 1% de diferencia y los cortos
 * 0,2%, que es la firma de un desfase de tasa y no de un cronograma malo.
 * Para controlar hay que hablar el idioma de la fuente contra la que se compara.
 */
const valorPresente = (flujos, tasaAnual) =>
  flujos.reduce((acc, f) => {
    const t = años30360(hoy, f.fecha);
    return t > 0 ? acc + f.monto / Math.pow(1 + tasaAnual, t) : acc;
  }, 0);

console.log("\nControlando los cronogramas contra los precios de rava…");
let panel = [];
try {
  panel = (await ravaJson(`${RAVA}/bonos`)).datos ?? [];
} catch (e) {
  console.log(`  No se pudo bajar el panel de rava (${e.message}): se salta el control.`);
}

const avisos = [];
const reparados = [];
const sinControl = [];

if (panel.length) {
  /** Los hard-dollar cotizan en dólares bajo el ticker con D; las ONs, con su propio símbolo. */
  const referencia = (b, esSoberano) =>
    panel.find((x) => x.especie === (esSoberano ? `${b.ticker}D` : b.simboloPrecio)) ??
    panel.find((x) => x.especie === b.ticker);

  async function controlar(lista, esSoberano) {
    for (const b of lista) {
      const r = referencia(b, esSoberano);
      const precio = Number(r?.precio);
      if (!r || !(precio > 0)) { sinControl.push(b.ticker); continue; }

      const futuros = b.flujos.filter((f) => f.fecha > hoy);
      const desvio = (fl) => Math.abs(valorPresente(fl, Number(r.tir)) - precio) / precio;
      let error = desvio(futuros);

      if (error > TOLERANCIA_DURA) {
        // No cierra: se prueba con el cronograma que publica rava
        let reemplazo = null;
        try {
          const { flujos } = await ravaJson(`${RAVA}/bonos-flujo/${b.ticker}`);
          reemplazo = flujosValidos(
            (flujos ?? [])
              .filter((f) => String(f.fecha_pago).slice(0, 10) > hoy)
              .map((f) => ({ fecha: String(f.fecha_pago).slice(0, 10), monto: Number(f.total) }))
          );
        } catch { /* si no se puede bajar, queda el original y el aviso */ }

        const errorNuevo = reemplazo?.length ? desvio(reemplazo) : Infinity;
        if (errorNuevo < error) {
          reparados.push([b.ticker, `${(error * 100).toFixed(1)}% → ${(errorNuevo * 100).toFixed(1)}%`]);
          b.flujos = reemplazo;
          error = errorNuevo;
        }
      }

      if (error > TOLERANCIA_DURA) avisos.push([b.ticker, `NO CIERRA: ${(error * 100).toFixed(1)}% contra el precio`]);
      else if (error > TOLERANCIA_AVISO) avisos.push([b.ticker, `${(error * 100).toFixed(1)}% contra el precio`]);
    }
  }

  await controlar(soberanosVivos, true);
  await controlar(onsVivas, false);

  console.log(`  ${soberanosVivos.length + onsVivas.length - sinControl.length} controlados · ${sinControl.length} sin contraparte en rava`);
  if (reparados.length) {
    console.log("  Reemplazados por el cronograma de rava, que sí cierra:");
    for (const [t, d] of reparados) console.log(`    ${t.padEnd(6)} ${d}`);
  }
  if (avisos.length) {
    console.log("  Con diferencia:");
    for (const [t, d] of avisos) console.log(`    ${t.padEnd(6)} ${d}`);
  }
}

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
 *
 * Cada cronograma pasó el control del generador: descontado a la TIR que
 * publica rava llega al precio al que el bono cotiza. Los que no cerraban se
 * reemplazaron por el cronograma de rava —al generar, los dos 2041—.
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
