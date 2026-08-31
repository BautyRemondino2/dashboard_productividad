"use server";

import { revalidatePath } from "next/cache";
import { alternarCheck, borrarFicha, guardarCampo, guardarTabla } from "@/lib/equity-ficha-db";

/**
 * Las escrituras de la ficha **no** revalidan la ruta a propósito.
 *
 * La página trae precio, serie financiera y comparables de Yahoo: revalidar en
 * cada blur volvería a renderizar todo eso —y a parpadear— por haber escrito
 * una línea. El estado que se ve mientras se edita vive en el cliente; la DB es
 * el destino, no la fuente de la pantalla. Sólo el borrado revalida, porque ahí
 * sí cambia lo que el servidor tiene que mostrar.
 */

export interface Guardado {
  ok: boolean;
  /** ISO del guardado, para el sello de "guardado hace un momento". */
  cuando?: string;
  error?: string;
}

function intentar(fn: () => string): Guardado {
  try {
    return { ok: true, cuando: fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function guardarCampoFicha(
  ticker: string,
  clave: string,
  valor: string
): Promise<Guardado> {
  return intentar(() => guardarCampo(ticker, clave, valor));
}

export async function guardarTablaFicha(
  ticker: string,
  clave: string,
  filas: string[][]
): Promise<Guardado> {
  return intentar(() => guardarTabla(ticker, clave, filas));
}

export async function alternarCheckFicha(
  ticker: string,
  clave: string,
  valor: boolean
): Promise<Guardado> {
  return intentar(() => alternarCheck(ticker, clave, valor));
}

export async function reiniciarFicha(ticker: string): Promise<Guardado> {
  const r = intentar(() => {
    borrarFicha(ticker);
    return new Date().toISOString();
  });
  revalidatePath(`/equity/${ticker}/ficha`);
  return r;
}
