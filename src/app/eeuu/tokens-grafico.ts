/**
 * Los tokens de los gráficos de esta sección, en un solo lugar.
 *
 * Son los mismos valores que usa `CurvaNS` en renta fija —no una paleta nueva—
 * para que un gráfico de EE.UU. y uno de la curva argentina se lean como parte
 * del mismo panel. Están duplicados y no importados porque `CurvaNS` los tiene
 * privados; si aparece un tercer consumidor, conviene subirlos a `@/components`.
 */
export const GRIS = "#64748b";
export const TENUE = "#475569";
export const REJILLA = "#16233a";

/** Serie principal: la lectura de hoy. */
export const HOY = "#38bdf8";
/** Comparación cercana (un mes atrás). */
export const MES = "#a78bfa";
/** Comparación lejana (un año atrás). */
export const ANIO = "#64748b";
/** Núcleo / medida subyacente. */
export const NUCLEO = "#fb923c";
/** Meta o nivel de referencia. */
export const META = "#34d399";

export const fmtNum = (v: number, d = 2) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });

/**
 * Una escala con cortes en números redondos, sobre la serie 1-2-2,5-5.
 * Sin esto recharts elige dominios como 3,847% y la columna deja de leerse.
 */
export function escalaLinda(min: number, max: number, cortes = 5) {
  const rango = Math.max(max - min, 1e-6);
  const crudo = rango / cortes;
  const magnitud = Math.pow(10, Math.floor(Math.log10(crudo)));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * magnitud).find((p) => p >= crudo) ?? 10 * magnitud;

  const desde = Math.floor(min / paso) * paso;
  const hasta = Math.ceil(max / paso) * paso;
  const ticks: number[] = [];
  for (let t = desde; t <= hasta + paso * 1e-6; t += paso) ticks.push(+t.toFixed(10));

  const decimales = Number.isInteger(paso) ? 0 : Number.isInteger(paso * 10) ? 1 : 2;
  return { desde, hasta, ticks, decimales };
}

/** "2026-09" → "sep 26". */
export function mesCorto(iso: string): string {
  const [a, m] = iso.split("-").map(Number);
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${meses[m - 1]} ${String(a).slice(2)}`;
}
