/**
 * Efemérides y feriados argentinos.
 *
 * Esta lista combina:
 *   • Feriados nacionales fijos (Año Nuevo, 25 de mayo, 9 de julio, etc.)
 *   • Feriados móviles (Carnaval, Viernes Santo, San Martín, Diversidad, Soberanía)
 *     — hardcodeados por año porque su fecha varía según calendario o decreto.
 *   • Efemérides importantes no-feriado (Día del Maestro, Día del Estudiante, etc.)
 *
 * Cada entrada tiene una `description` larga que explica qué se conmemora
 * y por qué — pensado para aprender historia argentina mientras se planea
 * el finde largo.
 */

export type EfemerideType = "feriado" | "no-laborable" | "efemeride";

export interface Efemeride {
  date: string;            // YYYY-MM-DD
  title: string;           // "Día de la Revolución de Mayo"
  short: string;           // "Revolución de Mayo" (para el chip)
  type: EfemerideType;
  description: string;     // 2-5 oraciones explicando el contexto histórico
}

// Helper: construye una entrada con la misma estructura para varios años.
const fixed = (mm: string, dd: string, e: Omit<Efemeride, "date">): ((year: number) => Efemeride) =>
  (year) => ({ date: `${year}-${mm}-${dd}`, ...e });

const FIXED: ((year: number) => Efemeride)[] = [
  fixed("01", "01", {
    title: "Año Nuevo",
    short: "Año Nuevo",
    type: "feriado",
    description: "Primer día del año en el calendario gregoriano. En Argentina es feriado nacional inamovible. Se festeja en familia con cena la noche del 31 y brindis a las 00:00 del 1 de enero.",
  }),
  fixed("03", "24", {
    title: "Día Nacional de la Memoria por la Verdad y la Justicia",
    short: "Memoria, Verdad y Justicia",
    type: "feriado",
    description: "Conmemora el inicio del último golpe de Estado cívico-militar (24 de marzo de 1976), que derrocó al gobierno constitucional de María Estela Martínez de Perón e instaló una dictadura que duró hasta 1983. Durante ese período hubo violaciones sistemáticas a los derechos humanos, con unos 30.000 desaparecidos. Es feriado nacional inamovible desde 2006 y se realizan marchas en Plaza de Mayo.",
  }),
  fixed("04", "02", {
    title: "Día del Veterano y de los Caídos en la Guerra de Malvinas",
    short: "Malvinas",
    type: "feriado",
    description: "Recuerda el inicio del conflicto bélico del Atlántico Sur (1982) cuando tropas argentinas desembarcaron en las Islas Malvinas para recuperar el archipiélago ocupado por el Reino Unido desde 1833. La guerra duró 74 días, terminó con la rendición argentina y dejó 649 soldados argentinos caídos. Es feriado nacional inamovible y se rinde homenaje a los excombatientes.",
  }),
  fixed("05", "01", {
    title: "Día del Trabajador",
    short: "Día del Trabajador",
    type: "feriado",
    description: "Recuerda a los Mártires de Chicago (1886), obreros ejecutados tras una huelga por la jornada de 8 horas. Se conmemora en casi todos los países el 1° de mayo (excepto en Estados Unidos, donde se festeja en septiembre). En Argentina es feriado nacional inamovible.",
  }),
  fixed("05", "25", {
    title: "Día de la Revolución de Mayo",
    short: "Revolución de Mayo",
    type: "feriado",
    description: "Conmemora la Revolución de Mayo de 1810: durante la Semana de Mayo (18 al 25), el pueblo de Buenos Aires destituyó al virrey Baltasar Hidalgo de Cisneros y formó la Primera Junta de gobierno patrio (Cornelio Saavedra como presidente, Mariano Moreno y Juan José Paso como secretarios). Es considerado el primer paso hacia la independencia argentina, que se declararía formalmente recién el 9 de julio de 1816. Es feriado nacional inamovible.",
  }),
  fixed("06", "20", {
    title: "Paso a la Inmortalidad del General Manuel Belgrano",
    short: "Día de la Bandera",
    type: "feriado",
    description: "Día de la Bandera. Recuerda la muerte de Manuel Belgrano (1820), abogado, economista, militar y prócer creador de la bandera nacional argentina, que enarboló por primera vez el 27 de febrero de 1812 a orillas del Río Paraná, en Rosario. Belgrano vendió sus propiedades para financiar el Ejército del Norte y murió en la pobreza. Es feriado nacional inamovible.",
  }),
  fixed("07", "09", {
    title: "Día de la Independencia",
    short: "Independencia",
    type: "feriado",
    description: "Conmemora la declaración de la Independencia de las Provincias Unidas del Río de la Plata, firmada el 9 de julio de 1816 en el Congreso de Tucumán por 29 diputados. Argentina se separó formalmente del Reino de España y de toda otra dominación extranjera. Es feriado nacional inamovible y la fecha patria más importante junto con el 25 de Mayo.",
  }),
  fixed("12", "08", {
    title: "Día de la Inmaculada Concepción de María",
    short: "Inmaculada Concepción",
    type: "feriado",
    description: "Festividad católica que celebra el dogma de la concepción sin pecado original de la Virgen María, proclamado por el Papa Pío IX en 1854. En Argentina es feriado nacional inamovible y tradicionalmente marca el inicio de la temporada navideña (se arma el árbol y el pesebre).",
  }),
  fixed("12", "25", {
    title: "Navidad",
    short: "Navidad",
    type: "feriado",
    description: "Conmemora el nacimiento de Jesús de Nazaret según la tradición cristiana. En Argentina es feriado nacional inamovible. La cena del 24 a la noche (Nochebuena) es la celebración principal: familia, mesa con pan dulce, turrones, sidra y brindis a las 00:00.",
  }),

  // ─── Efemérides importantes no-feriado ────────────────────────────────
  fixed("04", "23", {
    title: "Día del Idioma Español",
    short: "Día del Idioma",
    type: "efemeride",
    description: "Recuerda el fallecimiento de Miguel de Cervantes Saavedra (1616), autor de Don Quijote de la Mancha, la obra más influyente de la literatura en lengua española. La fecha coincide con la muerte de William Shakespeare. La UNESCO la declaró Día Mundial del Libro y del Derecho de Autor.",
  }),
  fixed("09", "11", {
    title: "Día del Maestro",
    short: "Día del Maestro",
    type: "efemeride",
    description: "Recuerda la muerte de Domingo Faustino Sarmiento (1888), prócer educador, periodista, militar y séptimo presidente argentino (1868-1874). Sarmiento impulsó la educación pública, gratuita y obligatoria, fundó cientos de escuelas y trajo maestras estadounidenses. Es uno de los grandes formadores del sistema educativo argentino.",
  }),
  fixed("09", "21", {
    title: "Día del Estudiante / Primavera",
    short: "Día del Estudiante",
    type: "efemeride",
    description: "El Día del Estudiante coincide en Argentina con el inicio de la primavera austral (equinoccio). Se eligió esta fecha en homenaje al fallecimiento de Domingo Faustino Sarmiento (que cae el 11 de septiembre pero se conmemora junto al inicio de la primavera). Tradicionalmente las escuelas y universidades hacen actividades al aire libre.",
  }),
];

// Feriados móviles y casos por año (que requieren fechas hardcodeadas).
// Carnaval = lunes y martes anteriores al miércoles de ceniza (depende de Pascua).
// Viernes Santo = viernes anterior a Pascua.
// San Martín = 3er lunes de agosto.
// Diversidad Cultural = lunes más cercano al 12 de octubre.
// Soberanía Nacional = lunes más cercano al 20 de noviembre.

const PER_YEAR: Record<number, Efemeride[]> = {
  2026: [
    {
      date: "2026-02-16", title: "Carnaval", short: "Carnaval",
      type: "feriado",
      description: "Festividad de raíces cristianas que precede a la Cuaresma. Originalmente era el último período de excesos antes de los 40 días de ayuno y abstinencia. En Argentina, los carnavales más famosos son los de Gualeguaychú (Entre Ríos) y los del NOA (con la tradicional Diablada de Humahuaca). El lunes y martes de carnaval son feriados nacionales (en 2026: 16 y 17 de febrero).",
    },
    {
      date: "2026-02-17", title: "Carnaval", short: "Carnaval",
      type: "feriado",
      description: "Segundo día del carnaval. En Argentina, los carnavales más famosos son los de Gualeguaychú y los del NOA. El lunes y martes de carnaval son feriados nacionales.",
    },
    {
      date: "2026-04-03", title: "Viernes Santo", short: "Viernes Santo",
      type: "feriado",
      description: "Conmemora la crucifixión y muerte de Jesucristo según la tradición cristiana. Es el día más solemne del Triduo Pascual. En Argentina es feriado nacional. Junto con Jueves Santo (no laborable, 2 de abril) y Domingo de Pascua (5 de abril) forman la Semana Santa, que suele coincidir con el primer finde largo del año.",
    },
    {
      date: "2026-08-17", title: "Paso a la Inmortalidad del Gral. José de San Martín", short: "San Martín",
      type: "feriado",
      description: "Conmemora el fallecimiento de José Francisco de San Martín (1850), Libertador de Argentina, Chile y Perú, considerado el Padre de la Patria. Cruzó los Andes con el Ejército Libertador en 1817 y lideró la campaña que liberó al cono sur del dominio español. Murió en el exilio en Boulogne-sur-Mer (Francia). El feriado se celebra el tercer lunes de agosto.",
    },
    {
      date: "2026-10-12", title: "Día del Respeto a la Diversidad Cultural", short: "Diversidad Cultural",
      type: "feriado",
      description: "Anteriormente conocido como Día de la Raza, en 2010 se renombró para promover una reflexión histórica y un diálogo intercultural sobre los derechos de los pueblos originarios. Conmemora el 12 de octubre de 1492, fecha del primer contacto entre europeos y poblaciones americanas con la llegada de Cristóbal Colón. En Argentina se traslada al lunes más cercano para fomentar el finde largo.",
    },
    {
      date: "2026-11-23", title: "Día de la Soberanía Nacional", short: "Soberanía",
      type: "feriado",
      description: "Recuerda la Batalla de Vuelta de Obligado (20 de noviembre de 1845), cuando tropas argentinas comandadas por Lucio Mansilla resistieron heroicamente la invasión de una flota anglo-francesa sobre el río Paraná. Aunque militarmente fue una derrota, marcó un hito simbólico de la defensa de la soberanía nacional. Es feriado nacional desde 1974, y desde 2010 se traslada al lunes más cercano.",
    },
  ],
  2027: [
    { date: "2027-02-08", title: "Carnaval", short: "Carnaval", type: "feriado", description: "Lunes de carnaval. Lunes y martes anteriores al miércoles de ceniza." },
    { date: "2027-02-09", title: "Carnaval", short: "Carnaval", type: "feriado", description: "Martes de carnaval." },
    { date: "2027-03-26", title: "Viernes Santo", short: "Viernes Santo", type: "feriado", description: "Crucifixión y muerte de Jesucristo. Parte del Triduo Pascual." },
    { date: "2027-08-16", title: "Paso a la Inmortalidad del Gral. José de San Martín", short: "San Martín", type: "feriado", description: "Fallecimiento del Libertador José de San Martín (1850). Trasladado al 3er lunes de agosto." },
    { date: "2027-10-11", title: "Día del Respeto a la Diversidad Cultural", short: "Diversidad Cultural", type: "feriado", description: "Conmemora el 12 de octubre de 1492 con un enfoque de diálogo intercultural sobre los pueblos originarios." },
    { date: "2027-11-22", title: "Día de la Soberanía Nacional", short: "Soberanía", type: "feriado", description: "Batalla de Vuelta de Obligado (1845). Trasladado al lunes más cercano." },
  ],
};

/** Returns all efemérides for a given year, sorted by date. */
export function getEfemerides(year: number): Efemeride[] {
  const list: Efemeride[] = [
    ...FIXED.map(fn => fn(year)),
    ...(PER_YEAR[year] ?? []),
  ];
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

/** Returns the upcoming efemérides from `today` forward, up to `count`.
 *  Includes today if today is one. Wraps to the next year when needed. */
export function getUpcoming(today: string, count: number = 5): Efemeride[] {
  const year = Number(today.slice(0, 4));
  const thisYear = getEfemerides(year).filter(e => e.date >= today);
  if (thisYear.length >= count) return thisYear.slice(0, count);
  const nextYear = getEfemerides(year + 1);
  return [...thisYear, ...nextYear].slice(0, count);
}

/** Days between two YYYY-MM-DD dates (positive for future). */
export function daysUntil(today: string, target: string): number {
  const t = new Date(today + "T12:00:00").getTime();
  const x = new Date(target + "T12:00:00").getTime();
  return Math.round((x - t) / 86_400_000);
}

/** "lunes 25 de mayo" style formatting. */
export function fmtEfemerideDate(date: string): string {
  const d = new Date(date + "T12:00:00");
  const days = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${days[d.getDay()]} ${d.getDate()} de ${months[d.getMonth()]}`;
}

/**
 * Si el feriado arma un fin de semana largo de tres días o más.
 *
 * Lunes y viernes lo arman solos, pegados al sábado y domingo. Martes y jueves
 * **no**: hace falta que el lunes o el viernes de al lado también sea feriado o
 * no laborable, que en Argentina es una decisión aparte del Ejecutivo. Antes
 * esta rama devolvía `true` sin verificarlo —el comentario describía el chequeo
 * pero el código no lo hacía—, y acertaba de casualidad porque los únicos
 * martes cargados son los de Carnaval, que sí tienen el lunes feriado.
 */
export function isLongWeekend(efemeride: Efemeride, all: Efemeride[]): boolean {
  if (efemeride.type !== "feriado") return false;

  const d = new Date(efemeride.date + "T12:00:00");
  const dow = d.getDay(); // 0 domingo, 6 sábado

  if (dow === 1 || dow === 5) return true;

  /** Si el día a `offset` días también corta la actividad. */
  const noSeTrabaja = (offset: number) => {
    const otro = new Date(d.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
    return all.some(
      (e) => e.date === otro && (e.type === "feriado" || e.type === "no-laborable")
    );
  };

  // Martes necesita el lunes; jueves necesita el viernes
  if (dow === 2) return noSeTrabaja(-1);
  if (dow === 4) return noSeTrabaja(1);

  // Miércoles sólo si es parte de una tanda de feriados consecutivos
  if (dow === 3) return noSeTrabaja(-1) || noSeTrabaja(1);

  // Sábado o domingo: ya cae dentro del fin de semana
  return false;
}
