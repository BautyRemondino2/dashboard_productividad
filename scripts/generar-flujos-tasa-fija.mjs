/**
 * Genera `src/lib/bonos-flujos-tasa-fija.ts`: los cronogramas de las letras y
 * bonos del Tesoro a **tasa fija en pesos** — Lecaps y Boncaps.
 *
 *   node scripts/generar-flujos-tasa-fija.mjs
 *
 * Es el tercer hermano de `generar-flujos-bonos.mjs` (hard-dollar y ONs) y
 * `generar-flujos-ars.mjs` (CER y dólar linked). Van separados porque las
 * familias se descubren distinto y conviene regenerar una sin tocar las otras.
 *
 * ── Por qué éstos son los más fáciles y los más urgentes ────────────────────
 *
 * Un Lecap no ajusta por nada: paga una cifra fija de pesos en una fecha fija.
 * No hay coeficiente que despejar ni rezago que acertar, así que el cronograma
 * se guarda tal cual viene. Y son, de lejos, lo más operado del mercado de
 * pesos: era el hueco más grande que le quedaba al panel.
 *
 * ── Qué entra ───────────────────────────────────────────────────────────────
 *
 * Las familias se reconocen por el patrón del ticker: letra inicial + día + mes
 * en letra + último dígito del año. `S30S6` vence el 30 de septiembre de 2026.
 *
 *   S…  Lecap  — letra capitalizable, un único pago al vencimiento
 *   T…  Boncap — bono capitalizable, mismo esquema y plazo más largo
 *
 * Se excluyen explícitamente los prefijos que comparten forma pero ajustan por
 * otra cosa, porque mezclarlos rompería la curva: `TX`/`TZX` son CER, `TZV`
 * dólar linked y `TXM` TAMAR. Rinden en otra unidad; un TAMAR al 40% nominal
 * dentro de una curva de tasa fija la levantaría entera.
 *
 * ── El control que decide ───────────────────────────────────────────────────
 *
 * El mismo que usan los otros dos generadores, y no es decorativo: se descuenta
 * el cronograma propio a la TIR que publica rava y se compara contra el precio
 * al que el bono cotiza de verdad. Si no llega, el bono **no entra**. Un
 * vencimiento mal deducido de un ticker da una TIR mal calculada, y una TIR mal
 * calculada es peor que no mostrar el instrumento.
 *
 * ── Ojo: esto caduca ────────────────────────────────────────────────────────
 *
 * Las Lecaps rotan. Cada licitación emite nuevas y las viejas vencen, así que
 * este archivo hay que regenerarlo cada tanto. El panel avisa solo: si todas
 * las letras del archivo vencieron, la curva lo dice en vez de desaparecer.
 */
import fs from "node:fs";

const DESTINO = "src/lib/bonos-flujos-tasa-fija.ts";
const UA = {
  "user-agent": "personal-dashboard/1.0",
  referer: "https://mercado.rava.com/analisis-bonos",
};

/** Misma tolerancia que el generador de CER: 2% de precio para entrar. */
const TOLERANCIA_DURA = 0.02;
const TOLERANCIA_AVISO = 0.005;

const jsonDe = async (url, headers = {}) => {
  const r = await fetch(url, { headers: { ...UA, ...headers } });
  if (!r.ok) throw new Error(`${url} respondió ${r.status}`);
  return r.json();
};

const hoy = new Date().toISOString().slice(0, 10);

/** Lecap (S) y Boncap (T): letra + día + mes en letra + año. */
const ES_TASA_FIJA = (t) => /^[ST]\d{2}[EFMAYJLGSOND]\d$/.test(t);

/** Comparten forma pero ajustan por CER, dólar o TAMAR: no son tasa fija. */
const AJUSTADOS = (t) => /^(TX|TZX|TZV|TXM)/.test(t);

console.log("Bajando el panel de bonos de rava…");
const panel = (await jsonDe("https://mercado.rava.com/api/prices/bonos")).datos ?? [];
if (panel.length === 0) throw new Error("El panel de rava vino vacío: ¿cambió el formato?");

/** Las versiones C y D de un ticker son el mismo bono liquidando en dólares. */
const esPesos = (t) => !/[CD]$/.test(t);

const candidatos = panel.filter(
  (b) =>
    b.tipo === "Título Público" &&
    (b.vencimiento ?? "").slice(0, 10) > hoy &&
    esPesos(b.especie) &&
    ES_TASA_FIJA(b.especie) &&
    !AJUSTADOS(b.especie)
);
console.log(`  ${candidatos.length} candidatos a tasa fija`);

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const mesAño = (iso) => `${MESES[Number(iso.slice(5, 7)) - 1]}-${iso.slice(2, 4)}`;

const nombrar = (ticker, vencimiento) =>
  `${ticker.startsWith("S") ? "Lecap" : "Boncap"} ${mesAño(vencimiento)}`;

/** Los pagos futuros, ya sumados renta + amortización. */
function futuros(flujos) {
  return (flujos ?? [])
    .map((f) => ({ fecha: String(f.fecha_pago).slice(0, 10), total: Number(f.total) }))
    .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f.fecha) && f.fecha > hoy && Number.isFinite(f.total) && f.total > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

const redondear = (n) => +n.toFixed(6);

console.log("Bajando cronogramas…");
const letras = [];
const descartes = [];
const avisos = [];

for (const b of candidatos) {
  const ticker = b.especie;
  try {
    const { flujos } = await jsonDe(`https://mercado.rava.com/api/prices/bonos-flujo/${ticker}`);
    const pagos = futuros(flujos);
    if (pagos.length === 0) { descartes.push([ticker, "sin pagos futuros"]); continue; }

    // El pago del vencimiento tiene que caer en la fecha que publica el panel.
    // Si no coincide, el cronograma es de otro instrumento y no se usa.
    const ultimo = pagos[pagos.length - 1].fecha;
    const venc = b.vencimiento.slice(0, 10);
    if (ultimo !== venc) {
      descartes.push([ticker, `el último pago (${ultimo}) no cae en el vencimiento (${venc})`]);
      continue;
    }

    letras.push({
      ticker,
      nombre: nombrar(ticker, venc),
      simboloPrecio: ticker,
      vencimiento: venc,
      flujos: pagos.map((p) => ({ fecha: p.fecha, monto: redondear(p.total) })),
      tirRava: Number(b.tir) * 100,
      precioRava: Number(b.precio),
    });
  } catch (e) {
    descartes.push([ticker, `no se pudo bajar el cronograma (${e.message})`]);
  }
}

// ── Control: el cronograma tiene que reproducir el precio de mercado ─────────

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

const pasan = [];
for (const b of letras) {
  const implicito = valorPresente(b.flujos, b.tirRava / 100);
  const error = Math.abs(implicito - b.precioRava) / b.precioRava;
  const propia = tir(b.flujos, b.precioRava);
  if (propia == null) { descartes.push([b.ticker, "no converge la TIR"]); continue; }
  if (error > TOLERANCIA_DURA) {
    descartes.push([
      b.ticker,
      `el cronograma no cierra: a la TIR de rava (${b.tirRava.toFixed(2)}%) daría ${implicito.toFixed(2)} y cotiza ${b.precioRava.toFixed(2)} (${(error * 100).toFixed(1)}%)`,
    ]);
    continue;
  }
  if (error > TOLERANCIA_AVISO) avisos.push([b.ticker, `${(error * 100).toFixed(1)}% de diferencia contra el precio de rava`]);
  pasan.push({ ...b, error, tirPropia: propia });
}

pasan.sort((a, b) => a.vencimiento.localeCompare(b.vencimiento));

console.log(`\nTasa fija: ${pasan.length}/${letras.length} pasan el control`);
for (const b of pasan) {
  console.log(`  ${b.ticker.padEnd(6)} ${b.vencimiento}  TIR ${b.tirPropia.toFixed(2)}% (rava ${b.tirRava.toFixed(2)}%)  error de precio ${(b.error * 100).toFixed(2)}%`);
}
if (avisos.length) {
  console.log("\nEntran, pero con la referencia algo corrida:");
  for (const [t, motivo] of avisos) console.log(`  ${t.padEnd(6)} ${motivo}`);
}
if (descartes.length) {
  console.log("\nAfuera:");
  for (const [t, motivo] of descartes) console.log(`  ${t.padEnd(6)} ${motivo}`);
}
if (pasan.length < 4) throw new Error(`Sólo ${pasan.length} instrumentos pasaron: algo cambió en las fuentes.`);

// ── Escritura ────────────────────────────────────────────────────────────────

const fila = (b) =>
  `  { ticker: ${JSON.stringify(b.ticker)}, nombre: ${JSON.stringify(b.nombre)}, simboloPrecio: ${JSON.stringify(b.simboloPrecio)}, vencimiento: ${JSON.stringify(b.vencimiento)}, flujos: ${JSON.stringify(b.flujos)} },`;

fs.writeFileSync(DESTINO, `/**
 * Cronogramas de las letras y bonos del Tesoro a tasa fija en pesos.
 *
 * Generado por \`node scripts/generar-flujos-tasa-fija.mjs\` el ${hoy}.
 * No editar a mano.
 *
 * A diferencia de los CER y los dólar linked, acá los montos están en **pesos
 * corrientes**: una Lecap no ajusta por nada, paga una cifra fija en una fecha
 * fija. Por eso el cronograma se guarda tal cual y el runtime no le aplica
 * ningún coeficiente.
 *
 * Cada instrumento pasó el control del generador: descontando este cronograma a
 * la TIR que publica rava se llega al precio al que cotiza.
 *
 * **Esto caduca.** Las Lecaps rotan con cada licitación: las viejas vencen y se
 * emiten nuevas. Hay que volver a correr el generador cada tanto — la curva
 * avisa en pantalla cuando le quedan pocos instrumentos vivos.
 */

import type { FlujoBono } from "@/lib/bonos-flujos";

export interface LetraTasaFija {
  ticker: string;
  nombre: string;
  /** Símbolo con que cotiza en data912. */
  simboloPrecio: string;
  vencimiento: string;
  /** Pagos en pesos por cada 100 VN. Sin ajuste: son pesos corrientes. */
  flujos: FlujoBono[];
}

export const TASA_FIJA: LetraTasaFija[] = [
${pasan.map(fila).join("\n")}
];
`);

console.log(`\n✓ ${DESTINO} — ${pasan.length} instrumentos`);
