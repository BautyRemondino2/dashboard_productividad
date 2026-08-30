/**
 * Cronogramas de las letras y bonos del Tesoro a tasa fija en pesos.
 *
 * Generado por `node scripts/generar-flujos-tasa-fija.mjs` el 2026-08-30.
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
  { ticker: "S31G6", nombre: "Lecap ago-26", simboloPrecio: "S31G6", vencimiento: "2026-08-31", flujos: [{"fecha":"2026-08-31","monto":127.064}] },
  { ticker: "S15S6", nombre: "Lecap sep-26", simboloPrecio: "S15S6", vencimiento: "2026-09-15", flujos: [{"fecha":"2026-09-15","monto":107.210377}] },
  { ticker: "S30S6", nombre: "Lecap sep-26", simboloPrecio: "S30S6", vencimiento: "2026-09-30", flujos: [{"fecha":"2026-09-30","monto":117.535626}] },
  { ticker: "S30O6", nombre: "Lecap oct-26", simboloPrecio: "S30O6", vencimiento: "2026-10-30", flujos: [{"fecha":"2026-10-30","monto":135.2782}] },
  { ticker: "S13N6", nombre: "Lecap nov-26", simboloPrecio: "S13N6", vencimiento: "2026-11-13", flujos: [{"fecha":"2026-11-13","monto":109.651385}] },
  { ticker: "S30N6", nombre: "Lecap nov-26", simboloPrecio: "S30N6", vencimiento: "2026-11-30", flujos: [{"fecha":"2026-11-30","monto":129.889}] },
  { ticker: "T15E7", nombre: "Boncap ene-27", simboloPrecio: "T15E7", vencimiento: "2027-01-15", flujos: [{"fecha":"2027-01-15","monto":161.103773}] },
  { ticker: "T30A7", nombre: "Boncap abr-27", simboloPrecio: "T30A7", vencimiento: "2027-04-30", flujos: [{"fecha":"2027-04-30","monto":157.3402}] },
  { ticker: "T31Y7", nombre: "Boncap may-27", simboloPrecio: "T31Y7", vencimiento: "2027-05-31", flujos: [{"fecha":"2027-05-31","monto":152.1845}] },
  { ticker: "T30J7", nombre: "Boncap jun-27", simboloPrecio: "T30J7", vencimiento: "2027-06-30", flujos: [{"fecha":"2027-06-30","monto":156.037291}] },
];
