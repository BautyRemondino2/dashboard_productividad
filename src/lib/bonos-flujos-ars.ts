/**
 * Cronogramas de los bonos en pesos ajustados: CER y dólar linked.
 *
 * Generado por `node scripts/generar-flujos-ars.mjs` el 2026-08-26.
 * No editar a mano.
 *
 * Los montos están **en unidades de emisión**, no en pesos: es lo que el bono
 * paga por cada 100 VN medido en moneda del día en que se emitió. El pago real
 * de un CER es `monto × CER_pago / cerEmision`, y el de un dólar linked es
 * `monto × A3500_pago`. Guardar la parte fija y aplicar el ajuste en el
 * runtime es lo que permite calcular una TIR real con el CER de hoy.
 *
 * Cada bono de este archivo pasó el control del generador: descontando este
 * cronograma a la TIR que publica rava se llega al precio al que cotiza, con
 * menos de 0.5% de error.
 *
 * CER de referencia al generar: 821.3973 (2026-08-12) · A3500: 1497.4528 (2026-08-21).
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
  { ticker: "PARP", nombre: "PARP · CER 2038", simboloPrecio: "PARP", vencimiento: "2038-12-31", cerEmision: 1.4551, flujos: [{"fecha":"2026-09-30","monto":0.887447},{"fecha":"2027-03-31","monto":0.882597},{"fecha":"2027-09-30","monto":0.887447},{"fecha":"2028-03-31","monto":0.887447},{"fecha":"2028-09-30","monto":0.887447},{"fecha":"2029-03-31","monto":1.236633},{"fecha":"2029-09-30","monto":6.243552},{"fecha":"2030-03-31","monto":6.174926},{"fecha":"2030-09-30","monto":6.119209},{"fecha":"2031-03-31","monto":6.051262},{"fecha":"2031-09-30","monto":5.994866},{"fecha":"2032-03-31","monto":5.932695},{"fecha":"2032-09-30","monto":5.870524},{"fecha":"2033-03-31","monto":5.803936},{"fecha":"2033-09-30","monto":5.746181},{"fecha":"2034-03-31","monto":5.680272},{"fecha":"2034-09-30","monto":5.621838},{"fecha":"2035-03-31","monto":5.556609},{"fecha":"2035-09-30","monto":5.497495},{"fecha":"2036-03-31","monto":5.435324},{"fecha":"2036-09-30","monto":5.373152},{"fecha":"2037-03-31","monto":5.309282},{"fecha":"2037-09-30","monto":5.24881},{"fecha":"2038-03-31","monto":5.185619},{"fecha":"2038-09-30","monto":5.124467},{"fecha":"2038-12-31","monto":5.031379}] },
  { ticker: "TX26", nombre: "TX26 · CER 2026", simboloPrecio: "TX26", vencimiento: "2026-11-09", cerEmision: 22.544, flujos: [{"fecha":"2026-11-09","monto":20.199496}] },
  { ticker: "TX28", nombre: "TX28 · CER 2028", simboloPrecio: "TX28", vencimiento: "2028-11-09", cerEmision: 22.544, flujos: [{"fecha":"2026-11-09","monto":10.560982},{"fecha":"2027-05-10","monto":10.44879},{"fecha":"2027-11-09","monto":10.338447},{"fecha":"2028-05-09","monto":10.224406},{"fecha":"2028-11-09","monto":10.113447}] },
  { ticker: "TX31", nombre: "TX31 · CER 2031", simboloPrecio: "TX31", vencimiento: "2031-11-30", cerEmision: 46.913, flujos: [{"fecha":"2026-11-30","monto":1.246575},{"fecha":"2027-05-31","monto":11.246575},{"fecha":"2027-11-30","monto":11.128082},{"fecha":"2028-05-30","monto":10.99726},{"fecha":"2028-11-30","monto":10.882191},{"fecha":"2029-05-30","monto":10.743835},{"fecha":"2029-11-30","monto":10.630137},{"fecha":"2030-05-30","monto":10.49589},{"fecha":"2030-12-02","monto":10.382191},{"fecha":"2031-05-30","monto":10.245205},{"fecha":"2031-12-01","monto":10.126712}] },
  { ticker: "TZX27", nombre: "TZX27 · CER 2027", simboloPrecio: "TZX27", vencimiento: "2027-06-30", cerEmision: 200.388, flujos: [{"fecha":"2027-06-30","monto":99.999993}] },
  { ticker: "TZX28", nombre: "TZX28 · CER 2028", simboloPrecio: "TZX28", vencimiento: "2028-06-30", cerEmision: 200.388, flujos: [{"fecha":"2028-06-30","monto":99.999993}] },
  { ticker: "TZXA7", nombre: "TZXA7 · CER 2027", simboloPrecio: "TZXA7", vencimiento: "2027-04-30", cerEmision: 651.898061, flujos: [{"fecha":"2027-04-30","monto":100}] },
  { ticker: "TZXD6", nombre: "TZXD6 · CER 2026", simboloPrecio: "TZXD6", vencimiento: "2026-12-15", cerEmision: 271.0476, flujos: [{"fecha":"2026-12-15","monto":100.000017}] },
  { ticker: "TZXD7", nombre: "TZXD7 · CER 2027", simboloPrecio: "TZXD7", vencimiento: "2027-12-15", cerEmision: 271.0476, flujos: [{"fecha":"2027-12-15","monto":100.000017}] },
  { ticker: "TZXD8", nombre: "TZXD8 · CER 2028", simboloPrecio: "TZXD8", vencimiento: "2028-12-15", cerEmision: 791.489706, flujos: [{"fecha":"2028-12-15","monto":100}] },
  { ticker: "TZXM7", nombre: "TZXM7 · CER 2027", simboloPrecio: "TZXM7", vencimiento: "2027-03-31", cerEmision: 361.3176, flujos: [{"fecha":"2027-03-31","monto":99.999999}] },
  { ticker: "TZXM8", nombre: "TZXM8 · CER 2028", simboloPrecio: "TZXM8", vencimiento: "2028-03-31", cerEmision: 725.206411, flujos: [{"fecha":"2028-03-31","monto":100}] },
  { ticker: "TZXM9", nombre: "TZXM9 · CER 2029", simboloPrecio: "TZXM9", vencimiento: "2029-03-28", cerEmision: 725.875486, flujos: [{"fecha":"2029-03-28","monto":100}] },
  { ticker: "TZXO6", nombre: "TZXO6 · CER 2026", simboloPrecio: "TZXO6", vencimiento: "2026-10-30", cerEmision: 480.1526, flujos: [{"fecha":"2026-10-30","monto":100.000005}] },
  { ticker: "TZXO7", nombre: "TZXO7 · CER 2027", simboloPrecio: "TZXO7", vencimiento: "2027-10-29", cerEmision: 791.489706, flujos: [{"fecha":"2027-10-29","monto":100}] },
  { ticker: "TZXS7", nombre: "TZXS7 · CER 2027", simboloPrecio: "TZXS7", vencimiento: "2027-09-30", cerEmision: 723.059982, flujos: [{"fecha":"2027-09-30","monto":100}] },
  { ticker: "TZXS8", nombre: "TZXS8 · CER 2028", simboloPrecio: "TZXS8", vencimiento: "2028-09-29", cerEmision: 723.059982, flujos: [{"fecha":"2028-09-30","monto":100}] },
  { ticker: "TZXY7", nombre: "TZXY7 · CER 2027", simboloPrecio: "TZXY7", vencimiento: "2027-05-31", cerEmision: 659.678898, flujos: [{"fecha":"2027-05-31","monto":100}] },
  { ticker: "X30N6", nombre: "X30N6 · CER 2026", simboloPrecio: "X30N6", vencimiento: "2026-11-30", cerEmision: 659.6789, flujos: [{"fecha":"2026-11-30","monto":100}] },
  { ticker: "X30S6", nombre: "X30S6 · CER 2026", simboloPrecio: "X30S6", vencimiento: "2026-09-30", cerEmision: 714.9849, flujos: [{"fecha":"2026-09-30","monto":100.000004}] },
];

export const DOLAR_LINKED: BonoDolarLinked[] = [
  { ticker: "D10Y7", nombre: "D10Y7 · dólar linked 2027", simboloPrecio: "D10Y7", vencimiento: "2027-05-10", flujos: [{"fecha":"2027-05-10","monto":100}] },
  { ticker: "D30S6", nombre: "D30S6 · dólar linked 2026", simboloPrecio: "D30S6", vencimiento: "2026-09-30", flujos: [{"fecha":"2026-09-30","monto":100}] },
  { ticker: "D31G6", nombre: "D31G6 · dólar linked 2026", simboloPrecio: "D31G6", vencimiento: "2026-08-31", flujos: [{"fecha":"2026-08-31","monto":100}] },
  { ticker: "D31M7", nombre: "D31M7 · dólar linked 2027", simboloPrecio: "D31M7", vencimiento: "2027-03-31", flujos: [{"fecha":"2027-03-31","monto":100}] },
  { ticker: "TZV27", nombre: "TZV27 · dólar linked 2027", simboloPrecio: "TZV27", vencimiento: "2027-06-30", flujos: [{"fecha":"2027-06-30","monto":100}] },
  { ticker: "TZV28", nombre: "TZV28 · dólar linked 2028", simboloPrecio: "TZV28", vencimiento: "2028-06-30", flujos: [{"fecha":"2028-06-30","monto":100}] },
  { ticker: "TZVD8", nombre: "TZVD8 · dólar linked 2028", simboloPrecio: "TZVD8", vencimiento: "2028-12-15", flujos: [{"fecha":"2028-12-15","monto":100}] },
];
