/**
 * Datos económicos por provincia, de fuentes oficiales argentinas.
 *
 * Lo que se puede y lo que no:
 *
 *   ✅ Exportaciones — INDEC vía la API de series de datos.gob.ar, anual.
 *   ✅ Asalariados registrados del sector privado — SSPM, mensual.
 *   ❌ Producto Bruto Geográfico — Argentina no lo publica de forma regular ni
 *      comparable entre provincias; no está en ninguna API del Estado.
 *   ❌ Empleo público provincial — sólo hay serie nacional, sin desagregar.
 *
 * Los dos huecos se dicen en la UI en vez de rellenarse con estimaciones.
 *
 * **Acá no se pide nada por red.** Armar estos datos son 27 requests
 * secuenciales —el CSV del SSPM, dos catálogos y veintitrés lotes de series— y
 * el caché vivía en memoria, así que cada arranque en frío los pagaba de nuevo:
 * desde una función en Vercel, con la latencia hasta Argentina, eran entre seis
 * y once segundos con el mapa en blanco. Como el empleo se publica una vez por
 * mes y las exportaciones una vez por año, se bajan con
 * `node scripts/generar-datos-provincias.mjs` y quedan en el repo.
 */
import { PROVINCIAS } from "@/lib/provincias";
import {
  EMPLEO,
  EXPORTACIONES,
  VIGENCIA,
  type EmpleoProvincial,
  type ExportacionesProvincia,
} from "@/lib/provincias-datos";

export type { EmpleoProvincial, ExportacionesProvincia };
export { VIGENCIA };

/** Los cuatro grandes rubros con que el INDEC clasifica las exportaciones. */
export const RUBROS = ["pp", "moa", "moi", "cye"] as const;
export type Rubro = (typeof RUBROS)[number];

export const RUBRO_LABEL: Record<Rubro, string> = {
  pp: "Productos primarios",
  moa: "Manufacturas agropecuarias",
  moi: "Manufacturas industriales",
  cye: "Combustibles y energía",
};

export interface DatosProvincia {
  empleo: EmpleoProvincial | null;
  exportaciones: ExportacionesProvincia | null;
}

/** Los datos económicos de las 24, con lo que haya para cada una. */
export function getDatosProvinciales(): Record<string, DatosProvincia> {
  const salida: Record<string, DatosProvincia> = {};
  for (const p of PROVINCIAS) {
    salida[p.iso] = {
      empleo: EMPLEO[p.iso] ?? null,
      exportaciones: EXPORTACIONES[p.iso] ?? null,
    };
  }
  return salida;
}
