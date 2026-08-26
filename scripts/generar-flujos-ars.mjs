/**
 * Genera `src/lib/bonos-flujos-ars.ts`: los cronogramas de los bonos en pesos
 * ajustados — CER y dólar linked.
 *
 *   node scripts/generar-flujos-ars.mjs
 *
 * Es el hermano de `generar-flujos-bonos.mjs`, que hace lo mismo con los
 * hard-dollar y las ONs. Van en archivos separados porque las fuentes son
 * distintas y conviene poder regenerar uno sin tocar el otro.
 *
 * ── Por qué hace falta un generador y no una tabla a mano ────────────────────
 *
 * Un bono CER no paga el cupón que dice el prospecto: paga ese cupón
 * multiplicado por cuánto subió el CER desde que se emitió. Para calcular una
 * TIR real hay que separar las dos cosas —el cronograma, que es fijo, del
 * coeficiente, que cambia todos los días— y acá se guarda sólo la parte fija.
 *
 * Los montos quedan expresados **en unidades de emisión**: lo que el bono paga
 * por cada 100 VN medido en pesos del día en que se emitió. El pago real es
 * `monto × CER_pago / cerEmision`, y esa cuenta la hace el runtime con el CER
 * del día.
 *
 * ── Fuentes ─────────────────────────────────────────────────────────────────
 *
 *  - mercado.rava.com/api/prices/bonos          → qué bonos viven, vencimiento
 *  - mercado.rava.com/api/prices/bonos-flujo/X  → el cronograma, ya proyectado
 *  - rendimientos.co/api/config                 → cerEmision de los que lo publican
 *  - api.bcra.gob.ar (v4, id 30)                → CER, para despejar unidades
 *
 * Rava proyecta los flujos ya ajustados por el CER de hoy. Dividiéndolos por el
 * coeficiente vigente se vuelve a las unidades de emisión, que es lo que se
 * guarda. La cuenta es exacta porque todos los pagos de un bono se ajustan por
 * el mismo coeficiente base.
 *
 * ── El control que decide qué entra ─────────────────────────────────────────
 *
 * Rava publica además la TIR que calcula. Al final el script descuenta cada
 * cronograma a esa TIR y mira si llega al precio al que el bono cotiza: si no
 * llega, el bono **no entra al archivo**. Un cronograma mal interpretado da una
 * TIR mal calculada, y una TIR mal calculada es peor que no mostrar el bono.
 *
 * El control no es decorativo: ya dejó afuera a DICP y CUAP, que capitalizan
 * intereses y cuyo cronograma rava devuelve incompleto —su propia TIR no cierra
 * contra sus propios flujos—.
 */
import fs from "node:fs";

const DESTINO = "src/lib/bonos-flujos-ars.ts";
const UA = { "user-agent": "personal-dashboard/1.0", referer: "https://mercado.rava.com/analisis-bonos" };

/**
 * Cuánto puede alejarse nuestro cronograma del de rava, en dos niveles.
 *
 * El control es sobre el **precio**, no sobre la TIR: en un bono a un mes, dos
 * décimas de precio son diez puntos de TIR anualizada, así que una tolerancia
 * en TIR rechazaría bonos sanos del tramo corto y dejaría pasar errores gordos
 * en el largo.
 *
 * Y va en dos niveles porque los dos tipos de error tienen tamaños muy
 * distintos. Un cronograma mal interpretado se va lejos: cuando esta fuente
 * publicaba los flujos de DICP sin la capitalización, el precio daba 21% abajo,
 * y CUAP 28%. En cambio, que la referencia y el precio sean de instantes
 * distintos —o que la fuente use un dólar de otro día, cosa que hace: para
 * D30S6 usa el A3500 de tres hábiles antes y para TZVD8 uno diez pesos más
 * caro— mueve menos de un punto.
 *
 * Así que abajo de 2% el bono entra, y entre 0,5% y 2% entra pero avisando. Con
 * el corte único en 0,5% se caían cuatro dólar linked cuyo cronograma es un
 * único pago de 100 dólares al vencimiento: no hay nada ahí que interpretar mal.
 */
const TOLERANCIA_DURA = 0.02;
const TOLERANCIA_AVISO = 0.005;

/**
 * El CER se aplica con diez días hábiles de rezago.
 *
 * No es un detalle: el prospecto dice que cada pago usa el CER de diez hábiles
 * antes, y con inflación del 2% mensual esos diez días son ~1% de coeficiente.
 * En un bono a tres meses, 1% de precio son varios puntos de TIR — usar el CER
 * del día manda todo el tramo corto varios puntos arriba de donde cotiza.
 */
const REZAGO_HABILES = 10;

const jsonDe = async (url, headers = {}) => {
  const r = await fetch(url, { headers: { ...UA, ...headers } });
  if (!r.ok) throw new Error(`${url} respondió ${r.status}`);
  return r.json();
};

const hoy = new Date().toISOString().slice(0, 10);

// ── Convenciones de ticker ───────────────────────────────────────────────────
//
// El Tesoro nombra sus bonos por familia, y la letra inicial dice el ajuste.
// Se listan como patrones y no como una lista de tickers para que el script
// levante las emisiones nuevas solo, sin tener que editarlo en cada licitación.

/** Boncer cupón cero (TZX), Boncer con cupón (TX) y Lecer (X). */
const ES_CER = (t) => (/^TZX/.test(t) || /^TX\d/.test(t) || /^X\d/.test(t)) && !/^TXM/.test(t);

/** Los tres del canje 2005, que no siguen ninguna convención. */
const CER_CANJE_2005 = ["DICP", "PARP", "CUAP"];

/**
 * Dólar linked: los bonos TZV y las letras D + día + mes + año.
 *
 * El mes va en letra (E=enero … D=diciembre), así que `D30S6` vence el 30 de
 * septiembre de 2026. Se valida contra el vencimiento que publica rava en vez
 * de confiar en el parseo.
 */
const ES_DOLAR_LINKED = (t) => /^TZV/.test(t) || /^D\d{2}[EFMAYJLGSOND]\d$/.test(t);

/**
 * Ojo con TXM*: son ajustados por TAMAR, no por CER. Comparten prefijo con los
 * Boncer y rinden 40% nominal en vez de 10% real; mezclarlos rompería la curva.
 */

// ── CER del día, rezagado ────────────────────────────────────────────────────

console.log("Bajando CER y A3500 del BCRA…");
const cerSerie = (await jsonDe("https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/30?limit=60"))
  .results[0].detalle;
const cerPorFecha = new Map(cerSerie.map((d) => [d.fecha, d.valor]));

/** La fecha de `n` días hábiles atrás. Sin feriados: mueve el CER ~0,07%. */
function habilesAtras(desde, n) {
  const d = new Date(`${desde}T00:00:00Z`);
  let quedan = n;
  while (quedan > 0) {
    d.setUTCDate(d.getUTCDate() - 1);
    const dia = d.getUTCDay();
    if (dia !== 0 && dia !== 6) quedan--;
  }
  return d.toISOString().slice(0, 10);
}

let fechaCer = habilesAtras(hoy, REZAGO_HABILES);
while (!cerPorFecha.has(fechaCer)) fechaCer = habilesAtras(fechaCer, 1);
const CER_HOY = cerPorFecha.get(fechaCer);
console.log(`  CER ${fechaCer} = ${CER_HOY.toFixed(4)} (${REZAGO_HABILES} hábiles antes de ${hoy})`);

/**
 * El A3500 también va rezagado, pero tres hábiles y no diez.
 *
 * Es la letra chica de los dólar linked: el prospecto liquida al tipo de cambio
 * de tres días hábiles antes del pago. Verificado despejando el dólar implícito
 * en la TIR que publica rava para los siete bonos vivos: da 1497,4528 en todos,
 * que es exactamente el A3500 de tres hábiles atrás.
 */
const REZAGO_FX_HABILES = 3;

const a3500Serie = (await jsonDe("https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/5?limit=20"))
  .results[0].detalle;
const a3500PorFecha = new Map(a3500Serie.map((d) => [d.fecha, d.valor]));
/** El último publicado: es con el que rava proyecta los pagos que devuelve. */
const a3500Proyeccion = a3500Serie[0].valor;
let fechaFx = habilesAtras(hoy, REZAGO_FX_HABILES);
while (!a3500PorFecha.has(fechaFx)) fechaFx = habilesAtras(fechaFx, 1);
const a3500 = { fecha: fechaFx, valor: a3500PorFecha.get(fechaFx) };
console.log(`  A3500 ${a3500.fecha} = ${a3500.valor.toFixed(4)} (${REZAGO_FX_HABILES} hábiles antes de ${hoy})`);

// ── Universo ─────────────────────────────────────────────────────────────────

console.log("Bajando el panel de bonos de rava…");
const panel = (await jsonDe("https://mercado.rava.com/api/prices/bonos")).datos ?? [];
if (panel.length === 0) throw new Error("El panel de rava vino vacío: ¿cambió el formato?");

/** Las versiones C y D de un ticker son el mismo bono liquidando en dólares. */
const esPesos = (t) => !/[CD]$/.test(t) || CER_CANJE_2005.includes(t);

const vivos = panel.filter(
  (b) => b.tipo === "Título Público" && b.vencimiento?.slice(0, 10) > hoy && esPesos(b.especie)
);

const candidatosCer = vivos.filter((b) => ES_CER(b.especie) || CER_CANJE_2005.includes(b.especie));
const candidatosDl = vivos.filter((b) => ES_DOLAR_LINKED(b.especie));
console.log(`  ${candidatosCer.length} candidatos CER · ${candidatosDl.length} dólar linked`);

// `cerEmision` de los que lo publican: es el dato que permite despejar unidades
console.log("Bajando cerEmision de rendimientos.co…");
const cfg = await jsonDe("https://rendimientos.co/api/config", { referer: "https://rendimientos.co/" });
const cerEmisionPublicado = new Map(
  Object.entries(cfg.bonos_cer ?? []).map(([t, b]) => [t, Number(b.cer_emision)])
);
// DICP, PARP y CUAP salieron del mismo canje y comparten CER base
const baseCanje2005 = cerEmisionPublicado.get("DICP") ?? cerEmisionPublicado.get("PARP");
if (baseCanje2005) for (const t of CER_CANJE_2005) if (!cerEmisionPublicado.has(t)) cerEmisionPublicado.set(t, baseCanje2005);
console.log(`  ${cerEmisionPublicado.size} con CER de emisión conocido`);

// ── Nombres ──────────────────────────────────────────────────────────────────

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "dic-27" a partir de una fecha ISO. */
const mesAño = (iso) => `${MESES[Number(iso.slice(5, 7)) - 1]}-${iso.slice(2, 4)}`;

/**
 * Cómo se llama cada bono, por familia.
 *
 * El ticker no dice nada por sí solo —TZXD7 y X30N6 son dos cosas distintas— y
 * en el detalle del gráfico el nombre es lo que ubica al que no los tiene todos
 * en la cabeza. La familia sale del prefijo, que es la misma convención con la
 * que se los descubre más arriba.
 */
function nombrarCer(ticker, vencimiento) {
  if (ticker === "DICP") return "Discount en pesos";
  if (ticker === "PARP") return "Par en pesos";
  if (ticker === "CUAP") return "Cuasipar en pesos";
  if (/^TZX/.test(ticker)) return `Boncer cupón cero ${mesAño(vencimiento)}`;
  if (/^X/.test(ticker)) return `Lecer ${mesAño(vencimiento)}`;
  return `Boncer ${mesAño(vencimiento)}`;
}

const nombrarDl = (ticker, vencimiento) =>
  `${/^TZV/.test(ticker) ? "Bono" : "Letra"} dólar linked ${mesAño(vencimiento)}`;

// ── Cronogramas ──────────────────────────────────────────────────────────────

const flujoDe = async (ticker) => jsonDe(`https://mercado.rava.com/api/prices/bonos-flujo/${ticker}`);

/**
 * En qué unidad vino el pago.
 *
 * La fuente no es consistente consigo misma: el flujo de TZV27 vuelve en
 * dólares (100 por cada 100 VN) y el de TZVD8, que es el mismo tipo de bono, en
 * pesos ya convertidos al A3500 (151.416 por cada 100 VN). Se decide por cuál
 * de las dos lecturas deja el pago cerca del saldo, que es lo que un bullet
 * tiene que devolver.
 */
function enDolares(total, saldo, fx) {
  const comoDolar = total / saldo;
  const comoPeso = total / saldo / fx;
  return Math.abs(comoDolar - 1) < Math.abs(comoPeso - 1) ? total : total / fx;
}

/** Los pagos futuros, ya sumados renta + amortización. */
function futuros(flujos) {
  return (flujos ?? [])
    .map((f) => ({ fecha: String(f.fecha_pago).slice(0, 10), total: Number(f.total), saldo: Number(f.saldo) }))
    .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f.fecha) && f.fecha > hoy && Number.isFinite(f.total) && f.total > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

const redondear = (n) => +n.toFixed(6);

console.log("Bajando cronogramas…");
const cer = [];
const descartes = [];
const avisos = [];

for (const b of candidatosCer) {
  const ticker = b.especie;
  try {
    const { flujos } = await flujoDe(ticker);
    const pagos = futuros(flujos);
    if (pagos.length === 0) { descartes.push([ticker, "sin pagos futuros"]); continue; }

    // El coeficiente sale del `cerEmision` publicado; si no lo hay, se despeja
    // del bullet: un bono que paga todo al final devuelve el saldo × coeficiente
    let cerEmision = cerEmisionPublicado.get(ticker);
    if (cerEmision == null) {
      if (pagos.length !== 1) { descartes.push([ticker, "sin cerEmision y con cronograma no bullet"]); continue; }
      cerEmision = CER_HOY / (pagos[0].total / pagos[0].saldo);
    }

    const coef = CER_HOY / cerEmision;
    if (!(coef > 1)) { descartes.push([ticker, `coeficiente CER absurdo (${coef.toFixed(3)})`]); continue; }

    cer.push({
      ticker,
      nombre: nombrarCer(ticker, b.vencimiento.slice(0, 10)),
      simboloPrecio: ticker,
      vencimiento: b.vencimiento.slice(0, 10),
      cerEmision: redondear(cerEmision),
      flujos: pagos.map((p) => ({ fecha: p.fecha, monto: redondear(p.total / coef) })),
      tirRava: Number(b.tir) * 100,
      precioRava: Number(b.precio),
    });
  } catch (e) {
    descartes.push([ticker, `no se pudo bajar el cronograma (${e.message})`]);
  }
}

const dolarLinked = [];
for (const b of candidatosDl) {
  const ticker = b.especie;
  try {
    const { flujos } = await flujoDe(ticker);
    const pagos = futuros(flujos);
    if (pagos.length === 0) { descartes.push([ticker, "sin pagos futuros"]); continue; }

    // Todos los dólar linked vivos son bullet: pagan 100 dólares al vencimiento
    // convertidos al A3500. Si alguna emisión nueva trae cupones, esto lo avisa
    // en vez de calcular mal.
    if (pagos.length !== 1) { descartes.push([ticker, `${pagos.length} pagos: no es bullet, revisar`]); continue; }

    // Cuando viene en pesos, la proyección usa el A3500 del día y no el
    // rezagado: para leer cuántos dólares paga hay que dividir por ese mismo
    const dolares = enDolares(pagos[0].total, pagos[0].saldo, a3500Proyeccion) / pagos[0].saldo * 100;
    if (Math.abs(dolares - 100) > 0.5) {
      descartes.push([ticker, `el pago no da 100 dólares por cada 100 VN (da ${dolares.toFixed(2)}): ¿no es dólar linked?`]);
      continue;
    }

    dolarLinked.push({
      ticker,
      nombre: nombrarDl(ticker, b.vencimiento.slice(0, 10)),
      simboloPrecio: ticker,
      vencimiento: b.vencimiento.slice(0, 10),
      flujos: [{ fecha: pagos[0].fecha, monto: redondear(pagos[0].saldo) }],
      tirRava: Number(b.tir) * 100,
      precioRava: Number(b.precio),
    });
  } catch (e) {
    descartes.push([ticker, `no se pudo bajar el cronograma (${e.message})`]);
  }
}

// ── Control: recalcular la TIR y compararla contra la de rava ────────────────
//
// Misma cuenta que hace el runtime, con el precio que publica rava para que la
// comparación sea contra el mismo precio y no contra otro cierre.

const años = (desde, hasta) =>
  (new Date(`${hasta}T00:00:00Z`) - new Date(`${desde}T00:00:00Z`)) / (365 * 86400000);

function valorPresente(flujos, tasa) {
  let vp = 0;
  for (const f of flujos) {
    const t = años(hoy, f.fecha);
    if (t > 0) vp += f.monto / Math.pow(1 + tasa, t);
  }
  return vp;
}

function tir(flujos, precio) {
  let bajo = -0.95, alto = 10;
  if (valorPresente(flujos, bajo) < precio || valorPresente(flujos, alto) > precio) return null;
  for (let i = 0; i < 200; i++) {
    const medio = (bajo + alto) / 2;
    if (valorPresente(flujos, medio) > precio) bajo = medio;
    else alto = medio;
  }
  return ((bajo + alto) / 2) * 100;
}

/**
 * Descuenta el cronograma propio a la TIR que publica rava y compara el precio
 * que sale contra el que el bono tiene de verdad. Si el cronograma es el mismo,
 * los dos precios coinciden; si no, el bono queda afuera.
 */
function controlar(lista, precioAjustado) {
  const pasan = [];
  for (const b of lista) {
    const precio = precioAjustado(b);
    const implicito = valorPresente(b.flujos, b.tirRava / 100);
    const error = Math.abs(implicito - precio) / precio;
    const propia = tir(b.flujos, precio);
    if (propia == null) { descartes.push([b.ticker, "no converge la TIR"]); continue; }
    if (error > TOLERANCIA_DURA) {
      descartes.push([
        b.ticker,
        `el cronograma no cierra: a la TIR de rava (${b.tirRava.toFixed(2)}%) daría ${implicito.toFixed(2)} y cotiza ${precio.toFixed(2)} (${(error * 100).toFixed(1)}%)`,
      ]);
      continue;
    }
    if (error > TOLERANCIA_AVISO) avisos.push([b.ticker, `${(error * 100).toFixed(1)}% de diferencia contra el precio de rava`]);
    pasan.push({ ...b, error, tirPropia: propia });
  }
  return pasan;
}

const cerOk = controlar(cer, (b) => b.precioRava / (CER_HOY / b.cerEmision));
const dlOk = controlar(dolarLinked, (b) => b.precioRava / a3500.valor);

console.log(`\nCER: ${cerOk.length}/${cer.length} pasan el control`);
for (const b of cerOk) console.log(`  ${b.ticker.padEnd(6)} ${b.vencimiento}  TIR ${b.tirPropia.toFixed(2)}% (rava ${b.tirRava.toFixed(2)}%)  error de precio ${(b.error * 100).toFixed(2)}%`);
console.log(`Dólar linked: ${dlOk.length}/${dolarLinked.length} pasan el control`);
for (const b of dlOk) console.log(`  ${b.ticker.padEnd(6)} ${b.vencimiento}  TIR ${b.tirPropia.toFixed(2)}% (rava ${b.tirRava.toFixed(2)}%)  error de precio ${(b.error * 100).toFixed(2)}%`);

if (avisos.length) {
  console.log("\nEntran, pero con la referencia algo corrida:");
  for (const [t, motivo] of avisos) console.log(`  ${t.padEnd(6)} ${motivo}`);
}

if (descartes.length) {
  console.log("\nAfuera:");
  for (const [t, motivo] of descartes) console.log(`  ${t.padEnd(6)} ${motivo}`);
}

if (cerOk.length < 6) throw new Error(`Sólo ${cerOk.length} bonos CER pasaron: algo cambió en las fuentes.`);
if (dlOk.length < 2) throw new Error(`Sólo ${dlOk.length} dólar linked pasaron: algo cambió en las fuentes.`);

// ── Escritura ────────────────────────────────────────────────────────────────

const fila = (b, extra = "") =>
  `  { ticker: ${JSON.stringify(b.ticker)}, nombre: ${JSON.stringify(b.nombre)}, simboloPrecio: ${JSON.stringify(b.simboloPrecio)}, vencimiento: ${JSON.stringify(b.vencimiento)},${extra} flujos: ${JSON.stringify(b.flujos)} },`;

fs.writeFileSync(DESTINO, `/**
 * Cronogramas de los bonos en pesos ajustados: CER y dólar linked.
 *
 * Generado por \`node scripts/generar-flujos-ars.mjs\` el ${hoy}.
 * No editar a mano.
 *
 * Los montos están **en unidades de emisión**, no en pesos: es lo que el bono
 * paga por cada 100 VN medido en moneda del día en que se emitió. El pago real
 * de un CER es \`monto × CER_pago / cerEmision\`, y el de un dólar linked es
 * \`monto × A3500_pago\`. Guardar la parte fija y aplicar el ajuste en el
 * runtime es lo que permite calcular una TIR real con el CER de hoy.
 *
 * Cada bono de este archivo pasó el control del generador: descontando este
 * cronograma a la TIR que publica rava se llega al precio al que cotiza, con
 * menos de ${(TOLERANCIA_DURA * 100).toFixed(0)}% de error.
 *
 * CER de referencia al generar: ${CER_HOY.toFixed(4)} (${fechaCer}) · A3500: ${a3500.valor.toFixed(4)} (${a3500.fecha}).
 */

import type { FlujoBono } from "@/lib/bonos-flujos";

export interface BonoCer {
  ticker: string;
  nombre: string;
  /** Símbolo con que cotiza en data912. */
  simboloPrecio: string;
  vencimiento: string;
  /** CER del día de emisión: el divisor que lleva los pagos a pesos de hoy. */
  cerEmision: number;
  flujos: FlujoBono[];
}

export interface BonoDolarLinked {
  ticker: string;
  nombre: string;
  simboloPrecio: string;
  vencimiento: string;
  /** En dólares por cada 100 VN: se pagan en pesos al A3500 del vencimiento. */
  flujos: FlujoBono[];
}

export const BONOS_CER: BonoCer[] = [
${cerOk.map((b) => fila(b, ` cerEmision: ${b.cerEmision},`)).join("\n")}
];

export const DOLAR_LINKED: BonoDolarLinked[] = [
${dlOk.map((b) => fila(b)).join("\n")}
];
`);

console.log(`\nListo: ${cerOk.length} CER y ${dlOk.length} dólar linked en ${DESTINO}.`);
