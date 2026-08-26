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
 * menos de 2% de error.
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
  { ticker: "CUAP", nombre: "Cuasipar en pesos", simboloPrecio: "CUAP", vencimiento: "2045-12-31", cerEmision: 1.4551, flujos: [{"fecha":"2027-01-04","monto":2.298119},{"fecha":"2027-06-30","monto":2.298119},{"fecha":"2028-01-03","monto":2.298119},{"fecha":"2028-06-30","monto":2.298119},{"fecha":"2029-01-02","monto":2.298119},{"fecha":"2029-07-02","monto":2.298119},{"fecha":"2030-01-02","monto":2.298119},{"fecha":"2030-07-01","monto":2.298119},{"fecha":"2031-01-02","monto":2.298119},{"fecha":"2031-06-30","monto":2.298119},{"fecha":"2032-01-02","monto":2.298119},{"fecha":"2032-06-30","monto":2.298119},{"fecha":"2033-01-03","monto":2.298119},{"fecha":"2033-06-30","monto":2.298119},{"fecha":"2034-01-02","monto":2.298119},{"fecha":"2034-06-30","monto":2.298119},{"fecha":"2035-01-02","monto":2.298119},{"fecha":"2035-07-02","monto":2.298119},{"fecha":"2036-01-02","monto":2.298119},{"fecha":"2036-06-30","monto":9.241078},{"fecha":"2037-01-02","monto":9.126172},{"fecha":"2037-06-30","monto":9.011266},{"fecha":"2038-01-04","monto":8.89636},{"fecha":"2038-06-30","monto":8.781454},{"fecha":"2039-01-03","monto":8.666548},{"fecha":"2039-06-30","monto":8.551642},{"fecha":"2040-01-02","monto":8.436736},{"fecha":"2040-07-02","monto":8.32183},{"fecha":"2041-01-02","monto":8.206924},{"fecha":"2041-07-01","monto":8.092018},{"fecha":"2042-01-02","monto":7.977112},{"fecha":"2042-06-30","monto":7.862206},{"fecha":"2043-01-02","monto":7.7473},{"fecha":"2043-06-30","monto":7.632394},{"fecha":"2044-01-04","monto":7.517488},{"fecha":"2044-06-30","monto":7.402582},{"fecha":"2045-01-02","monto":7.287676},{"fecha":"2045-06-30","monto":7.172771},{"fecha":"2046-01-02","monto":7.057865}] },
  { ticker: "DICP", nombre: "Discount en pesos", simboloPrecio: "DICP", vencimiento: "2033-12-31", cerEmision: 1.4551, flujos: [{"fecha":"2027-01-04","monto":9.126076},{"fecha":"2027-06-30","monto":8.940983},{"fecha":"2028-01-03","monto":8.75589},{"fecha":"2028-06-30","monto":8.570797},{"fecha":"2029-01-02","monto":8.385704},{"fecha":"2029-07-02","monto":8.20061},{"fecha":"2030-01-02","monto":8.015517},{"fecha":"2030-07-01","monto":7.830424},{"fecha":"2031-01-02","monto":7.645331},{"fecha":"2031-06-30","monto":7.460238},{"fecha":"2032-01-02","monto":7.275145},{"fecha":"2032-06-30","monto":7.090052},{"fecha":"2033-01-03","monto":6.904958},{"fecha":"2033-06-30","monto":6.719865},{"fecha":"2034-01-02","monto":6.534772}] },
  { ticker: "PARP", nombre: "Par en pesos", simboloPrecio: "PARP", vencimiento: "2038-12-31", cerEmision: 1.4551, flujos: [{"fecha":"2026-09-30","monto":0.885},{"fecha":"2027-03-31","monto":0.885},{"fecha":"2027-09-30","monto":0.885},{"fecha":"2028-03-31","monto":0.885},{"fecha":"2028-10-02","monto":0.885},{"fecha":"2029-04-02","monto":0.885},{"fecha":"2029-10-01","monto":6.240001},{"fecha":"2030-04-01","monto":6.178001},{"fecha":"2030-09-30","monto":6.116001},{"fecha":"2031-03-31","monto":6.054001},{"fecha":"2031-09-30","monto":5.992001},{"fecha":"2032-03-31","monto":5.930001},{"fecha":"2032-09-30","monto":5.868},{"fecha":"2033-03-31","monto":5.806},{"fecha":"2033-09-30","monto":5.744},{"fecha":"2034-03-31","monto":5.682},{"fecha":"2034-10-02","monto":5.62},{"fecha":"2035-04-02","monto":5.558},{"fecha":"2035-10-01","monto":5.496},{"fecha":"2036-03-31","monto":5.434},{"fecha":"2036-09-30","monto":5.372},{"fecha":"2037-03-31","monto":5.31},{"fecha":"2037-09-30","monto":5.248},{"fecha":"2038-03-31","monto":5.186},{"fecha":"2038-09-30","monto":5.124},{"fecha":"2038-12-31","monto":5.031}] },
  { ticker: "TX26", nombre: "Boncer nov-26", simboloPrecio: "TX26", vencimiento: "2026-11-09", cerEmision: 22.544, flujos: [{"fecha":"2026-11-09","monto":20.200002}] },
  { ticker: "TX28", nombre: "Boncer nov-28", simboloPrecio: "TX28", vencimiento: "2028-11-09", cerEmision: 22.544, flujos: [{"fecha":"2026-11-09","monto":10.562501},{"fecha":"2027-05-10","monto":10.450001},{"fecha":"2027-11-09","monto":10.337501},{"fecha":"2028-05-09","monto":10.225001},{"fecha":"2028-11-09","monto":10.112501}] },
  { ticker: "TX31", nombre: "Boncer nov-31", simboloPrecio: "TX31", vencimiento: "2031-11-30", cerEmision: 46.913, flujos: [{"fecha":"2026-11-30","monto":1.249996},{"fecha":"2027-05-31","monto":11.249968},{"fecha":"2027-11-30","monto":11.124969},{"fecha":"2028-05-30","monto":10.999969},{"fecha":"2028-11-30","monto":10.874969},{"fecha":"2029-05-30","monto":10.74997},{"fecha":"2029-11-30","monto":10.62497},{"fecha":"2030-05-30","monto":10.499971},{"fecha":"2030-12-02","monto":10.374971},{"fecha":"2031-05-30","monto":10.249971},{"fecha":"2031-12-01","monto":10.124972}] },
  { ticker: "TZX27", nombre: "Boncer cupón cero jun-27", simboloPrecio: "TZX27", vencimiento: "2027-06-30", cerEmision: 200.388, flujos: [{"fecha":"2027-06-30","monto":99.999993}] },
  { ticker: "TZX28", nombre: "Boncer cupón cero jun-28", simboloPrecio: "TZX28", vencimiento: "2028-06-30", cerEmision: 200.388, flujos: [{"fecha":"2028-06-30","monto":99.999993}] },
  { ticker: "TZXA7", nombre: "Boncer cupón cero abr-27", simboloPrecio: "TZXA7", vencimiento: "2027-04-30", cerEmision: 651.898061, flujos: [{"fecha":"2027-04-30","monto":100}] },
  { ticker: "TZXD6", nombre: "Boncer cupón cero dic-26", simboloPrecio: "TZXD6", vencimiento: "2026-12-15", cerEmision: 271.0476, flujos: [{"fecha":"2026-12-15","monto":100.000017}] },
  { ticker: "TZXD7", nombre: "Boncer cupón cero dic-27", simboloPrecio: "TZXD7", vencimiento: "2027-12-15", cerEmision: 271.0476, flujos: [{"fecha":"2027-12-15","monto":100.000017}] },
  { ticker: "TZXD8", nombre: "Boncer cupón cero dic-28", simboloPrecio: "TZXD8", vencimiento: "2028-12-15", cerEmision: 791.489706, flujos: [{"fecha":"2028-12-15","monto":100}] },
  { ticker: "TZXM7", nombre: "Boncer cupón cero mar-27", simboloPrecio: "TZXM7", vencimiento: "2027-03-31", cerEmision: 361.3176, flujos: [{"fecha":"2027-03-31","monto":99.999999}] },
  { ticker: "TZXM8", nombre: "Boncer cupón cero mar-28", simboloPrecio: "TZXM8", vencimiento: "2028-03-31", cerEmision: 725.206411, flujos: [{"fecha":"2028-03-31","monto":100}] },
  { ticker: "TZXM9", nombre: "Boncer cupón cero mar-29", simboloPrecio: "TZXM9", vencimiento: "2029-03-28", cerEmision: 725.875486, flujos: [{"fecha":"2029-03-28","monto":100}] },
  { ticker: "TZXO6", nombre: "Boncer cupón cero oct-26", simboloPrecio: "TZXO6", vencimiento: "2026-10-30", cerEmision: 480.1526, flujos: [{"fecha":"2026-10-30","monto":100.000005}] },
  { ticker: "TZXO7", nombre: "Boncer cupón cero oct-27", simboloPrecio: "TZXO7", vencimiento: "2027-10-29", cerEmision: 791.489706, flujos: [{"fecha":"2027-10-29","monto":100}] },
  { ticker: "TZXS7", nombre: "Boncer cupón cero sep-27", simboloPrecio: "TZXS7", vencimiento: "2027-09-30", cerEmision: 723.059982, flujos: [{"fecha":"2027-09-30","monto":100}] },
  { ticker: "TZXS8", nombre: "Boncer cupón cero sep-28", simboloPrecio: "TZXS8", vencimiento: "2028-09-29", cerEmision: 723.059982, flujos: [{"fecha":"2028-09-30","monto":100}] },
  { ticker: "TZXY7", nombre: "Boncer cupón cero may-27", simboloPrecio: "TZXY7", vencimiento: "2027-05-31", cerEmision: 659.678898, flujos: [{"fecha":"2027-05-31","monto":100}] },
  { ticker: "X30N6", nombre: "Lecer nov-26", simboloPrecio: "X30N6", vencimiento: "2026-11-30", cerEmision: 659.6789, flujos: [{"fecha":"2026-11-30","monto":100}] },
  { ticker: "X30S6", nombre: "Lecer sep-26", simboloPrecio: "X30S6", vencimiento: "2026-09-30", cerEmision: 714.9849, flujos: [{"fecha":"2026-09-30","monto":100.000004}] },
];

export const DOLAR_LINKED: BonoDolarLinked[] = [
  { ticker: "D10Y7", nombre: "Letra dólar linked may-27", simboloPrecio: "D10Y7", vencimiento: "2027-05-10", flujos: [{"fecha":"2027-05-10","monto":100}] },
  { ticker: "D30S6", nombre: "Letra dólar linked sep-26", simboloPrecio: "D30S6", vencimiento: "2026-09-30", flujos: [{"fecha":"2026-09-30","monto":100}] },
  { ticker: "D31G6", nombre: "Letra dólar linked ago-26", simboloPrecio: "D31G6", vencimiento: "2026-08-31", flujos: [{"fecha":"2026-08-31","monto":100}] },
  { ticker: "D31M7", nombre: "Letra dólar linked mar-27", simboloPrecio: "D31M7", vencimiento: "2027-03-31", flujos: [{"fecha":"2027-03-31","monto":100}] },
  { ticker: "TZV27", nombre: "Bono dólar linked jun-27", simboloPrecio: "TZV27", vencimiento: "2027-06-30", flujos: [{"fecha":"2027-06-30","monto":100}] },
  { ticker: "TZV28", nombre: "Bono dólar linked jun-28", simboloPrecio: "TZV28", vencimiento: "2028-06-30", flujos: [{"fecha":"2028-06-30","monto":100}] },
  { ticker: "TZVD8", nombre: "Bono dólar linked dic-28", simboloPrecio: "TZVD8", vencimiento: "2028-12-15", flujos: [{"fecha":"2028-12-15","monto":100}] },
];
