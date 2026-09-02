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
import type { Perfil, PerfilPapel } from "@/lib/equity-perfil";

// ─── La plantilla ────────────────────────────────────────────────────────────

/** Contenido que reemplaza al de base en algunos perfiles. */
type PorPerfil = Partial<Record<Perfil, { label?: string; pista?: string; opciones?: string[] }>>;

export interface Campo {
  clave: string;
  label: string;
  /** `area` para prosa de varias líneas; `linea` para una respuesta corta. */
  tipo: "linea" | "area";
  /** Qué contestar. Va como placeholder, así que tiene que ser concreto. */
  pista?: string;
  /** Respuestas sugeridas: se ofrecen como chips y se pueden ignorar. */
  opciones?: string[];
  /**
   * Lo que hay que contestar sí o sí. El resto de la sección arranca plegado:
   * una ficha de 43 campos vacíos no se empieza, y el porcentaje de avance
   * mide lo que importa y no cuántos casilleros quedan.
   */
  nucleo?: boolean;
  /** Perfiles en los que aparece. Sin esto, aparece en todos. */
  solo?: Perfil[];
  /** Perfiles en los que no aparece. */
  excepto?: Perfil[];
  /** Sólo para ADR argentinos, o sólo para los que no lo son. */
  geografia?: "argentino" | "global";
  /** Reemplazos por perfil: la misma pregunta, en el idioma del negocio. */
  porPerfil?: PorPerfil;
  /** Lo que se agrega a la pista cuando el papel es argentino. */
  pistaArgentina?: string;
}

export interface Tabla {
  clave: string;
  label: string;
  columnas: string[];
  /** Si están, la primera columna es fija y no se edita. */
  filasFijas?: string[];
  /** Cuántas filas arranca mostrando una tabla libre. */
  filasIniciales?: number;
  solo?: Perfil[];
  excepto?: Perfil[];
  geografia?: "argentino" | "global";
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

/**
 * La plantilla completa: la unión de todo lo que cualquier perfil puede pedir.
 *
 * Ningún papel ve esto entero — `seccionesDe()` filtra. Pero la validación al
 * guardar sí va contra la unión, y tiene que ser así: si una ficha se escribió
 * cuando Yahoo devolvía "Precious Metals" y al día siguiente devuelve otra
 * industria, lo que ya está escrito se sigue pudiendo guardar. La plantilla
 * decide qué se pregunta, nunca qué se puede conservar.
 */
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
        nucleo: true,
        pista: "Qué vende, a quién, por qué le pagan a ella y no al de al lado.",
      },
      {
        clave: "driver_a",
        label: "Driver de ingresos — cantidad",
        tipo: "linea",
        nucleo: true,
        pista: "Unidades, suscriptores, toneladas, m² alquilados…",
        porPerfil: {
          software: { pista: "Clientes o seats, y la retención neta de ingresos (NRR): sin eso el crecimiento no se distingue de la rotación." },
          semis: { pista: "Unidades y contenido por unidad. Dónde está el ciclo de inventarios de sus clientes." },
          hardware: { pista: "Unidades vendidas y base instalada. Cuánto es reemplazo y cuánto usuario nuevo." },
          biotech: { pista: "Pacientes tratados o unidades por droga. Cuántas drogas sostienen las ventas." },
          salud: { pista: "Procedimientos, altas, camas ocupadas o equipos instalados." },
          banco: { label: "Driver de ingresos — volumen", pista: "Cartera de préstamos y depósitos, y cómo crecen contra el sistema." },
          seguros: { label: "Driver de ingresos — volumen", pista: "Primas emitidas y pólizas vigentes. Retención de cartera." },
          gestora: { label: "Driver de ingresos — activos", pista: "AUM y flujos netos. Cuánto del AUM crece por mercado y cuánto por flujo." },
          reit: { label: "Driver de ingresos — superficie", pista: "Metros alquilables y ocupación. Qué porcentaje de los contratos vence en tres años." },
          energia: { label: "Driver de ingresos — producción", pista: "Producción diaria (boe/d) y reservas probadas: cuántos años de vida al ritmo actual." },
          minera: { label: "Driver de ingresos — producción", pista: "Onzas o toneladas producidas, ley del mineral y vida útil de la mina." },
          utility: { label: "Driver de ingresos — demanda", pista: "Usuarios y volumen (GWh, m³), y la base de capital regulada sobre la que cobra." },
          industrial: { pista: "Unidades, o cartera de pedidos (backlog) y cuántos meses de producción cubre." },
          consumo: { pista: "Locales, tráfico y unidades. Ventas de locales comparables (same-store)." },
          medios: { label: "Driver de ingresos — abonados", pista: "Suscriptores, altas netas y churn." },
          transporte: { label: "Driver de ingresos — volumen", pista: "Volumen transportado y factor de ocupación." },
        },
      },
      {
        clave: "driver_b",
        label: "Driver de ingresos — precio",
        tipo: "linea",
        nucleo: true,
        pista: "Precio por unidad, ARPU, tarifa regulada…",
        porPerfil: {
          software: { pista: "ARPU, tiers, precio por consumo. ¿Sube precios sin perder clientes?" },
          semis: { pista: "Precio promedio (ASP) y mix. Si el ASP cae, el volumen tiene que correr más rápido." },
          hardware: { pista: "Precio promedio y mix de producto. Cuánto del ingreso es servicio recurrente." },
          biotech: { pista: "Precio neto por tratamiento después de descuentos a pagadores, y la presión sobre precios." },
          salud: { pista: "Reembolso por procedimiento y mix de pagador." },
          banco: { label: "Driver de ingresos — spread", pista: "Margen financiero neto (NIM) y comisiones. Qué le pasa si la tasa baja 200 pb." },
          seguros: { label: "Driver de ingresos — tarifa", pista: "Tarifa y momento del ciclo de suscripción: mercado duro o blando." },
          gestora: { label: "Driver de ingresos — comisión", pista: "Fee rate promedio sobre AUM y hacia dónde va." },
          reit: { label: "Driver de ingresos — alquiler", pista: "Alquiler por m², renovaciones (leasing spreads) e indexación de los contratos." },
          energia: { label: "Driver de ingresos — precio realizado", pista: "Precio realizado contra el spot, coberturas y diferencial de la cuenca." },
          minera: { label: "Driver de ingresos — precio realizado", pista: "Precio realizado contra el spot, y el cash cost / AISC por unidad." },
          utility: { label: "Driver de ingresos — tarifa", pista: "Cuadro tarifario, retorno regulado autorizado y cuándo es la próxima revisión." },
          industrial: { pista: "Precio y capacidad de trasladar costos. Cuántos contratos tienen ajuste." },
          consumo: { pista: "Ticket promedio y capacidad de subir precios sin perder volumen." },
          medios: { pista: "ARPU y publicidad por usuario." },
          transporte: { label: "Driver de ingresos — tarifa", pista: "Tarifa por unidad transportada, y si sigue al combustible o se lo come." },
        },
      },
      {
        clave: "mata",
        label: "Qué la puede matar",
        tipo: "area",
        nucleo: true,
        pista: "El escenario que hace cero la tesis, no el que la hace rendir menos.",
        porPerfil: {
          software: { pista: "Un competidor que regala lo que ella cobra, o un cambio de plataforma que la deja afuera. No 'crece menos'." },
          semis: { pista: "Perder el diseño en el próximo producto del cliente grande, o un ciclo de inventarios largo con la fábrica pagada." },
          biotech: { pista: "El ensayo que falla o la patente que vence sin nada atrás. No 'se demora la aprobación'." },
          banco: { pista: "Una corrida de depósitos, o una cartera que se deteriora más rápido de lo que el capital aguanta." },
          seguros: { pista: "Un evento de cola mal reservado, o reservas de años anteriores que hay que reforzar." },
          reit: { pista: "Refinanciar a una tasa que se come el flujo del alquiler, o un inquilino ancla que se va." },
          energia: { pista: "El precio del barril bajo su costo por varios trimestres, con la deuda ya tomada." },
          minera: { pista: "El precio bajo el AISC por varios trimestres, o perder la licencia social de la mina principal." },
          utility: { pista: "Una revisión tarifaria que no reconoce las inversiones ya hechas." },
          transporte: { pista: "Un combustible que sube y una tarifa que no lo sigue, con los activos financiados." },
        },
      },
    ],
  },
  {
    id: "plata",
    numero: 2,
    titulo: "De dónde viene la plata",
    bajada: "Segmentos, concentración y qué pasa si se cae una pata",
    campos: [
      {
        clave: "concentracion_clientes",
        label: "Concentración de clientes",
        tipo: "linea",
        pista: "Cuánto pesan los cinco más grandes. Si no lo informa, decirlo.",
        porPerfil: {
          banco: { label: "Concentración de cartera", pista: "Por deudor, por sector y por región. Y del lado del pasivo: los depositantes grandes." },
          seguros: { label: "Concentración de riesgo", pista: "Por ramo y por geografía. Exposición a catástrofe y cuánto está reasegurado." },
          gestora: { label: "Concentración de AUM", pista: "Cuánto pesan los mandatos más grandes y qué tan rápido se pueden ir." },
          reit: { label: "Concentración de inquilinos", pista: "Cuánto del alquiler pagan los cinco más grandes y cuándo les vence el contrato." },
          energia: { label: "Concentración de activos", pista: "Cuánto del EBITDA sale de un solo yacimiento o de una sola cuenca." },
          minera: { label: "Concentración de activos", pista: "Cuánto del EBITDA sale de una sola mina, y cuánta vida útil le queda." },
          consumo: { label: "Concentración de canal", pista: "Cuánto pesan las cadenas o distribuidores más grandes. Del otro lado: los proveedores." },
          medios: { label: "Concentración de ingresos", pista: "Cuánto depende de un anunciante, de una plataforma o de un contrato de distribución." },
          utility: { label: "Concentración regulatoria", pista: "Cuántas jurisdicciones y cuánto pesa la más grande." },
        },
      },
      {
        clave: "exposicion_geografica",
        label: "Exposición geográfica de ventas",
        tipo: "area",
        geografia: "global",
        pista: "Cuánto viene de EE.UU., Europa, China. Qué pasa si un mercado se cierra o se pone un arancel.",
      },
      {
        clave: "descalce",
        label: "¿Hay descalce?",
        tipo: "area",
        geografia: "argentino",
        pista: "Cobra en pesos y debe en dólares, o al revés. Qué le pasa si el tipo de cambio salta 30%.",
      },
      {
        clave: "fondeo",
        label: "Estructura de fondeo",
        tipo: "area",
        solo: ["banco", "gestora"],
        pista: "Depósitos a la vista contra plazo, costo de fondeo, liquidez y concentración de depositantes.",
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
        geografia: "argentino",
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
        porPerfil: {
          semis: { pista: "Dónde está el ciclo de inventarios de sus clientes y la utilización de la industria." },
          banco: { pista: "Dónde está el ciclo de crédito y qué forma tiene la curva de tasas." },
          seguros: { pista: "Mercado duro o blando: hacia dónde van las tarifas del ramo." },
          reit: { pista: "El cap rate del sector contra la tasa larga, y qué está pasando con la oferta nueva." },
          energia: { pista: "El precio del crudo o del gas contra su costo y contra su promedio de diez años." },
          minera: { pista: "El precio del metal contra el AISC de la industria y contra su promedio de diez años." },
          industrial: { pista: "Dónde está el ciclo de capex de sus clientes y qué dice el book-to-bill." },
          transporte: { pista: "Tarifas spot contra contrato, y si hay capacidad entrando o saliendo del mercado." },
          consumo: { pista: "Qué está haciendo el consumo y cómo viene el trade-down hacia marcas más baratas." },
        },
      },
      {
        clave: "moat",
        label: "Moat identificado",
        tipo: "linea",
        nucleo: true,
        pista: "Escala, marca, costos de cambio, red, licencia, activo irreplicable.",
        porPerfil: {
          software: { opciones: ["Costos de cambio", "Efecto de red", "Escala de datos", "Integrado al stack del cliente"] },
          semis: { opciones: ["Propiedad intelectual", "Escala de fabricación", "Costo de rediseño", "Nodo de proceso"] },
          hardware: { opciones: ["Base instalada", "Estándar de la industria", "Escala en costos", "Red de servicio"] },
          biotech: { opciones: ["Patentes", "Datos clínicos", "Canal comercial", "Escala en I+D"] },
          salud: { opciones: ["Red de prestadores", "Densidad geográfica", "Contratos con pagadores", "Escala"] },
          banco: { opciones: ["Depósitos baratos", "Marca y confianza", "Escala en costos", "Red de distribución"] },
          seguros: { opciones: ["Disciplina de suscripción", "Datos actuariales", "Escala en reaseguro", "Canal propio"] },
          gestora: { opciones: ["Historial de performance", "Canal de distribución", "Producto pegajoso", "Escala en costos"] },
          reit: { opciones: ["Ubicación irreplicable", "Contratos largos", "Costo de capital", "Escala en gestión"] },
          energia: { opciones: ["Costo por barril", "Calidad de la roca", "Infraestructura propia", "Vida de reservas"] },
          minera: { opciones: ["Costo por onza", "Ley del mineral", "Vida de reservas", "Infraestructura propia"] },
          utility: { opciones: ["Monopolio regulado", "Base de capital", "Concesión"] },
          industrial: { opciones: ["Escala", "Costos de cambio", "Marca técnica", "Servicio postventa"] },
          consumo: { opciones: ["Marca", "Escala en distribución", "Ubicación", "Costo más bajo"] },
          medios: { opciones: ["Contenido propio", "Última milla", "Escala en publicidad", "Licencia de espectro"] },
          transporte: { opciones: ["Red y densidad", "Activos irreplicables", "Concesiones", "Escala en costos"] },
        },
      },
      {
        clave: "evidencia_moat",
        label: "Evidencia del moat",
        tipo: "area",
        nucleo: true,
        pista: "Margen y ROIC sostenidos en el tiempo. Sin números, el moat es una opinión.",
        porPerfil: {
          software: { pista: "NRR arriba de 110% año tras año, margen bruto estable y churn bajo. Sin números, el moat es una opinión." },
          banco: { pista: "ROE por encima del costo del capital a lo largo del ciclo, y costo de fondeo por debajo de sus pares." },
          seguros: { pista: "Combined ratio debajo de 100 en varios años seguidos, no sólo en los buenos." },
          reit: { pista: "Ocupación y leasing spreads sostenidos, incluso cuando el sector tuvo vacancia." },
          minera: { pista: "AISC en el primer cuartil de la curva de costos de la industria, no sólo un año." },
          energia: { pista: "Costo por barril en el primer cuartil y reposición de reservas por encima de 100%." },
        },
      },
      {
        clave: "cuota_mercado",
        label: "Cuota de mercado y dirección",
        tipo: "linea",
        pista: "Cuánto tiene y si viene ganando o perdiendo.",
      },
      {
        clave: "regulacion",
        label: "Marco regulatorio",
        tipo: "area",
        pista: "Qué organismo puede cambiarle las reglas y con qué anticipación.",
        pistaArgentina: "Retenciones, controles de capital, cepo, precios máximos: qué le pasa al flujo si cambian.",
        porPerfil: {
          software: { pista: "Privacidad, antitrust, moderación de contenido. Qué causa está abierta y qué puede ordenar." },
          semis: { pista: "Controles de exportación y subsidios: a qué mercados puede vender y con qué tecnología." },
          biotech: { pista: "FDA/EMA: aprobaciones pendientes, y la presión sobre precios de los pagadores." },
          salud: { pista: "Reembolsos públicos y privados: quién fija el precio de lo que cobra." },
          banco: { pista: "Requisitos de capital (CET1), encajes, límites de tasa y de comisiones." },
          seguros: { pista: "Solvencia, reservas mínimas y aprobación de tarifas." },
          gestora: { pista: "Reglas de custodia, deber fiduciario, transparencia de comisiones." },
          reit: { pista: "Régimen REIT: cuánto obliga a distribuir y qué pasa si deja de calificar. Zonificación." },
          energia: { pista: "Permisos, royalties, política ambiental y acceso a ductos." },
          minera: { pista: "Permisos, royalties, comunidades y licencia social. Un permiso trabado vale más que un mal trimestre." },
          utility: { pista: "Marco tarifario: quién fija el precio, cada cuánto se revisa y qué retorno reconoce." },
          transporte: { pista: "Concesiones, rutas asignadas y límites de tarifa." },
        },
      },
      {
        clave: "riesgo_pais",
        label: "Riesgo país y político",
        tipo: "area",
        geografia: "argentino",
        pista: "Qué le pasa a la tesis con un cambio de gobierno, un default o un cepo más duro.",
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
        nucleo: true,
        pista: "En qué se fue la caja: capex, adquisiciones, dividendos, recompras, deuda.",
        porPerfil: {
          software: { pista: "En qué se fue la caja: I+D, adquisiciones, recompras. Y cuánto de la 'recompra' sólo tapa la dilución por pago en acciones." },
          biotech: { pista: "En qué se fue la caja: I+D propio contra licencias y adquisiciones de pipeline. Qué rindió cada camino." },
          reit: { pista: "En qué se fue la caja: desarrollos, compras, ventas de activos y emisión de acciones. A qué cap rate compró y a cuál vendió." },
          energia: { pista: "Capex de mantenimiento contra crecimiento, y qué hizo con la caja de los años de precio alto." },
          minera: { pista: "Exploración, expansión y adquisiciones. Qué hizo con la caja del último pico de precios." },
          utility: { pista: "Capex sobre base regulada, dividendos y emisión de acciones para financiarlo." },
        },
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
        nucleo: true,
        opciones: ["Sí", "No", "En el ciclo bueno"],
        porPerfil: {
          banco: { label: "¿ROE > costo del capital de forma sostenida?" },
          seguros: { label: "¿ROE > costo del capital de forma sostenida?" },
          gestora: { label: "¿ROE > costo del capital de forma sostenida?" },
        },
      },
      {
        clave: "calidad_resultado",
        label: "Calidad del resultado",
        tipo: "area",
        nucleo: true,
        pista: "Cuánto es operativo y cuánto financiero o de tenencia. Y cuánta caja hay detrás de la ganancia contable.",
        pistaArgentina: "Cuánto es operativo y cuánto financiero, tenencia o RECPAM. En Argentina esto define si el número sirve.",
        porPerfil: {
          software: { pista: "Ganancia contable contra caja: cuánto de la diferencia es pago en acciones (SBC) y capitalización de desarrollo." },
          biotech: { pista: "Cuánto del resultado es venta de producto y cuánto son hitos, licencias o subsidios que no se repiten." },
          banco: { pista: "Cuánto del resultado es margen recurrente y cuánto trading, venta de cartera o reversión de previsiones." },
          reit: { pista: "Resultado contra FFO y AFFO: la revaluación de propiedades no es plata que entró." },
        },
      },
      {
        clave: "no_recurrentes",
        label: "Ítems no recurrentes normalizados",
        tipo: "area",
        pista: "Qué se sacó de la serie y por qué.",
      },
      {
        clave: "kpi_software",
        label: "Retención, churn y dilución",
        tipo: "area",
        nucleo: true,
        solo: ["software"],
        pista: "NRR y churn de los últimos trimestres, y cuánto diluye por año el pago en acciones (SBC).",
      },
      {
        clave: "kpi_semis",
        label: "Ciclo, inventarios y capacidad",
        tipo: "area",
        nucleo: true,
        solo: ["semis"],
        pista: "Semanas de inventario propio y del canal, utilización de fábrica y capex del año.",
      },
      {
        clave: "kpi_hardware",
        label: "Base instalada y recurrencia",
        tipo: "area",
        nucleo: true,
        solo: ["hardware"],
        pista: "Ciclo de reemplazo, attach rate de servicios y cuánto del ingreso es recurrente.",
      },
      {
        clave: "kpi_biotech",
        label: "Pipeline y vencimiento de patentes",
        tipo: "area",
        nucleo: true,
        solo: ["biotech"],
        pista: "Qué droga sostiene las ventas, cuándo pierde exclusividad (LOE) y qué hay atrás en fase 3.",
      },
      {
        clave: "kpi_salud",
        label: "Volumen y mix de pagador",
        tipo: "area",
        nucleo: true,
        solo: ["salud"],
        pista: "Procedimientos o altas, reembolso promedio y mix público/privado.",
      },
      {
        clave: "kpi_banco",
        label: "Calidad de cartera y capital",
        tipo: "area",
        nucleo: true,
        solo: ["banco"],
        pista: "Mora, cobertura, costo del riesgo, CET1 y ratio de eficiencia. Cómo vienen contra el año pasado.",
      },
      {
        clave: "kpi_seguros",
        label: "Combined ratio y reservas",
        tipo: "area",
        nucleo: true,
        solo: ["seguros"],
        pista: "Siniestralidad + gastos sobre primas. Debajo de 100 gana suscribiendo; arriba, sólo con el float. Desarrollo de reservas de años anteriores.",
      },
      {
        clave: "kpi_gestora",
        label: "AUM, flujos y comisión",
        tipo: "area",
        nucleo: true,
        solo: ["gestora"],
        pista: "Flujos netos por trimestre, fee rate y performance contra el índice de referencia.",
      },
      {
        clave: "kpi_reit",
        label: "FFO, ocupación y vencimientos",
        tipo: "area",
        nucleo: true,
        solo: ["reit"],
        pista: "FFO y AFFO por acción, ocupación, leasing spreads y cuánto de los contratos vence en tres años.",
      },
      {
        clave: "kpi_energia",
        label: "Reservas y precio de equilibrio",
        tipo: "area",
        nucleo: true,
        solo: ["energia"],
        pista: "Reservas probadas, años de vida, tasa de reposición y a qué precio el flujo da cero.",
      },
      {
        clave: "kpi_minera",
        label: "Costos, ley y reservas",
        tipo: "area",
        nucleo: true,
        solo: ["minera"],
        pista: "AISC por unidad contra el precio realizado, ley del mineral, reservas y vida de mina.",
      },
      {
        clave: "kpi_utility",
        label: "Base regulada y revisión tarifaria",
        tipo: "area",
        nucleo: true,
        solo: ["utility"],
        pista: "Rate base, retorno autorizado, cuánto del capex se reconoce y cuándo es la próxima revisión.",
      },
      {
        clave: "kpi_industrial",
        label: "Cartera de pedidos",
        tipo: "area",
        nucleo: true,
        solo: ["industrial"],
        pista: "Backlog, book-to-bill y cuántos meses de producción cubre.",
      },
      {
        clave: "kpi_consumo",
        label: "Ventas comparables",
        tipo: "area",
        nucleo: true,
        solo: ["consumo"],
        pista: "Same-store sales abiertas en tráfico y ticket. Aperturas netas del año.",
      },
      {
        clave: "kpi_medios",
        label: "Abonados, churn y contenido",
        tipo: "area",
        nucleo: true,
        solo: ["medios"],
        pista: "Altas netas, churn mensual, ARPU y qué cuesta el contenido que los retiene.",
      },
      {
        clave: "kpi_transporte",
        label: "Utilización y tarifa",
        tipo: "area",
        nucleo: true,
        solo: ["transporte"],
        pista: "Factor de ocupación, tarifa por unidad y cuánto del combustible está cubierto o se traslada.",
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
        excepto: ["banco", "seguros", "gestora"],
        pista: "Qué ratio compromete, en qué nivel está y cuánto margen queda.",
      },
      {
        clave: "flujo_propio",
        label: "¿Puede pagar con flujo propio o depende de refinanciar?",
        tipo: "area",
        nucleo: true,
        pista: "FCF de los próximos doce meses contra el vencimiento de los próximos doce meses.",
        porPerfil: {
          banco: { label: "Liquidez y capacidad de absorber pérdidas", pista: "LCR, activos líquidos sobre depósitos y cuánta pérdida de cartera aguanta el capital antes de tocar el mínimo." },
          seguros: { label: "Solvencia y liquidez", pista: "Ratio de solvencia y cuánto del activo se puede liquidar sin realizar pérdidas." },
          reit: { label: "¿Puede refinanciar sin diluir?", pista: "Vencimientos de tres años contra el AFFO, y a qué tasa vence contra a cuál renovaría hoy." },
        },
      },
    ],
    tablas: [
      {
        clave: "deuda",
        label: "Perfil de vencimientos",
        columnas: ["Vencimiento", "Monto", "Moneda", "Tasa"],
        filasFijas: ["< 12 m", "12-24 m", "24-36 m", "> 36 m"],
        excepto: ["banco", "seguros"],
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
      {
        clave: "rango_valor",
        label: "Rango de valor",
        tipo: "linea",
        nucleo: true,
        pista: "De cuánto a cuánto por acción.",
      },
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
        nucleo: true,
        pista: "El panel de arriba calcula el crecimiento implícito. Acá va si es creíble, y por qué.",
        porPerfil: {
          banco: { label: "Qué descuenta el precio hoy", pista: "El P/BV implica un ROE sostenido: ¿cuál, y lo puede dar? En un banco el DCF de arriba no aplica." },
          seguros: { label: "Qué descuenta el precio hoy", pista: "Qué combined ratio y qué retorno del float hay que creer para pagar este P/BV." },
          gestora: { label: "Qué descuenta el precio hoy", pista: "Qué crecimiento de AUM y qué fee rate hay que creer para pagar este precio." },
          reit: { pista: "El cap rate implícito del precio contra el de las transacciones del mercado. Y el crecimiento de AFFO que hace falta." },
          minera: { pista: "Qué precio del metal de largo plazo hay que creer para justificar el precio de hoy, contra el spot." },
          energia: { pista: "Qué precio del crudo de largo plazo hay que creer para justificar el precio de hoy, contra la curva de futuros." },
        },
      },
    ],
    tablas: [
      {
        clave: "valuacion",
        label: "Métodos",
        columnas: ["Método", "Valor por acción", "Supuestos clave"],
        filasFijas: ["DCF — base", "DCF — bajista", "DCF — alcista", "Múltiplos comparables", "SOTP"],
        excepto: ["banco", "seguros", "gestora"],
      },
      {
        clave: "valuacion_financiero",
        label: "Métodos",
        columnas: ["Método", "Valor por acción", "Supuestos clave"],
        filasFijas: ["P/BV × ROE sostenible", "Descuento de dividendos", "Suma de partes", "Múltiplos comparables"],
        solo: ["banco", "seguros", "gestora"],
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
        nucleo: true,
        pista: "La decisión, en una palabra. El panel de arriba describe; esto lo firma el analista.",
        opciones: ["Comprar", "Acumular", "Mantener", "Mirar de afuera", "Vender"],
      },
      {
        clave: "tesis",
        label: "Tesis",
        tipo: "area",
        nucleo: true,
        pista: "Dos o tres oraciones. Si no entra en tres, todavía no está.",
      },
      { clave: "driver_1", label: "Driver cuantificado 1", tipo: "linea", nucleo: true },
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
      { clave: "riesgo_1", label: "Riesgo 1 — probabilidad × impacto", tipo: "linea", nucleo: true },
      { clave: "riesgo_2", label: "Riesgo 2", tipo: "linea" },
      { clave: "riesgo_3", label: "Riesgo 3", tipo: "linea" },
      {
        clave: "kill_1",
        label: "Kill criteria 1 — abandono la tesis si…",
        tipo: "linea",
        nucleo: true,
        pista: "Un número y un plazo. 'Si se pone feo' no es un kill criteria.",
      },
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
        nucleo: true,
        pista: "Las tres que confirman o rompen la tesis. No las diez del reporte.",
      },
      { clave: "ultima_actualizacion_modelo", label: "Última actualización del modelo", tipo: "linea" },
    ],
  },
];

// ─── La plantilla de un papel concreto ───────────────────────────────────────

/** ¿Este campo o tabla le corresponde a este papel? */
function aplica(
  x: { solo?: Perfil[]; excepto?: Perfil[]; geografia?: "argentino" | "global" },
  perfil: PerfilPapel
): boolean {
  if (x.solo && !x.solo.includes(perfil.id)) return false;
  if (x.excepto?.includes(perfil.id)) return false;
  if (x.geografia === "argentino" && !perfil.argentino) return false;
  if (x.geografia === "global" && perfil.argentino) return false;
  return true;
}

/**
 * El campo con el texto que le corresponde al perfil ya resuelto.
 *
 * Devuelve un objeto nuevo con **sólo lo que la pantalla usa**, no un spread
 * del original. La diferencia no es cosmética: estas secciones cruzan a un
 * Client Component, así que un `...campo` mandaba el `porPerfil` entero —las
 * dieciséis variantes de cada pregunta— dentro del HTML de cada ficha, para
 * que el navegador descarte quince.
 */
function resolver(campo: Campo, perfil: PerfilPapel): Campo {
  const propio = campo.porPerfil?.[perfil.id];

  return {
    clave: campo.clave,
    tipo: campo.tipo,
    nucleo: campo.nucleo,
    label: propio?.label ?? campo.label,
    pista:
      perfil.argentino && campo.pistaArgentina
        ? campo.pistaArgentina
        : propio?.pista ?? campo.pista,
    opciones: propio?.opciones ?? campo.opciones,
  };
}

/**
 * La plantilla que le toca a un papel.
 *
 * Saca lo que no aplica y traduce lo que queda al idioma del negocio: a una
 * empresa de software le pregunta por NRR y dilución por SBC, a una minera por
 * AISC y ley del mineral, a un banco por mora y CET1. Las secciones y las
 * claves son las mismas —lo que ya está escrito se sigue viendo— y lo único
 * que cambia es qué se pregunta y cómo.
 */
export function seccionesDe(perfil: PerfilPapel): Seccion[] {
  return SECCIONES.map((s) => ({
    ...s,
    campos: s.campos.filter((c) => aplica(c, perfil)).map((c) => resolver(c, perfil)),
    tablas: s.tablas?.filter((t) => aplica(t, perfil)),
  }));
}

/** Todas las claves de texto de la plantilla, en orden. */
export const CLAVES = SECCIONES.flatMap((s) => s.campos.map((c) => c.clave));

const POR_CLAVE = new Map<string, Campo>(
  SECCIONES.flatMap((s) => s.campos.map((c) => [c.clave, c] as const))
);

export const esCampoValido = (clave: string) => POR_CLAVE.has(clave);

/** El campo de la plantilla completa, para poder etiquetar lo que ya no se pregunta. */
export const campoDe = (clave: string): Campo | null => POR_CLAVE.get(clave) ?? null;

/**
 * Lo que está escrito y esta plantilla ya no pregunta.
 *
 * Pasa cuando una ficha se empezó con otro perfil —Yahoo cambió la industria,
 * o el papel dejó de ser un ADR argentino en el universo— y también cuando se
 * corrige una regla de clasificación. El texto sigue en la base; sin esto,
 * sería texto que nadie puede ver ni borrar. La plantilla decide qué se
 * pregunta, nunca qué se conserva.
 */
export function camposHuerfanos(ficha: FichaAnalisis, secciones: Seccion[]): Campo[] {
  const visibles = new Set(secciones.flatMap((s) => s.campos.map((c) => c.clave)));
  return Object.entries(ficha.campos)
    .filter(([clave, valor]) => valor.trim().length > 0 && !visibles.has(clave))
    .map(([clave]) => campoDe(clave))
    .filter((c): c is Campo => c != null);
}

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
  /** Campos del núcleo escritos, sobre el total del núcleo. */
  completos: number;
  total: number;
  porcentaje: number;
  /** Campos opcionales escritos, sobre los opcionales de este papel. */
  opcionales: number;
  totalOpcionales: number;
  /** Qué secciones tienen al menos un campo escrito. */
  seccionesConAlgo: string[];
}

/**
 * Cuánto de la ficha está escrito.
 *
 * El porcentaje mide **sólo el núcleo**: los diecinueve campos sin los cuales
 * la ficha no dice nada. Antes contaba los 43 y una ficha con la tesis, los
 * kill criteria y la valuación escritas marcaba 40%, que desalienta y además
 * miente sobre qué falta. Lo opcional se cuenta aparte y suma prolijidad, no
 * avance.
 *
 * Recibe las secciones ya resueltas para el papel: si a una minera no se le
 * pregunta por NRR, ese campo no puede contar en su denominador.
 */
export function avanceDe(ficha: FichaAnalisis, secciones: Seccion[] = SECCIONES): Avance {
  const escrito = (c: Campo) => (ficha.campos[c.clave] ?? "").trim().length > 0;
  const campos = secciones.flatMap((s) => s.campos);
  const nucleo = campos.filter((c) => c.nucleo);
  const resto = campos.filter((c) => !c.nucleo);

  const seccionesConAlgo = secciones
    .filter(
      (s) =>
        s.campos.some(escrito) ||
        // Misma regla que al guardar: la etiqueta de una fila fija no la escribió nadie.
        s.tablas?.some((t) =>
          ficha.tablas[t.clave]?.some((f) => f.slice(t.filasFijas ? 1 : 0).some(Boolean))
        ) ||
        s.checklist?.some((i) => ficha.checks[i])
    )
    .map((s) => s.id);

  const completos = nucleo.filter(escrito).length;

  return {
    completos,
    total: nucleo.length,
    porcentaje: nucleo.length ? Math.round((completos / nucleo.length) * 100) : 0,
    opcionales: resto.filter(escrito).length,
    totalOpcionales: resto.length,
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
