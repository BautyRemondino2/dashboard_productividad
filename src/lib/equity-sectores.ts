/**
 * Sectores del universo de equity, en taxonomía GICS.
 * Generado por `node scripts/generar-universo.mjs` el 2026-08-26.
 *
 * Separado de `equity-universo` a propósito: esto lo importan Client
 * Components, y la lista de empresas no tiene por qué viajar al navegador.
 */

export const SECTORES = [
  "Communication Services",
  "Consumer Discretionary",
  "Consumer Staples",
  "Energy",
  "Financials",
  "Health Care",
  "Industrials",
  "Information Technology",
  "Materials",
  "Real Estate",
  "Utilities",
  "Otros",
] as const;
export type Sector = (typeof SECTORES)[number];

/** Etiquetas en castellano para la UI. */
export const SECTOR_LABEL: Record<Sector, string> = {
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
