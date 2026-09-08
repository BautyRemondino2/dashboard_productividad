/**
 * Cuándo está cerrado el mercado, y por qué.
 *
 * El dashboard mostraba precios sin decir nunca que la rueda no había abierto.
 * El lunes 7 de septiembre de 2026 —Labor Day— todo el panel de EE.UU. seguía
 * mostrando los números del viernes, sin una línea que lo explicara: un papel
 * "sin variación" y un papel que no cotizó se ven exactamente igual, y el
 * segundo no es un dato, es la ausencia de uno.
 *
 * ## Se calcula, no se lista
 *
 * Los feriados del NYSE siguen reglas fijas —"tercer lunes de enero", "cuarto
 * jueves de noviembre"— así que se computan para cualquier año en vez de
 * escribirse a mano. Una lista hardcodeada funciona hasta el 1 de enero en que
 * nadie se acordó de extenderla, y ese es justo el día en que hace falta.
 *
 * Dos reglas que hay que tener en cuenta y son fáciles de pasar por alto:
 *
 *  - **Los feriados de fecha fija se corren.** Si el 4 de julio cae sábado, el
 *    mercado cierra el viernes 3; si cae domingo, el lunes 5. La regla es del
 *    calendario federal y el NYSE la sigue.
 *  - **Viernes Santo no es feriado federal pero el NYSE cierra igual.** Es una
 *    particularidad del mercado, herencia de cuando la bolsa cerraba por
 *    razones religiosas, y se mantiene. Los bancos y el gobierno trabajan.
 *
 * ## Medios días
 *
 * Tres veces al año la rueda cierra a las 13:00 de Nueva York: la víspera de
 * Independence Day, el día después de Thanksgiving y la Nochebuena. No es un
 * detalle de color — el volumen se desploma y los movimientos de esas tardes
 * exageran cualquier lectura.
 *
 * El mercado argentino se toma de `efemerides.ts`, que ya tiene los feriados
 * nacionales con su descripción. **Es una aproximación**: BYMA suele seguir el
 * calendario nacional pero puede cerrar por decisión propia (un feriado
 * cambiario, un paro bancario) y eso no está en ninguna lista pública estable.
 */

import { getEfemerides } from "@/lib/efemerides";

export type Mercado = "eeuu" | "argentina";

export const MERCADO_LABEL: Record<Mercado, string> = {
  eeuu: "el mercado de EE.UU.",
  argentina: "el mercado argentino",
};

export interface FeriadoMercado {
  /** YYYY-MM-DD. */
  fecha: string;
  mercado: Mercado;
  nombre: string;
  /** Qué se conmemora. Es la mitad de la respuesta. */
  porQue: string;
  /** Qué implica para quien mira precios. Es la otra mitad. */
  consecuencia: string;
  /** Cierre anticipado (13:00 de Nueva York) en vez de cierre completo. */
  medioDia?: boolean;
}

// ─── Fechas ──────────────────────────────────────────────────────────────────

const iso = (a: number, m: number, d: number) =>
  `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Día de la semana de una fecha, en UTC para no depender de la zona del server. */
const diaSemana = (f: string) => new Date(`${f}T12:00:00Z`).getUTCDay();

const sumarDias = (f: string, n: number) =>
  new Date(Date.parse(`${f}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** El n-ésimo `dia` (0 = domingo) del mes. */
function nEsimo(año: number, mes: number, dia: number, n: number): string {
  const primero = new Date(Date.UTC(año, mes - 1, 1)).getUTCDay();
  const desplazamiento = (dia - primero + 7) % 7;
  return iso(año, mes, 1 + desplazamiento + (n - 1) * 7);
}

/** El último `dia` del mes. */
function ultimo(año: number, mes: number, dia: number): string {
  const diasDelMes = new Date(Date.UTC(año, mes, 0)).getUTCDate();
  const ultimoDia = new Date(Date.UTC(año, mes - 1, diasDelMes)).getUTCDay();
  return iso(año, mes, diasDelMes - ((ultimoDia - dia + 7) % 7));
}

/**
 * Cuando un feriado de fecha fija cae fin de semana, el mercado cierra el
 * hábil más cercano: sábado → viernes anterior, domingo → lunes siguiente.
 */
function observado(fecha: string): string {
  const d = diaSemana(fecha);
  if (d === 6) return sumarDias(fecha, -1);
  if (d === 0) return sumarDias(fecha, 1);
  return fecha;
}

/**
 * Domingo de Pascua por el algoritmo de Meeus/Jones/Butcher (gregoriano).
 * Viernes Santo son dos días antes.
 */
function pascua(año: number): string {
  const a = año % 19;
  const b = Math.floor(año / 100);
  const c = año % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(año, mes, dia);
}

// ─── El calendario de EE.UU. ─────────────────────────────────────────────────

/** Los feriados del NYSE y el Nasdaq de un año, con su porqué. */
export function feriadosEeuu(año: number): FeriadoMercado[] {
  const cerrado = "La rueda no abre: no hay precios nuevos, y lo que se ve en pantalla es el cierre del día hábil anterior.";
  const viernesSanto = sumarDias(pascua(año), -2);
  const thanksgiving = nEsimo(año, 11, 4, 4);

  const lista: Omit<FeriadoMercado, "mercado">[] = [
    {
      fecha: observado(iso(año, 1, 1)),
      nombre: "Año Nuevo",
      porQue: "Primer día del calendario gregoriano.",
      consecuencia: cerrado,
    },
    {
      fecha: nEsimo(año, 1, 1, 3),
      nombre: "Martin Luther King Jr. Day",
      porQue:
        "Conmemora al líder del movimiento por los derechos civiles, asesinado en 1968. Es feriado federal desde 1986 y el mercado cierra desde 1998.",
      consecuencia: cerrado,
    },
    {
      fecha: nEsimo(año, 2, 1, 3),
      nombre: "Presidents' Day",
      porQue:
        "Oficialmente Washington's Birthday: honra al primer presidente. Desde 1971 se corrió al tercer lunes de febrero para armar un fin de semana largo.",
      consecuencia: cerrado,
    },
    {
      fecha: viernesSanto,
      nombre: "Viernes Santo",
      porQue:
        "No es feriado federal —los bancos y el gobierno trabajan— pero el NYSE cierra igual, por costumbre heredada de cuando la bolsa paraba por razones religiosas.",
      consecuencia: `${cerrado} Ojo: los bonos del Tesoro operan media rueda, así que puede haber tasa nueva sin acciones.`,
    },
    {
      fecha: ultimo(año, 5, 1),
      nombre: "Memorial Day",
      porQue:
        "Honra a los caídos en combate. Nació después de la Guerra Civil y marca el arranque informal del verano estadounidense.",
      consecuencia: cerrado,
    },
    {
      fecha: observado(iso(año, 6, 19)),
      nombre: "Juneteenth",
      porQue:
        "Recuerda el 19 de junio de 1865, cuando la noticia de la emancipación llegó por fin a los esclavizados de Texas. Es feriado federal desde 2021 y el más nuevo del calendario.",
      consecuencia: cerrado,
    },
    {
      fecha: observado(iso(año, 7, 4)),
      nombre: "Independence Day",
      porQue: "Declaración de Independencia de 1776.",
      consecuencia: cerrado,
    },
    {
      fecha: nEsimo(año, 9, 1, 1),
      nombre: "Labor Day",
      porQue:
        "El día del trabajador estadounidense. Va en septiembre y no el 1 de mayo justamente para despegarlo del 1° de mayo obrero internacional, que en 1894 sonaba a conflicto.",
      consecuencia: cerrado,
    },
    {
      fecha: thanksgiving,
      nombre: "Thanksgiving",
      porQue:
        "Acción de Gracias, el feriado más viajado del año en EE.UU. Cuarto jueves de noviembre por decreto de Roosevelt en 1941.",
      consecuencia: cerrado,
    },
    {
      fecha: observado(iso(año, 12, 25)),
      nombre: "Navidad",
      porQue: "25 de diciembre.",
      consecuencia: cerrado,
    },
  ];

  // ── Medios días ───────────────────────────────────────────────────────────
  const medio =
    "La rueda cierra a las 13:00 de Nueva York. El volumen se desploma, así que los movimientos de esa tarde exageran cualquier lectura.";

  /**
   * La media rueda de la víspera existe sólo cuando el feriado cae en su fecha
   * natural. Si el 4 de julio cae sábado, el mercado ya cierra el viernes 3
   * entero y no hay víspera que anunciar: el jueves 2 es una rueda normal.
   */
  const vispera = (fechaNatural: string, nombre: string, porQue: string) => {
    if (observado(fechaNatural) !== fechaNatural) return [];
    const previo = sumarDias(fechaNatural, -1);
    if (diaSemana(previo) < 1 || diaSemana(previo) > 5) return [];
    return [{ fecha: previo, nombre, porQue, consecuencia: medio, medioDia: true }];
  };

  const medios: Omit<FeriadoMercado, "mercado">[] = [
    ...vispera(
      iso(año, 7, 4),
      "Víspera de Independence Day",
      "El día antes del 4 de julio: media rueda por el fin de semana largo."
    ),
    {
      fecha: sumarDias(thanksgiving, 1),
      nombre: "Viernes negro",
      porQue:
        "El día después de Thanksgiving. Arranca la temporada de compras y media Wall Street está de vacaciones.",
      consecuencia: medio,
      medioDia: true,
    },
    ...vispera(iso(año, 12, 25), "Nochebuena", "El día antes de Navidad."),
  ];

  return [...lista, ...medios]
    .map((f) => ({ ...f, mercado: "eeuu" as const }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// ─── El calendario argentino ─────────────────────────────────────────────────

/**
 * Los feriados nacionales, tomados de la lista de efemérides que ya existe.
 *
 * Se incluyen los "no laborables" (donde los bancos y la bolsa cierran aunque
 * el comercio abra) y se excluyen las efemérides que no paran nada — el Día del
 * Maestro no cierra el mercado.
 */
export function feriadosArgentina(año: number): FeriadoMercado[] {
  return getEfemerides(año)
    .filter((e) => e.type === "feriado" || e.type === "no-laborable")
    .map((e) => ({
      fecha: e.date,
      mercado: "argentina" as const,
      nombre: e.title,
      porQue: e.description,
      consecuencia:
        "BYMA no opera: los precios de acciones y bonos argentinos son los del día hábil anterior. El dólar tampoco tiene cotización nueva.",
    }));
}

// ─── Consultas ───────────────────────────────────────────────────────────────

/** Todo el calendario de un año, los dos mercados juntos. */
export function feriadosDe(año: number): FeriadoMercado[] {
  return [...feriadosEeuu(año), ...feriadosArgentina(año)].sort((a, b) =>
    a.fecha.localeCompare(b.fecha)
  );
}

/** Qué mercados están cerrados (o cierran temprano) en esa fecha. */
export function feriadosEnFecha(fecha: string): FeriadoMercado[] {
  return feriadosDe(Number(fecha.slice(0, 4))).filter((f) => f.fecha === fecha);
}

/**
 * Los próximos feriados a partir de una fecha, mirando también el año que viene
 * para que en diciembre no se vea el calendario vacío.
 */
export function proximosFeriados(desde: string, cantidad = 6): FeriadoMercado[] {
  const año = Number(desde.slice(0, 4));
  return [...feriadosDe(año), ...feriadosDe(año + 1)]
    .filter((f) => f.fecha > desde)
    .slice(0, cantidad);
}

/**
 * El fin de semana también cierra la rueda, y por lejos es la causa más común
 * de que un precio no se mueva. No es un feriado —no tiene porqué que contar—
 * pero para el que mira la pantalla el efecto es idéntico.
 */
export function esFinDeSemana(fecha: string): boolean {
  const d = diaSemana(fecha);
  return d === 0 || d === 6;
}
