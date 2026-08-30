/**
 * Macro de EE.UU. — lo que mueve la tasa que descuenta al resto del mundo.
 *
 * Cuatro lecturas, en el orden en que se miran:
 *
 *  1. **La curva del Tesoro.** El precio del dinero libre de riesgo en dólares.
 *     Es contra esto que se mide un Global argentino: la TIR de un GD35 menos la
 *     del Tesoro al mismo plazo *es* el riesgo país de ese bono.
 *  2. **La inflación.** Es el mandato que decide si la Fed sube o baja.
 *  3. **La actividad y el empleo.** El otro lado del mandato dual.
 *  4. **Las condiciones financieras.** Cuánto apetito de riesgo hay; el canal
 *     por el que todo esto llega efectivamente a un bono emergente.
 *
 * Todo sale de FRED (`@/lib/fred`), sin clave y con caché en memoria. Cada
 * indicador viaja con su nota: qué mide y cómo se lee. Un número sin esa línea
 * obliga a adivinar y en un panel de macro adivinar mal sale caro.
 */

import {
  fredVarias,
  ultimo,
  haceDias,
  variacionInteranual,
  variacionMensual,
  serieInteranual,
  cambioUltimo,
  type PuntoSerie,
} from "@/lib/fred";

// ─── Curva del Tesoro ────────────────────────────────────────────────────────

const TENORES: { id: string; label: string; anios: number }[] = [
  { id: "DGS1MO", label: "1 m",  anios: 1 / 12 },
  { id: "DGS3MO", label: "3 m",  anios: 0.25 },
  { id: "DGS6MO", label: "6 m",  anios: 0.5 },
  { id: "DGS1",   label: "1 a",  anios: 1 },
  { id: "DGS2",   label: "2 a",  anios: 2 },
  { id: "DGS3",   label: "3 a",  anios: 3 },
  { id: "DGS5",   label: "5 a",  anios: 5 },
  { id: "DGS7",   label: "7 a",  anios: 7 },
  { id: "DGS10",  label: "10 a", anios: 10 },
  { id: "DGS20",  label: "20 a", anios: 20 },
  { id: "DGS30",  label: "30 a", anios: 30 },
];

export interface PuntoCurva {
  label: string;
  anios: number;
  hoy: number | null;
  hace1m: number | null;
  hace1a: number | null;
}

export interface CurvaTesoro {
  puntos: PuntoCurva[];
  /** Pendiente 10a − 2a, en pb. Negativa = curva invertida. */
  spread10y2y: number | null;
  /** Pendiente 10a − 3m, en pb: la que mejor anticipa recesiones. */
  spread10y3m: number | null;
  /** Serie del 10 años para el gráfico de contexto. */
  serie10a: PuntoSerie[];
  fecha: string | null;
}

export async function getCurvaTesoro(): Promise<CurvaTesoro> {
  const s = await fredVarias([...TENORES.map((t) => t.id), "T10Y2Y", "T10Y3M"]);

  const puntos: PuntoCurva[] = TENORES.map((t) => {
    const serie = s.get(t.id);
    return {
      label: t.label,
      anios: t.anios,
      hoy: ultimo(serie)?.valor ?? null,
      hace1m: haceDias(serie, 30)?.valor ?? null,
      hace1a: haceDias(serie, 365)?.valor ?? null,
    };
  });

  const spread = (id: string) => {
    const v = ultimo(s.get(id))?.valor;
    return v == null ? null : v * 100; // FRED lo publica en puntos porcentuales
  };

  return {
    puntos,
    spread10y2y: spread("T10Y2Y"),
    spread10y3m: spread("T10Y3M"),
    serie10a: s.get("DGS10") ?? [],
    fecha: ultimo(s.get("DGS10"))?.fecha ?? null,
  };
}

/**
 * Duration modificada aproximada de un bono del Tesoro que cotiza a la par.
 *
 * FRED publica la curva de **vencimientos constantes**: el rendimiento de un
 * bono a la par a 10 años. Pero la curva de soberanos argentinos se grafica
 * contra **duration**, porque los Globales amortizan y su plazo efectivo es
 * bastante más corto que su vencimiento. Comparar 10 años del Tesoro contra 10
 * años de un GD41 sería comparar dos cosas distintas.
 *
 * Para un bono a la par con cupón semestral y TIR `y`, la duration modificada
 * sale cerrada: `[1 − (1 + y/2)^(−2n)] / y`. Con el 10 años al 4,67% da 7,9 —
 * que es la duration que efectivamente tiene el Tesoro a 10 años.
 */
export function durationPar(anios: number, tirPct: number): number {
  const y = tirPct / 100;
  if (!(y > 0)) return anios;
  return (1 - Math.pow(1 + y / 2, -2 * anios)) / y;
}

export interface PuntoTesoro {
  label: string;
  anios: number;
  /** Duration modificada, para poder cruzarla contra la curva argentina. */
  duration: number;
  /** TIR en %. */
  tir: number;
}

/**
 * La curva del Tesoro expresada en duration: el mismo eje que usan las curvas
 * de renta fija argentina, así que las dos se pueden dibujar juntas y la
 * distancia vertical entre ellas *es* el spread de crédito.
 */
export async function getCurvaTesoroDuration(): Promise<PuntoTesoro[]> {
  const curva = await getCurvaTesoro();
  return curva.puntos
    .filter((p): p is PuntoCurva & { hoy: number } => p.hoy != null)
    .map((p) => ({
      label: p.label,
      anios: p.anios,
      duration: durationPar(p.anios, p.hoy),
      tir: p.hoy,
    }))
    .sort((a, b) => a.duration - b.duration);
}

/**
 * El rendimiento del Tesoro a una duration dada, interpolado linealmente.
 *
 * Fuera del rango de la curva devuelve `null` en vez de extrapolar: una TIR del
 * Tesoro inventada más allá de los 15 años de duration se convertiría en un
 * spread inventado, y un spread es exactamente el número que después se le
 * muestra a un cliente.
 */
export function tesoroEnDuration(curva: PuntoTesoro[], duration: number): number | null {
  if (curva.length < 2) return null;
  if (duration < curva[0].duration || duration > curva[curva.length - 1].duration) return null;

  for (let i = 1; i < curva.length; i++) {
    const a = curva[i - 1];
    const b = curva[i];
    if (duration <= b.duration) {
      const t = (duration - a.duration) / (b.duration - a.duration || 1);
      return a.tir + t * (b.tir - a.tir);
    }
  }
  return null;
}

// ─── Inflación ───────────────────────────────────────────────────────────────

export interface InflacionUsa {
  /** IPC general, variación interanual en %. */
  cpiIa: number | null;
  /** IPC general, variación mensual en %. */
  cpiMensual: number | null;
  /** IPC núcleo (sin alimentos ni energía), interanual. */
  coreIa: number | null;
  coreMensual: number | null;
  /** PCE núcleo: el índice que la Fed mira para su meta del 2%. */
  pceCoreIa: number | null;
  pceIa: number | null;
  /** Inflación implícita a 10 años en los TIPS (breakeven). */
  breakeven10: number | null;
  /** Expectativa a 5 años dentro de 5 años: el ancla de largo plazo. */
  forward5y5y: number | null;
  /** Mes del último dato de IPC, YYYY-MM-DD. */
  fechaCpi: string | null;
  /** Mes del último dato de PCE (sale más tarde que el IPC). */
  fechaPce: string | null;
  /** Series interanuales para el gráfico: IPC, núcleo y PCE núcleo. */
  grafico: { fecha: string; cpi: number | null; core: number | null; pceCore: number | null }[];
}

export async function getInflacionUsa(): Promise<InflacionUsa> {
  const s = await fredVarias(["CPIAUCSL", "CPILFESL", "PCEPI", "PCEPILFE", "T10YIE", "T5YIFR"]);

  const cpi = s.get("CPIAUCSL");
  const core = s.get("CPILFESL");
  const pce = s.get("PCEPI");
  const pceCore = s.get("PCEPILFE");

  // El gráfico junta las tres series por mes: el PCE se publica un mes después
  // que el IPC, así que las últimas filas traen núcleo pero no PCE.
  const ia = {
    cpi: new Map(serieInteranual(cpi).map((p) => [p.fecha, p.valor])),
    core: new Map(serieInteranual(core).map((p) => [p.fecha, p.valor])),
    pceCore: new Map(serieInteranual(pceCore).map((p) => [p.fecha, p.valor])),
  };
  const fechas = [...new Set([...ia.cpi.keys(), ...ia.core.keys(), ...ia.pceCore.keys()])]
    .sort()
    .slice(-48);

  return {
    cpiIa: variacionInteranual(cpi),
    cpiMensual: variacionMensual(cpi),
    coreIa: variacionInteranual(core),
    coreMensual: variacionMensual(core),
    pceIa: variacionInteranual(pce),
    pceCoreIa: variacionInteranual(pceCore),
    breakeven10: ultimo(s.get("T10YIE"))?.valor ?? null,
    forward5y5y: ultimo(s.get("T5YIFR"))?.valor ?? null,
    fechaCpi: ultimo(cpi)?.fecha ?? null,
    fechaPce: ultimo(pceCore)?.fecha ?? null,
    grafico: fechas.map((f) => ({
      fecha: f,
      cpi: ia.cpi.get(f) ?? null,
      core: ia.core.get(f) ?? null,
      pceCore: ia.pceCore.get(f) ?? null,
    })),
  };
}

// ─── Tasas en el mundo ───────────────────────────────────────────────────────

export interface TasaPais {
  pais: string;
  /** Qué instrumento es la tasa corta de ese bloque. */
  etiquetaCorta: string;
  corta: number | null;
  fechaCorta: string | null;
  /** Rendimiento del bono soberano a 10 años. */
  larga: number | null;
  fechaLarga: string | null;
  /** Diferencial del 10 años contra el Tesoro norteamericano, en pb. */
  vsTesoro: number | null;
}

const BLOQUES: { pais: string; etiquetaCorta: string; corta: string; larga: string }[] = [
  { pais: "Estados Unidos", etiquetaCorta: "efectiva Fed", corta: "EFFR", larga: "DGS10" },
  { pais: "Zona euro", etiquetaCorta: "depósito BCE", corta: "ECBDFR", larga: "IRLTLT01DEM156N" },
  { pais: "Reino Unido", etiquetaCorta: "SONIA", corta: "IUDSOIA", larga: "IRLTLT01GBM156N" },
  { pais: "Japón", etiquetaCorta: "call money", corta: "IRSTCI01JPM156N", larga: "IRLTLT01JPM156N" },
];

/**
 * El precio del dinero en los cuatro bloques que mueven el capital global.
 *
 * No está por completismo. El diferencial de tasas largas entre EE.UU. y
 * Alemania es de lo que más explica el movimiento del dólar contra el euro, y
 * el 10 años japonés importa por una razón que no es obvia: durante décadas
 * Japón exportó ahorro al mundo porque en casa no pagaban nada. A medida que el
 * JGB rinde más, ese dinero vuelve, y presiona hacia arriba las tasas largas de
 * todos lados —incluida la que descuenta a un bono argentino—.
 *
 * Las tasas largas de Europa y Japón se publican con frecuencia mensual, así
 * que cada fila viaja con la fecha de su propio dato: mezclarlas con las
 * diarias de EE.UU. sin decirlo haría comparar cosas de meses distintos.
 */
export async function getTasasMundo(): Promise<TasaPais[]> {
  const s = await fredVarias([
    ...BLOQUES.map((b) => b.corta),
    ...BLOQUES.map((b) => b.larga),
  ]);

  const ust10 = ultimo(s.get("DGS10"))?.valor ?? null;

  return BLOQUES.map((b) => {
    const corta = ultimo(s.get(b.corta));
    const larga = ultimo(s.get(b.larga));
    return {
      pais: b.pais,
      etiquetaCorta: b.etiquetaCorta,
      corta: corta?.valor ?? null,
      fechaCorta: corta?.fecha ?? null,
      larga: larga?.valor ?? null,
      fechaLarga: larga?.fecha ?? null,
      // La fila de EE.UU. es la referencia: un "0 pb" contra sí misma sólo
      // agrega ruido a la columna.
      vsTesoro:
        b.larga !== "DGS10" && larga && ust10 != null ? (larga.valor - ust10) * 100 : null,
    };
  });
}

// ─── Postura de la política monetaria ────────────────────────────────────────

export interface PosturaFed {
  /** Tasa efectiva nominal, en %. */
  nominal: number;
  /** Inflación núcleo del PCE, interanual en %. */
  inflacionNucleo: number;
  /** Tasa real: nominal menos inflación núcleo, en %. */
  real: number;
  /** Mes del dato de inflación con que se calculó. */
  fecha: string;
  /** Serie mensual de la tasa real, para ver contra su propia historia. */
  serie: { fecha: string; real: number; nominal: number }[];
}

/**
 * Qué tan apretada está la política monetaria, de verdad.
 *
 * El nivel nominal de la tasa no dice casi nada por sí solo: 3,63% con
 * inflación de 1% es durísimo y con inflación de 3,5% es prácticamente
 * neutral. Lo que importa es la diferencia —la tasa real—, y es la lectura que
 * explica por qué el mercado puede estar descontando **subas** con una tasa
 * nominal que a primera vista parece alta.
 *
 * Se usa el PCE núcleo y no el IPC porque es el índice sobre el que está
 * definida la meta del 2%: es contra ése que el comité mide su propio trabajo.
 *
 * La serie histórica está para que el número se lea contra algo. No se compara
 * contra una tasa neutral estimada a propósito: r* no se observa, cada modelo
 * da un número distinto, y poner uno solo como si fuera un dato lo convertiría
 * en una precisión falsa. La regla de bolsillo —cerca de cero es expansivo,
 * arriba de 1,5% restrictivo— va escrita como lo que es.
 */
export async function getPosturaFed(): Promise<PosturaFed | null> {
  const s = await fredVarias(["EFFR", "PCEPILFE"]);

  const effr = s.get("EFFR");
  const pceCore = s.get("PCEPILFE");
  const ultimaEffr = ultimo(effr);
  const inflacion = variacionInteranual(pceCore);
  if (!ultimaEffr || inflacion == null) return null;

  // La EFFR es diaria y la inflación mensual: para la serie se toma, de cada
  // mes con dato de inflación, el último valor de tasa hasta esa fecha.
  const ia = serieInteranual(pceCore);
  const serie: PosturaFed["serie"] = [];
  let i = 0;
  let tasaVigente: number | null = null;
  for (const punto of ia) {
    while (i < (effr?.length ?? 0) && effr![i].fecha <= punto.fecha) {
      tasaVigente = effr![i].valor;
      i++;
    }
    if (tasaVigente != null) {
      serie.push({ fecha: punto.fecha, nominal: tasaVigente, real: tasaVigente - punto.valor });
    }
  }

  const fechaInflacion = ultimo(pceCore)!.fecha;
  return {
    nominal: ultimaEffr.valor,
    inflacionNucleo: inflacion,
    real: ultimaEffr.valor - inflacion,
    fecha: fechaInflacion,
    serie: serie.slice(-60),
  };
}

// ─── Actividad, empleo y condiciones financieras ─────────────────────────────

export interface IndicadorUsa {
  clave: string;
  label: string;
  /** Valor ya convertido a la unidad que se muestra. */
  valor: number | null;
  unidad: "%" | "idx" | "miles" | "mil M USD" | "pb" | "k viviendas";
  /** Cambio contra el dato anterior, en la misma unidad. */
  cambio: number | null;
  /** Fecha del último dato. */
  fecha: string | null;
  /**
   * Con qué frecuencia se publica. No es metadato ocioso: FRED estampa el dato
   * mensual el día 1 del mes, así que mostrarlo como "1 jul" sugiere un dato
   * diario que no existe. Con la frecuencia se imprime "jul 2026" o "2T 2026".
   */
  frecuencia: "diaria" | "semanal" | "mensual" | "trimestral";
  /** Qué mide y cómo se lee. Va debajo del número, no en un tooltip. */
  nota: string;
  /** Hacia dónde es "mejor": tiñe el cambio de verde o rojo. */
  mejor: "alto" | "bajo" | "neutro";
  /** Últimos puntos para el sparkline. */
  serie: number[];
  /** Término del glosario que explica el indicador, si existe. */
  termino?: string;
}

const SPARK = 24;

function spark(s: PuntoSerie[] | null | undefined): number[] {
  return (s ?? []).slice(-SPARK).map((p) => p.valor);
}

/**
 * Cuando el número que se muestra es una variación interanual, el sparkline
 * tiene que ser el de esa variación y no el del índice. La serie de nivel de
 * las ventas minoristas sube siempre —es un índice nominal— y una miniatura
 * en ascenso perpetuo al lado de un "5,0%" hace creer que la variación se está
 * acelerando cuando puede estar cayendo.
 */
function sparkIa(s: PuntoSerie[] | null | undefined): number[] {
  return spark(serieInteranual(s));
}

/** Cambio de la variación interanual contra el mes previo, en puntos porcentuales. */
function cambioIa(s: PuntoSerie[] | null | undefined): number | null {
  const ia = serieInteranual(s);
  return ia.length >= 2 ? ia[ia.length - 1].valor - ia[ia.length - 2].valor : null;
}

export async function getActividadUsa(): Promise<IndicadorUsa[]> {
  const s = await fredVarias([
    "UNRATE", "PAYEMS", "ICSA", "CES0500000003",
    "A191RL1Q225SBEA", "RSAFS", "INDPRO", "UMCSENT",
  ]);

  const payems = s.get("PAYEMS");
  const claims = s.get("ICSA");
  const salarios = s.get("CES0500000003");
  const ventas = s.get("RSAFS");
  const indpro = s.get("INDPRO");

  // Nóminas: FRED publica el **nivel** de empleo en miles. El dato que se
  // titula todos los meses ("+150 mil puestos") es la diferencia contra el mes
  // anterior, así que se calcula acá y el sparkline muestra las altas, no el stock.
  const nominasSerie = (payems ?? []).slice(1).map((p, i) => ({
    fecha: p.fecha,
    valor: p.valor - (payems ?? [])[i].valor,
  }));

  const ind: IndicadorUsa[] = [
    {
      clave: "UNRATE",
      label: "Desempleo",
      valor: ultimo(s.get("UNRATE"))?.valor ?? null,
      unidad: "%",
      cambio: cambioUltimo(s.get("UNRATE")),
      fecha: ultimo(s.get("UNRATE"))?.fecha ?? null,
      nota: "Mitad del mandato dual. Subas sostenidas adelantan recortes de tasa.",
      mejor: "bajo",
      frecuencia: "mensual",
      serie: spark(s.get("UNRATE")),
    },
    {
      clave: "PAYEMS",
      label: "Nóminas no agrícolas",
      valor: ultimo(nominasSerie)?.valor ?? null,
      unidad: "miles",
      cambio: cambioUltimo(nominasSerie),
      fecha: ultimo(nominasSerie)?.fecha ?? null,
      nota: "Puestos creados en el mes. El dato que más mueve al mercado, primer viernes.",
      mejor: "alto",
      frecuencia: "mensual",
      serie: spark(nominasSerie),
      termino: "Nóminas no agrícolas",
    },
    {
      clave: "ICSA",
      label: "Pedidos de seguro de desempleo",
      valor: ultimo(claims) ? (ultimo(claims)!.valor as number) / 1000 : null,
      unidad: "miles",
      cambio: cambioUltimo(claims) != null ? cambioUltimo(claims)! / 1000 : null,
      fecha: ultimo(claims)?.fecha ?? null,
      nota: "Semanal: el indicador de empleo más fresco. Arriba de 300 mil enciende alarmas.",
      mejor: "bajo",
      frecuencia: "semanal",
      serie: spark(claims).map((v) => v / 1000),
    },
    {
      clave: "SALARIOS",
      label: "Salario horario",
      valor: variacionInteranual(salarios),
      unidad: "%",
      cambio: cambioIa(salarios),
      fecha: ultimo(salarios)?.fecha ?? null,
      nota: "Interanual. Arriba del 4% la Fed lo lee como inflación de servicios.",
      mejor: "neutro",
      frecuencia: "mensual",
      serie: sparkIa(salarios),
    },
    {
      clave: "PBI",
      label: "PBI real",
      valor: ultimo(s.get("A191RL1Q225SBEA"))?.valor ?? null,
      unidad: "%",
      cambio: cambioUltimo(s.get("A191RL1Q225SBEA")),
      fecha: ultimo(s.get("A191RL1Q225SBEA"))?.fecha ?? null,
      nota: "Trimestral, anualizado. Dos trimestres negativos es la regla de bolsillo de recesión.",
      mejor: "alto",
      frecuencia: "trimestral",
      serie: spark(s.get("A191RL1Q225SBEA")),
    },
    {
      clave: "RSAFS",
      label: "Ventas minoristas",
      valor: variacionInteranual(ventas),
      unidad: "%",
      cambio: cambioIa(ventas),
      fecha: ultimo(ventas)?.fecha ?? null,
      nota: "Interanual, nominal. El consumo es dos tercios del PBI norteamericano.",
      mejor: "alto",
      frecuencia: "mensual",
      serie: sparkIa(ventas),
    },
    {
      clave: "INDPRO",
      label: "Producción industrial",
      valor: variacionInteranual(indpro),
      unidad: "%",
      cambio: cambioIa(indpro),
      fecha: ultimo(indpro)?.fecha ?? null,
      nota: "Interanual. Pesa poco en el PBI pero marca el ciclo antes que el resto.",
      mejor: "alto",
      frecuencia: "mensual",
      serie: sparkIa(indpro),
    },
    {
      clave: "UMCSENT",
      label: "Confianza del consumidor",
      valor: ultimo(s.get("UMCSENT"))?.valor ?? null,
      unidad: "idx",
      cambio: cambioUltimo(s.get("UMCSENT")),
      fecha: ultimo(s.get("UMCSENT"))?.fecha ?? null,
      nota: "Universidad de Michigan. Base 100 = 1966; abajo de 70 es pesimismo marcado.",
      mejor: "alto",
      frecuencia: "mensual",
      serie: spark(s.get("UMCSENT")),
    },
  ];

  return ind;
}

export async function getCondicionesFinancieras(): Promise<IndicadorUsa[]> {
  const s = await fredVarias(["VIXCLS", "BAMLH0A0HYM2", "NFCI", "DTWEXBGS", "WALCL"]);

  const hy = s.get("BAMLH0A0HYM2");
  const balance = s.get("WALCL");

  return [
    {
      clave: "VIX",
      label: "VIX",
      valor: ultimo(s.get("VIXCLS"))?.valor ?? null,
      unidad: "idx",
      cambio: cambioUltimo(s.get("VIXCLS")),
      fecha: ultimo(s.get("VIXCLS"))?.fecha ?? null,
      nota: "Volatilidad implícita del S&P a 30 días. Arriba de 25, el mercado se pone defensivo.",
      mejor: "bajo",
      frecuencia: "diaria",
      termino: "VIX",
      serie: spark(s.get("VIXCLS")),
    },
    {
      clave: "HY",
      label: "Spread high yield",
      valor: ultimo(hy) ? ultimo(hy)!.valor * 100 : null,
      unidad: "pb",
      cambio: cambioUltimo(hy) != null ? cambioUltimo(hy)! * 100 : null,
      fecha: ultimo(hy)?.fecha ?? null,
      nota: "Prima del corporativo basura sobre el Tesoro. Es el termómetro del apetito por riesgo.",
      mejor: "bajo",
      frecuencia: "diaria",
      termino: "Spread high yield",
      serie: spark(hy).map((v) => v * 100),
    },
    {
      clave: "NFCI",
      label: "Condiciones financieras",
      valor: ultimo(s.get("NFCI"))?.valor ?? null,
      unidad: "idx",
      cambio: cambioUltimo(s.get("NFCI")),
      fecha: ultimo(s.get("NFCI"))?.fecha ?? null,
      nota: "Índice de la Fed de Chicago. Cero es el promedio histórico; positivo, condiciones duras.",
      mejor: "bajo",
      frecuencia: "semanal",
      serie: spark(s.get("NFCI")),
    },
    {
      clave: "DXY",
      label: "Dólar (índice amplio)",
      valor: ultimo(s.get("DTWEXBGS"))?.valor ?? null,
      unidad: "idx",
      cambio: cambioUltimo(s.get("DTWEXBGS")),
      fecha: ultimo(s.get("DTWEXBGS"))?.fecha ?? null,
      nota: "Dólar contra la canasta amplia de socios. Un dólar fuerte aprieta a los emergentes.",
      mejor: "neutro",
      frecuencia: "diaria",
      termino: "DXY",
      serie: spark(s.get("DTWEXBGS")),
    },
    {
      clave: "WALCL",
      label: "Balance de la Fed",
      valor: ultimo(balance) ? ultimo(balance)!.valor / 1000 : null,
      unidad: "mil M USD",
      cambio: cambioUltimo(balance) != null ? cambioUltimo(balance)! / 1000 : null,
      fecha: ultimo(balance)?.fecha ?? null,
      nota: "Activos totales. Su caída (QT) drena liquidez aunque la tasa no se mueva.",
      mejor: "neutro",
      frecuencia: "semanal",
      termino: "Quantitative tightening",
      serie: spark(balance).map((v) => v / 1000),
    },
  ];
}
