/**
 * La ficha de análisis de una empresa: la plantilla de trabajo del analista.
 *
 * Es la única parte del dashboard que **no** se puede volver a bajar de una
 * fuente. Todo lo demás —precio, márgenes, consenso— se recupera solo si se
 * pierde; esto es criterio propio y por eso vive en la DB.
 *
 * ## Cómo está armado
 *
 * La plantilla se declara acá como dato (`SECCIONES`) y la pantalla la
 * recorre. Se gana en dos lados: agregar un campo es una línea y no un
 * componente nuevo, y la completitud se puede contar sin que nadie mantenga
 * una lista aparte de cuántos campos hay.
 *
 * Este módulo es **puro**: lo importa la pantalla, que corre en el navegador,
 * así que no puede tocar la DB. La persistencia vive en `equity-ficha-db.ts`
 * (misma razón que `fuentes.ts`: un import de `better-sqlite3` en el bundle del
 * cliente no compila).
 *
 * Los valores se guardan en un JSON contra el ticker (ver `equity_fichas` en
 * `db.ts`), en tres baldes:
 *  - `campos`: texto libre, una clave por campo;
 *  - `tablas`: filas de las cuatro grillas (segmentos, monedas, deuda, valuación);
 *  - `checks`: el checklist de notas del balance.
 *
 * ## Qué NO se pide a mano
 *
 * Todo número que el dashboard ya sabe se completa solo: precio, market cap,
 * EV, el cuadro de la sección 5 entero, los múltiplos y la comparación contra
 * los pares. Una ficha que pide tipear el margen bruto de cinco años no se
 * llena nunca, y peor: se llena mal. Lo que queda para escribir es lo que
 * ninguna API tiene —el moat, el management, la tesis, los kill criteria—.
 */
// ─── La plantilla ────────────────────────────────────────────────────────────

export interface Campo {
  clave: string;
  label: string;
  /** `area` para prosa de varias líneas; `linea` para una respuesta corta. */
  tipo: "linea" | "area";
  /** Qué contestar. Va como placeholder, así que tiene que ser concreto. */
  pista?: string;
  /** Respuestas sugeridas: se ofrecen como chips y se pueden ignorar. */
  opciones?: string[];
}

export interface Tabla {
  clave: string;
  label: string;
  columnas: string[];
  /** Si están, la primera columna es fija y no se edita. */
  filasFijas?: string[];
  /** Cuántas filas arranca mostrando una tabla libre. */
  filasIniciales?: number;
}

export interface Seccion {
  id: string;
  numero: number;
  titulo: string;
  /** De qué se trata la sección, en una línea. */
  bajada: string;
  campos: Campo[];
  tablas?: Tabla[];
  /** El checklist de la sección 7. */
  checklist?: string[];
  /** Bloque de datos calculados que la pantalla inserta en esta sección. */
  auto?: "numeros" | "multiplos" | "deuda" | "seguimiento" | "insiders";
}

export const SECCIONES: Seccion[] = [
  {
    id: "negocio",
    numero: 1,
    titulo: "El negocio en tres oraciones",
    bajada: "Qué vende, a quién, por qué le pagan a ella",
    campos: [
      {
        clave: "negocio",
        label: "El negocio",
        tipo: "area",
        pista: "Qué vende, a quién, por qué le pagan a ella y no al de al lado.",
      },
      {
        clave: "driver_a",
        label: "Driver de ingresos — cantidad",
        tipo: "linea",
        pista: "Unidades, suscriptores, toneladas, m² alquilados…",
      },
      {
        clave: "driver_b",
        label: "Driver de ingresos — precio",
        tipo: "linea",
        pista: "Precio por unidad, ARPU, tarifa regulada…",
      },
      {
        clave: "mata",
        label: "Qué la puede matar",
        tipo: "area",
        pista: "El escenario que hace cero la tesis, no el que la hace rendir menos.",
      },
    ],
  },
  {
    id: "plata",
    numero: 2,
    titulo: "De dónde viene la plata",
    bajada: "Segmentos, concentración y en qué moneda cobra y paga",
    campos: [
      {
        clave: "concentracion_clientes",
        label: "Concentración de clientes",
        tipo: "linea",
        pista: "Cuánto pesan los cinco más grandes. Si no lo informa, decirlo.",
      },
      {
        clave: "descalce",
        label: "¿Hay descalce?",
        tipo: "area",
        pista: "Cobra en pesos y debe en dólares, o al revés. Qué le pasa si el tipo de cambio salta 30%.",
      },
    ],
    tablas: [
      {
        clave: "segmentos",
        label: "Por segmento",
        columnas: ["Segmento", "% Ventas", "% EBITDA", "Margen", "ROIC"],
        filasIniciales: 3,
      },
      {
        clave: "monedas",
        label: "Exposición por moneda",
        columnas: ["", "% USD", "% ARS", "Otras"],
        filasFijas: ["Ingresos", "Costos", "Deuda"],
      },
    ],
  },
  {
    id: "competitiva",
    numero: 3,
    titulo: "Posición competitiva",
    bajada: "Qué la protege y cuánto dura",
    campos: [
      {
        clave: "tipo_negocio",
        label: "Tipo de negocio",
        tipo: "linea",
        opciones: ["Cíclico", "Defensivo", "Crecimiento secular"],
      },
      {
        clave: "momento_ciclo",
        label: "Momento del ciclo",
        tipo: "linea",
        pista: "Dónde está parada hoy y contra qué se compara ese punto.",
      },
      {
        clave: "moat",
        label: "Moat identificado",
        tipo: "linea",
        pista: "Escala, marca, costos de cambio, red, licencia, activo irreplicable.",
      },
      {
        clave: "evidencia_moat",
        label: "Evidencia del moat",
        tipo: "area",
        pista: "Margen y ROIC sostenidos en el tiempo. Sin números, el moat es una opinión.",
      },
      {
        clave: "cuota_mercado",
        label: "Cuota de mercado y dirección",
        tipo: "linea",
        pista: "Cuánto tiene y si viene ganando o perdiendo.",
      },
      {
        clave: "regulacion",
        label: "Marco regulatorio y riesgo político",
        tipo: "area",
        pista: "Tarifas, retenciones, licencias, controles de capital.",
      },
    ],
  },
  {
    id: "management",
    numero: 4,
    titulo: "Management",
    bajada: "Quién decide, qué hizo con la plata y si cumple lo que promete",
    auto: "insiders",
    campos: [
      { clave: "controlante", label: "Controlante / estructura accionaria", tipo: "linea" },
      { clave: "free_float", label: "Free float", tipo: "linea", pista: "% y liquidez diaria." },
      {
        clave: "asignacion_capital",
        label: "Asignación de capital, últimos 10 años",
        tipo: "area",
        pista: "En qué se fue la caja: capex, adquisiciones, dividendos, recompras, deuda.",
      },
      {
        clave: "adquisiciones",
        label: "¿Las adquisiciones crearon valor?",
        tipo: "area",
        pista: "Qué pagó, qué compró y qué pasó con el ROIC después.",
      },
      { clave: "insiders", label: "Insiders — tenencia y movimientos", tipo: "linea" },
      {
        clave: "partes_relacionadas",
        label: "Partes relacionadas — hallazgos",
        tipo: "area",
        pista: "Operaciones con el controlante, alquileres, préstamos, honorarios.",
      },
      {
        clave: "cumplimiento",
        label: "Cumplimiento de lo prometido en calls anteriores",
        tipo: "area",
        pista: "Qué dijeron hace un año y qué pasó.",
      },
    ],
  },
  {
    id: "numeros",
    numero: 5,
    titulo: "Números",
    bajada: "La serie, y si el resultado es de verdad operativo",
    auto: "numeros",
    campos: [
      {
        clave: "roic_vs_wacc",
        label: "¿ROIC > WACC de forma sostenida?",
        tipo: "linea",
        opciones: ["Sí", "No", "En el ciclo bueno"],
      },
      {
        clave: "calidad_resultado",
        label: "Calidad del resultado",
        tipo: "area",
        pista: "Cuánto es operativo y cuánto financiero, tenencia o RECPAM. En Argentina esto define si el número sirve.",
      },
      {
        clave: "no_recurrentes",
        label: "Ítems no recurrentes normalizados",
        tipo: "area",
        pista: "Qué se sacó de la serie y por qué.",
      },
    ],
  },
  {
    id: "deuda",
    numero: 6,
    titulo: "Estructura de deuda",
    bajada: "Cuándo vence, en qué moneda y si puede pagarla sola",
    auto: "deuda",
    campos: [
      {
        clave: "covenants",
        label: "Covenants y holgura",
        tipo: "area",
        pista: "Qué ratio compromete, en qué nivel está y cuánto margen queda.",
      },
      {
        clave: "flujo_propio",
        label: "¿Puede pagar con flujo propio o depende de refinanciar?",
        tipo: "area",
        pista: "FCF de los próximos doce meses contra el vencimiento de los próximos doce meses.",
      },
    ],
    tablas: [
      {
        clave: "deuda",
        label: "Perfil de vencimientos",
        columnas: ["Vencimiento", "Monto", "Moneda", "Tasa"],
        filasFijas: ["< 12 m", "12-24 m", "24-36 m", "> 36 m"],
      },
    ],
  },
  {
    id: "notas",
    numero: 7,
    titulo: "Notas del balance",
    bajada: "El checklist de lo que hay que leer antes de opinar",
    checklist: [
      "Segmentos",
      "Deuda",
      "Partes relacionadas",
      "Contingencias",
      "Hechos posteriores",
      "Impuestos",
      "Compromisos",
      "Derivados",
      "Concentración",
      "Cambios de política contable",
    ],
    campos: [
      {
        clave: "hallazgos",
        label: "Hallazgos relevantes",
        tipo: "area",
        pista: "Lo que cambia la tesis y no estaba en el estado de resultados.",
      },
    ],
  },
  {
    id: "valuacion",
    numero: 8,
    titulo: "Valuación",
    bajada: "Cuánto vale, contra qué se compara y qué descuenta el precio",
    auto: "multiplos",
    campos: [
      { clave: "rango_valor", label: "Rango de valor", tipo: "linea", pista: "De cuánto a cuánto por acción." },
      {
        clave: "vs_historico",
        label: "Vs. su propio promedio histórico",
        tipo: "linea",
        pista: "Caro o barato contra sí misma, no sólo contra los pares.",
      },
      {
        clave: "dcf_inverso",
        label: "DCF inverso — qué descuenta el precio hoy",
        tipo: "area",
        pista: "Qué crecimiento y qué margen hay que creer para justificar el precio. Es la pregunta más honesta de la ficha.",
      },
    ],
    tablas: [
      {
        clave: "valuacion",
        label: "Métodos",
        columnas: ["Método", "Valor por acción", "Supuestos clave"],
        filasFijas: ["DCF — base", "DCF — bajista", "DCF — alcista", "Múltiplos comparables", "SOTP"],
      },
    ],
  },
  {
    id: "tesis",
    numero: 9,
    titulo: "Tesis",
    bajada: "Qué se compra, por qué el mercado no lo ve y cuándo se abandona",
    campos: [
      {
        clave: "postura",
        label: "Postura",
        tipo: "linea",
        pista: "La decisión, en una palabra. El panel de arriba describe; esto lo firma el analista.",
        opciones: ["Comprar", "Acumular", "Mantener", "Mirar de afuera", "Vender"],
      },
      {
        clave: "tesis",
        label: "Tesis",
        tipo: "area",
        pista: "Dos o tres oraciones. Si no entra en tres, todavía no está.",
      },
      { clave: "driver_1", label: "Driver cuantificado 1", tipo: "linea" },
      { clave: "driver_2", label: "Driver cuantificado 2", tipo: "linea" },
      { clave: "driver_3", label: "Driver cuantificado 3", tipo: "linea" },
      {
        clave: "catalizadores",
        label: "Catalizadores y timing",
        tipo: "area",
        pista: "Qué tiene que pasar para que el mercado lo vea, y cuándo.",
      },
      {
        clave: "variante_percibida",
        label: "Variante percibida",
        tipo: "area",
        pista: "En qué difiero del consenso y por qué tengo razón yo.",
      },
      { clave: "riesgo_1", label: "Riesgo 1 — probabilidad × impacto", tipo: "linea" },
      { clave: "riesgo_2", label: "Riesgo 2", tipo: "linea" },
      { clave: "riesgo_3", label: "Riesgo 3", tipo: "linea" },
      { clave: "kill_1", label: "Kill criteria 1 — abandono la tesis si…", tipo: "linea" },
      { clave: "kill_2", label: "Kill criteria 2", tipo: "linea" },
      { clave: "kill_3", label: "Kill criteria 3", tipo: "linea" },
    ],
  },
  {
    id: "seguimiento",
    numero: 10,
    titulo: "Seguimiento",
    bajada: "Qué mirar el trimestre que viene",
    auto: "seguimiento",
    campos: [
      {
        clave: "metricas_vigilar",
        label: "Métricas a vigilar cada trimestre",
        tipo: "area",
        pista: "Las tres que confirman o rompen la tesis. No las diez del reporte.",
      },
      { clave: "ultima_actualizacion_modelo", label: "Última actualización del modelo", tipo: "linea" },
    ],
  },
];

/** Todas las claves de texto de la plantilla, en orden. */
export const CLAVES = SECCIONES.flatMap((s) => s.campos.map((c) => c.clave));

const POR_CLAVE = new Map<string, Campo>(
  SECCIONES.flatMap((s) => s.campos.map((c) => [c.clave, c] as const))
);

export const esCampoValido = (clave: string) => POR_CLAVE.has(clave);

export function tablaDe(clave: string): Tabla | null {
  for (const s of SECCIONES) {
    const t = s.tablas?.find((x) => x.clave === clave);
    if (t) return t;
  }
  return null;
}

export const esTablaValida = (clave: string) => tablaDe(clave) != null;

export const esCheckValido = (clave: string) =>
  SECCIONES.some((s) => s.checklist?.includes(clave));

// ─── Los datos guardados ─────────────────────────────────────────────────────

export interface FichaAnalisis {
  ticker: string;
  campos: Record<string, string>;
  tablas: Record<string, string[][]>;
  checks: Record<string, boolean>;
  /** ISO del último guardado. Null si la ficha todavía no existe. */
  actualizado: string | null;
  creado: string | null;
}

// ─── Completitud ─────────────────────────────────────────────────────────────

export interface Avance {
  /** Campos de texto escritos sobre el total de la plantilla. */
  completos: number;
  total: number;
  porcentaje: number;
  /** Qué secciones tienen al menos un campo escrito. */
  seccionesConAlgo: string[];
}

export function avanceDe(ficha: FichaAnalisis): Avance {
  const completos = CLAVES.filter((c) => (ficha.campos[c] ?? "").trim().length > 0).length;
  const seccionesConAlgo = SECCIONES.filter(
    (s) =>
      s.campos.some((c) => (ficha.campos[c.clave] ?? "").trim().length > 0) ||
      // Misma regla que al guardar: la etiqueta de una fila fija no la escribió nadie.
      s.tablas?.some((t) =>
        ficha.tablas[t.clave]?.some((f) => f.slice(t.filasFijas ? 1 : 0).some(Boolean))
      ) ||
      s.checklist?.some((i) => ficha.checks[i])
  ).map((s) => s.id);

  return {
    completos,
    total: CLAVES.length,
    porcentaje: Math.round((completos / CLAVES.length) * 100),
    seccionesConAlgo,
  };
}

// ─── WACC estimado ───────────────────────────────────────────────────────────

export interface Wacc {
  /** Costo promedio ponderado del capital, en %. */
  wacc: number;
  /** Costo del capital propio por CAPM, en %. */
  ke: number;
  /** Costo de la deuda después de impuestos, en %. Null si no hay deuda. */
  kd: number | null;
  /** Peso de la deuda sobre el capital total, en %. */
  pesoDeuda: number;
  beta: number;
  tasaLibre: number;
  primaMercado: number;
}

/**
 * Estima el WACC con CAPM. Es la vara contra la que se lee el ROIC: un negocio
 * que rinde 9% sobre el capital y financia al 11% destruye valor por más que
 * gane plata.
 *
 * Tres decisiones que conviene tener a la vista, porque el número cambia con
 * ellas y ninguna es "la correcta":
 *
 *  - **Tasa libre de riesgo**: el Tesoro a 10 años de FRED, que es la que se
 *    usa para descontar flujos largos.
 *  - **Prima de mercado**: 5%, el orden de magnitud de las estimaciones de
 *    Damodaran para EE.UU. Se declara como supuesto, no se esconde.
 *  - **Costo de la deuda**: los intereses pagados sobre la deuda total del
 *    último balance. Es la tasa que la empresa **paga hoy**, no la que
 *    conseguiría emitiendo ahora; con tasas muy movidas, subestima.
 *
 * El peso de la deuda va a valor de mercado del equity contra deuda contable,
 * que es la convención práctica: no existe precio de mercado de la deuda de la
 * mayoría de las empresas.
 */
export function estimarWacc({
  beta,
  capitalizacion,
  deudaTotal,
  interesesPagados,
  tasaImpositiva,
  tasaLibre,
  primaMercado = 5,
}: {
  beta: number | null;
  capitalizacion: number | null;
  deudaTotal: number | null;
  interesesPagados: number | null;
  tasaImpositiva: number | null;
  tasaLibre: number | null;
  primaMercado?: number;
}): Wacc | null {
  if (beta == null || capitalizacion == null || !capitalizacion || tasaLibre == null) return null;

  const deuda = deudaTotal ?? 0;
  const total = capitalizacion + deuda;
  const ke = tasaLibre + beta * primaMercado;

  // Sin intereses informados no se inventa un costo de deuda: se pondera sólo
  // el capital propio, que es lo mismo que suponer que la deuda cuesta igual.
  const kdBruto = interesesPagados != null && deuda > 0 ? (Math.abs(interesesPagados) / deuda) * 100 : null;
  const impuesto = tasaImpositiva ?? 0;
  const kd = kdBruto == null ? null : kdBruto * (1 - impuesto);

  const pesoDeuda = (deuda / total) * 100;
  const wacc = kd == null ? ke : (capitalizacion / total) * ke + (deuda / total) * kd;

  return { wacc, ke, kd, pesoDeuda, beta, tasaLibre, primaMercado };
}
