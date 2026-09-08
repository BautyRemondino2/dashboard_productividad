/**
 * La inflación mensual argentina en una sola serie continua: lo que ya pasó y
 * lo que el mercado espera.
 *
 * Son dos fuentes distintas y no se pueden mezclar sin decirlo:
 *
 *  - **INDEC** publica el IPC del mes cerrado, con unas dos semanas de rezago.
 *    Es un dato medido. Llega vía argentinadatos a `market_series` (ticker `IPC`).
 *  - **El REM del BCRA** es la mediana de lo que pronostican consultoras y
 *    bancos para los meses que vienen. Es una expectativa, no una medición, y
 *    tampoco es una proyección del Banco Central (ver `rem.ts`).
 *
 * Entre las dos siempre queda un hueco: el mes que acaba de cerrar todavía no
 * tiene dato de INDEC. Ese mes sale del REM y se marca como esperado igual que
 * los futuros — el relevamiento se hace los últimos tres días hábiles, así que
 * es un pronóstico sobre un mes casi terminado, pero pronóstico al fin.
 *
 * La regla que ordena todo: **donde hay dato de INDEC, manda INDEC.** El REM
 * sólo completa lo que todavía no se midió, nunca pisa una medición.
 */
import { getDb } from "@/lib/db";
import type { Rem } from "@/lib/rem";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Cuántos meses medidos entran por defecto: un año, para leer la tendencia. */
export const MESES_MEDIDOS = 12;

export interface MesInflacion {
  /** "2026-07". */
  mes: string;
  /** "jul 26". */
  etiqueta: string;
  /** Variación mensual en %. */
  valor: number;
  /** `indec` es un dato medido; `rem`, la mediana de los pronósticos. */
  origen: "indec" | "rem";
}

export interface SerieInflacion {
  meses: MesInflacion[];
  /** Último mes con dato de INDEC, que es hasta dónde llega lo medido. */
  ultimoMedido: MesInflacion | null;
  /** Primer mes que todavía no tiene dato y sale del REM. */
  primerEsperado: MesInflacion | null;
}

/** "2026-07" → "jul 26". */
function etiquetar(mes: string): string {
  const [a, m] = mes.split("-");
  return `${MESES[Number(m) - 1]} ${a.slice(2)}`;
}

/**
 * El IPC mensual publicado por INDEC, del más viejo al más nuevo.
 *
 * La serie guarda la fecha como último día del mes (`2026-07-31`), así que el
 * mes se recorta de los primeros siete caracteres.
 */
export function ipcMedido(limite = MESES_MEDIDOS): MesInflacion[] {
  const filas = getDb()
    .prepare(
      `SELECT fecha, valor FROM market_series
        WHERE instrumento = 'IPC' AND metrica = 'valor'
        ORDER BY fecha DESC LIMIT ?`
    )
    .all(limite) as { fecha: string; valor: number }[];

  return filas
    .map(({ fecha, valor }) => ({
      mes: fecha.slice(0, 7),
      etiqueta: etiquetar(fecha.slice(0, 7)),
      valor,
      origen: "indec" as const,
    }))
    .reverse();
}

/**
 * Lo medido y lo esperado, en una sola línea de tiempo sin huecos ni solapes.
 *
 * El REM aporta únicamente los meses que INDEC todavía no publicó: si el cuadro
 * trae un mes que ya se midió, gana la medición. Así la serie nunca muestra dos
 * números para el mismo mes ni deja un mes en blanco en el medio.
 */
export function serieInflacion(rem: Rem, limite = MESES_MEDIDOS): SerieInflacion {
  const medidos = ipcMedido(limite);
  // Corte por fecha y no por pertenencia al conjunto: `limite` recorta la
  // ventana visible, así que un mes viejo puede estar medido y fuera de la
  // lista. Compararlo contra el último medido evita que el REM lo reinyecte
  // como esperado y aparezca un mes de 2025 dibujado como pronóstico.
  const ultimo = medidos.at(-1)?.mes ?? "";

  const esperados: MesInflacion[] = rem.mensual
    .filter((m) => m.mes > ultimo)
    .map((m) => ({
      mes: m.mes,
      etiqueta: etiquetar(m.mes),
      valor: m.mediana,
      origen: "rem" as const,
    }));

  const meses = [...medidos, ...esperados].sort((a, b) => a.mes.localeCompare(b.mes));

  return {
    meses,
    ultimoMedido: medidos.at(-1) ?? null,
    primerEsperado: esperados[0] ?? null,
  };
}
