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
  desdeHaceAnios,
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
  const desde = desdeHaceAnios(2);
  const s = await fredVarias([
    ...TENORES.map((t) => ({ id: t.id, desde })),
    { id: "T10Y2Y", desde },
    { id: "T10Y3M", desde },
  ]);

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
  const desdeMensual = desdeHaceAnios(6);
  const desdeDiario = desdeHaceAnios(2);
  const s = await fredVarias([
    { id: "CPIAUCSL", desde: desdeMensual },
    { id: "CPILFESL", desde: desdeMensual },
    { id: "PCEPI", desde: desdeMensual },
    { id: "PCEPILFE", desde: desdeMensual },
    { id: "T10YIE", desde: desdeDiario },
    { id: "T5YIFR", desde: desdeDiario },
  ]);

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
  const desdeM = desdeHaceAnios(5);
  const s = await fredVarias([
    { id: "UNRATE", desde: desdeM },
    { id: "PAYEMS", desde: desdeM },
    { id: "ICSA", desde: desdeHaceAnios(2) },
    { id: "CES0500000003", desde: desdeM },
    { id: "A191RL1Q225SBEA", desde: desdeHaceAnios(6) },
    { id: "RSAFS", desde: desdeM },
    { id: "INDPRO", desde: desdeM },
    { id: "UMCSENT", desde: desdeM },
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
  const desde = desdeHaceAnios(3);
  const s = await fredVarias([
    { id: "VIXCLS", desde },
    { id: "BAMLH0A0HYM2", desde },
    { id: "NFCI", desde },
    { id: "DTWEXBGS", desde },
    { id: "WALCL", desde },
  ]);

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
      serie: spark(balance).map((v) => v / 1000),
    },
  ];
}
