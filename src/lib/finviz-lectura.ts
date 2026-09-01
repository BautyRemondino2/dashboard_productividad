/**
 * De los números de Finviz a una lectura de qué está pasando con un papel.
 *
 * ## Por qué las tensiones y no las métricas
 *
 * Un panel de noventa números no es un análisis: es la misma tabla de Finviz
 * con otra tipografía. Lo que dice algo es el **cruce** entre dos números que
 * no cierran juntos. El caso que ordenó todo este módulo fue META en
 * septiembre de 2026: ventas +27,7% interanual y ganancia por acción −5%,
 * EV/EBITDA 13,7 (barata) contra P/FCF 36 (cara), 27% abajo del máximo con el
 * consenso en compra fuerte. Ninguna métrica sola dice nada; las tres juntas
 * dicen exactamente qué está pasando —está gastando en algo que todavía no
 * rinde— y de qué depende la tesis.
 *
 * Por eso hay dos capas:
 *  - **Señales**: un número con su lectura y su umbral declarado. Contexto.
 *  - **Tensiones**: dos o más números que se contradicen. Eso es la noticia.
 *
 * ## Lo que este módulo no hace
 *
 * No dice comprar ni vender. Describe la situación, nombra de qué depende y
 * deja la postura al analista —que es un campo de la ficha, escrito por él—.
 * Una máquina de reglas que grita "comprar" con umbrales fijos es exactamente
 * lo que un asesor no puede firmar.
 *
 * ## Los umbrales son generales
 *
 * `Debt/Eq > 2` es mucho para una empresa de software y normal para una
 * utility; un P/E de 25 es caro en un banco y barato en una de software. Las
 * lecturas dicen qué **es** el número y qué implica en general; la comparación
 * contra los pares vive en el bloque de múltiplos de la ficha, que sí compara
 * contra la mediana del sector. Las dos cosas se leen juntas.
 */
import type { MetricasFinviz } from "@/lib/finviz";
import type { Sector } from "@/lib/equity-sectores";

export type Tono = "bueno" | "malo" | "atencion" | "neutro";

export type Grupo =
  | "valuacion"
  | "crecimiento"
  | "calidad"
  | "balance"
  | "posicionamiento"
  | "tape"
  | "consenso";

export const GRUPO_LABEL: Record<Grupo, string> = {
  valuacion: "Valuación",
  crecimiento: "Crecimiento",
  calidad: "Calidad del negocio",
  balance: "Balance",
  posicionamiento: "Quién está adentro",
  tape: "El precio",
  consenso: "Consenso",
};

export interface Señal {
  grupo: Grupo;
  label: string;
  /** El número, ya formateado. */
  valor: string;
  /** Qué significa ese número. Vacío cuando el número habla solo. */
  lectura: string;
  tono: Tono;
}

export interface Tension {
  titulo: string;
  detalle: string;
  tono: Tono;
  /** 1 a 3. Ordena cuáles suben al veredicto. */
  peso: number;
}

export interface Radiografia {
  señales: Señal[];
  tensiones: Tension[];
  /** Qué está pasando, en dos o tres oraciones. */
  veredicto: string[];
  /** De qué depende que la lectura se sostenga. Insumo para los kill criteria. */
  deQueDepende: string[];
}

export interface ContextoLectura {
  ticker: string;
  precio: number | null;
  /** El WACC estimado en la ficha, para leer el ROIC contra algo. */
  wacc: number | null;
  /** Fecha ISO del próximo balance, si Yahoo la publica. */
  proximoBalance: string | null;
  /**
   * El sector GICS. No es decorativo: cambia qué reglas tienen sentido.
   * En un banco, deuda sobre patrimonio de 3 es el negocio y no una alarma.
   */
  sector?: Sector | null;
}

/**
 * Bancos, aseguradoras y REITs: el apalancamiento es estructural y las métricas
 * de caja libre no significan lo mismo. Las reglas que hablan de capex o de
 * deuda excesiva no se aplican acá — dispararlas sería ruido con formato de
 * hallazgo.
 */
const esApalancadaPorDiseño = (sector: Sector | null | undefined) =>
  sector === "Financials" || sector === "Real Estate";

// ─── Formato ─────────────────────────────────────────────────────────────────

const pct = (v: number | null, d = 1): string =>
  v == null ? "—" : `${v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d })}%`;

/**
 * Con signo: para variaciones, donde el signo es la mitad del dato.
 *
 * Un valor que redondea a cero va sin signo: `-0,04%` mostrado como `-0,0%` se
 * lee como una caída que no existe.
 */
const pctSigno = (v: number | null, d = 1): string => {
  if (v == null) return "—";
  const redondeado = Number(v.toFixed(d));
  return `${redondeado > 0 ? "+" : ""}${pct(redondeado === 0 ? 0 : v, d)}`;
};

const veces = (v: number | null, d = 1): string =>
  v == null ? "—" : `${v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d })}×`;

const num = (v: number | null, d = 1): string =>
  v == null ? "—" : v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });

const usd = (v: number | null): string =>
  v == null ? "—" : `US$${v.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;

function diasHasta(iso: string | null): number | null {
  if (!iso) return null;
  const hoy = new Date();
  const a = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - a) / 86_400_000);
}

/** Cómo se llama una recomendación de Finviz, que va de 1 a 5. */
function labelRecomendacion(r: number): string {
  if (r <= 1.5) return "compra fuerte";
  if (r <= 2.5) return "compra";
  if (r <= 3.5) return "mantener";
  if (r <= 4.5) return "venta";
  return "venta fuerte";
}

// ─── Señales ─────────────────────────────────────────────────────────────────

function señales(m: MetricasFinviz, ctx: ContextoLectura): Señal[] {
  const s: Señal[] = [];
  const add = (
    grupo: Grupo,
    label: string,
    valor: string,
    lectura: string,
    tono: Tono = "neutro",
    hay = true
  ) => {
    if (hay) s.push({ grupo, label, valor, lectura, tono });
  };

  // ── Valuación
  if (m.peg != null) {
    add(
      "valuacion",
      "PEG",
      num(m.peg, 2),
      m.peg < 1
        ? "paga menos de una vez el crecimiento que espera el consenso"
        : m.peg <= 2
          ? "el precio está en línea con el crecimiento esperado"
          : "el precio ya tiene puesto el escenario bueno",
      m.peg < 1 ? "bueno" : m.peg <= 2 ? "neutro" : "atencion"
    );
  }
  if (m.per != null) {
    const salto = m.perForward != null && m.per > 0 ? (m.perForward / m.per - 1) * 100 : null;
    add(
      "valuacion",
      "P/E · forward",
      `${num(m.per)} · ${num(m.perForward)}`,
      salto == null
        ? ""
        : salto < -10
          ? `el consenso espera que las ganancias suban: el múltiplo baja ${pct(Math.abs(salto), 0)} con las del año que viene`
          : salto > 10
            ? `el consenso espera que las ganancias caigan: el múltiplo sube ${pct(salto, 0)} con las del año que viene`
            : "las ganancias esperadas no cambian mucho el múltiplo",
      "neutro"
    );
  }
  add("valuacion", "EV / EBITDA", veces(m.evEbitda), "", "neutro", m.evEbitda != null);
  if (m.precioFcf != null) {
    add(
      "valuacion",
      "P / FCF",
      veces(m.precioFcf),
      m.precioFcf > 30
        ? "caro medido en caja libre, que es la que se reparte"
        : m.precioFcf < 15
          ? "barato medido en caja libre"
          : "",
      m.precioFcf > 35 ? "atencion" : m.precioFcf < 15 ? "bueno" : "neutro"
    );
  }

  // ── Crecimiento
  add(
    "crecimiento",
    "Ventas TTM",
    pctSigno(m.ventasTtm),
    "últimos doce meses contra los doce anteriores",
    m.ventasTtm == null ? "neutro" : m.ventasTtm > 10 ? "bueno" : m.ventasTtm < 0 ? "malo" : "neutro",
    m.ventasTtm != null
  );
  add(
    "crecimiento",
    "Ganancia TTM",
    pctSigno(m.epsTtm),
    "por acción, mismo período",
    m.epsTtm == null ? "neutro" : m.epsTtm > 10 ? "bueno" : m.epsTtm < 0 ? "malo" : "neutro",
    m.epsTtm != null
  );
  add(
    "crecimiento",
    "Esperado a 5 años",
    `${pct(m.epsProximos5)} anual`,
    m.epsPasado5 != null
      ? `venía creciendo ${pct(m.epsPasado5)} anual en los últimos cinco`
      : "consenso de analistas",
    "neutro",
    m.epsProximos5 != null
  );
  if (m.epsProximoAño != null) {
    add(
      "crecimiento",
      "Ganancia el año que viene",
      pctSigno(m.epsProximoAño),
      m.epsProximos5 != null && m.epsProximoAño < m.epsProximos5 - 5
        ? "por debajo de su propio promedio a cinco años: el consenso descuenta un año flojo"
        : "",
      m.epsProximoAño < 0 ? "malo" : "neutro"
    );
  }

  // ── Calidad
  if (m.roic != null) {
    const contra = ctx.wacc != null ? ` · WACC estimado ${pct(ctx.wacc)}` : "";
    add(
      "calidad",
      "ROIC",
      pct(m.roic),
      ctx.wacc != null
        ? m.roic > ctx.wacc
          ? `rinde sobre el capital más de lo que le cuesta financiarlo${contra}`
          : `no cubre el costo del capital${contra}`
        : "retorno sobre el capital invertido",
      ctx.wacc != null ? (m.roic > ctx.wacc ? "bueno" : "malo") : m.roic > 15 ? "bueno" : "neutro"
    );
  }
  add(
    "calidad",
    "Margen operativo",
    pct(m.margenOperativo),
    m.margenBruto != null ? `bruto ${pct(m.margenBruto)}` : "",
    m.margenOperativo == null ? "neutro" : m.margenOperativo > 20 ? "bueno" : m.margenOperativo < 5 ? "atencion" : "neutro",
    m.margenOperativo != null
  );
  add("calidad", "ROE", pct(m.roe), "", "neutro", m.roe != null);

  // ── Balance
  const estructural = esApalancadaPorDiseño(ctx.sector);
  if (m.deudaPatrimonio != null) {
    add(
      "balance",
      "Deuda / patrimonio",
      num(m.deudaPatrimonio, 2),
      estructural
        ? "en este sector el apalancamiento es el negocio: lo que decide es la calidad de la cartera y el capital regulatorio, que no están en esta tabla"
        : m.deudaPatrimonio > 2
          ? "apalancada: la estructura de capital manda sobre el resultado"
          : m.deudaPatrimonio < 0.5
            ? "poca deuda: el balance no es el problema"
            : "",
      estructural ? "neutro" : m.deudaPatrimonio > 2 ? "atencion" : m.deudaPatrimonio < 0.5 ? "bueno" : "neutro"
    );
  }
  if (m.liquidezSeca != null && !estructural) {
    add(
      "balance",
      "Liquidez seca",
      num(m.liquidezSeca, 2),
      m.liquidezSeca < 1
        ? "el activo líquido no cubre el pasivo corriente: depende de refinanciar"
        : "cubre el pasivo corriente sin vender inventario",
      m.liquidezSeca < 1 ? "atencion" : "bueno"
    );
  }

  // ── Posicionamiento
  if (m.shortFloat != null) {
    add(
      "posicionamiento",
      "Short float",
      pct(m.shortFloat),
      m.shortFloat > 15
        ? "apuesta en contra grande: un dato bueno puede forzar recompras"
        : m.shortFloat > 8
          ? "hay una apuesta en contra relevante"
          : "casi nadie apuesta en contra",
      m.shortFloat > 15 ? "atencion" : m.shortFloat > 8 ? "atencion" : "neutro"
    );
  }
  if (m.insiderTenencia != null || m.insiderMovimiento != null) {
    add(
      "posicionamiento",
      "Insiders",
      `${pct(m.insiderTenencia)} · ${pctSigno(m.insiderMovimiento)}`,
      m.insiderMovimiento == null
        ? "tenencia de los de adentro"
        : m.insiderMovimiento < -5
          ? "vendieron en el último trimestre"
          : m.insiderMovimiento > 5
            ? "compraron en el último trimestre"
            : "sin movimientos relevantes",
      m.insiderMovimiento == null ? "neutro" : m.insiderMovimiento < -5 ? "atencion" : m.insiderMovimiento > 5 ? "bueno" : "neutro"
    );
  }
  add(
    "posicionamiento",
    "Institucionales",
    `${pct(m.institucionalTenencia)} · ${pctSigno(m.institucionalMovimiento)}`,
    m.institucionalTenencia != null && m.institucionalTenencia > 70
      ? "papel de manos institucionales: se mueve con los flujos de los grandes"
      : "",
    "neutro",
    m.institucionalTenencia != null
  );

  // ── Tape
  if (m.desdeMaximo52 != null) {
    add(
      "tape",
      "Desde el máximo de 52 semanas",
      pctSigno(m.desdeMaximo52),
      m.minimo52 != null && m.desdeMinimo52 != null
        ? `y ${pctSigno(m.desdeMinimo52)} sobre el mínimo (${usd(m.minimo52)}–${usd(m.maximo52)})`
        : "",
      m.desdeMaximo52 < -25 ? "atencion" : m.desdeMaximo52 > -5 ? "bueno" : "neutro"
    );
  }
  const medias = [m.sma20, m.sma50, m.sma200].filter((x): x is number => x != null);
  if (medias.length === 3) {
    const arriba = medias.filter((x) => x > 0).length;
    add(
      "tape",
      "Contra las medias 20/50/200",
      `${pctSigno(m.sma20, 0)} · ${pctSigno(m.sma50, 0)} · ${pctSigno(m.sma200, 0)}`,
      arriba === 3
        ? "arriba de las tres: tendencia intacta"
        : arriba === 0
          ? "abajo de las tres: tendencia rota"
          : "medias cruzadas: el mercado no definió",
      arriba === 3 ? "bueno" : arriba === 0 ? "malo" : "neutro"
    );
  }
  if (m.rsi != null) {
    add(
      "tape",
      "RSI (14)",
      num(m.rsi, 0),
      m.rsi > 70 ? "sobrecomprada" : m.rsi < 30 ? "sobrevendida" : "ni sobrecomprada ni sobrevendida",
      m.rsi > 70 || m.rsi < 30 ? "atencion" : "neutro"
    );
  }
  add(
    "tape",
    "Año / YTD",
    `${pctSigno(m.perfAño, 0)} · ${pctSigno(m.perfYtd, 0)}`,
    m.beta != null ? `beta ${num(m.beta, 2)}` : "",
    m.perfAño == null ? "neutro" : m.perfAño > 0 ? "bueno" : "malo",
    m.perfAño != null
  );

  // ── Consenso
  if (m.recomendacion != null) {
    add(
      "consenso",
      "Recomendación",
      `${num(m.recomendacion, 2)} · ${labelRecomendacion(m.recomendacion)}`,
      "1 es compra fuerte, 5 es venta",
      m.recomendacion <= 2 ? "bueno" : m.recomendacion >= 3.5 ? "malo" : "neutro"
    );
  }
  if (m.precioObjetivo != null) {
    const up = ctx.precio ? (m.precioObjetivo / ctx.precio - 1) * 100 : null;
    add(
      "consenso",
      "Precio objetivo",
      usd(m.precioObjetivo),
      up == null ? "" : `${pctSigno(up, 0)} contra el precio de hoy`,
      up == null ? "neutro" : up > 15 ? "bueno" : up < 0 ? "malo" : "neutro"
    );
  }
  if (m.sorpresaEps != null) {
    add(
      "consenso",
      "Último balance",
      `${pctSigno(m.sorpresaEps)} en ganancia · ${pctSigno(m.sorpresaVentas)} en ventas`,
      m.sorpresaEps < -5
        ? "le erró al consenso para abajo"
        : m.sorpresaEps > 5
          ? "le ganó al consenso"
          : "en línea con lo esperado",
      m.sorpresaEps < -5 ? "malo" : m.sorpresaEps > 5 ? "bueno" : "neutro"
    );
  }

  return s;
}

// ─── Tensiones: los cruces que son la noticia ────────────────────────────────

function tensiones(m: MetricasFinviz, ctx: ContextoLectura): Tension[] {
  const t: Tension[] = [];

  // El cruce que ordenó el módulo: vende más y gana menos.
  if (m.ventasTtm != null && m.epsTtm != null && m.ventasTtm >= 10 && m.epsTtm <= 0) {
    t.push({
      titulo: "Vende más y gana menos",
      detalle: `Las ventas crecen ${pctSigno(m.ventasTtm)} interanual y la ganancia por acción cae ${pct(
        Math.abs(m.epsTtm)
      )}. La plata entra: se está yendo en gasto o en inversión. Antes de leerlo como deterioro hay que ver en qué${
        m.margenOperativo != null ? ` —el margen operativo está en ${pct(m.margenOperativo)}—` : ""
      }.`,
      tono: "atencion",
      peso: 3,
    });
  }

  // Barata por EBITDA, cara por caja: la firma del capex. No aplica a un banco,
  // donde ni el EBITDA ni la caja libre significan lo que significan afuera.
  if (
    !esApalancadaPorDiseño(ctx.sector) &&
    m.evEbitda != null &&
    m.precioFcf != null &&
    m.evEbitda <= 15 &&
    m.precioFcf >= 30
  ) {
    t.push({
      titulo: "Barata por EBITDA, cara por caja",
      detalle: `Cotiza a ${veces(m.evEbitda)} EBITDA —barato— pero a ${veces(
        m.precioFcf
      )} la caja libre. La diferencia entre los dos múltiplos es exactamente el capex: el resultado operativo no está llegando al bolsillo del accionista.`,
      tono: "atencion",
      peso: 3,
    });
  }

  // Corrigió sin que el negocio se frene.
  if (
    m.desdeMaximo52 != null &&
    m.desdeMaximo52 <= -20 &&
    m.ventasTtm != null &&
    m.ventasTtm > 5 &&
    m.peg != null &&
    m.peg <= 1.2
  ) {
    t.push({
      titulo: "Corrigió sin que el negocio se frene",
      detalle: `Está ${pct(Math.abs(m.desdeMaximo52))} abajo del máximo de 52 semanas mientras las ventas crecen ${pctSigno(
        m.ventasTtm
      )} y el PEG quedó en ${num(m.peg, 2)}. O el mercado está descontando algo que todavía no está en los números, o es la oportunidad. La ficha existe para contestar cuál de las dos.`,
      tono: "bueno",
      peso: 3,
    });
  }

  // La caída tiene apuesta en contra.
  if (m.desdeMaximo52 != null && m.desdeMaximo52 <= -20 && m.shortFloat != null && m.shortFloat >= 8) {
    t.push({
      titulo: "La caída tiene apuesta en contra",
      detalle: `Además de estar ${pct(Math.abs(m.desdeMaximo52))} abajo del máximo, hay ${pct(
        m.shortFloat
      )} del float vendido en corto${
        m.shortRatio != null ? ` (${num(m.shortRatio)} días de volumen para recomprarlo)` : ""
      }. No es sólo desánimo: hay dinero puesto a que siga bajando.`,
      tono: "malo",
      peso: 3,
    });
  }

  // El precio ya tiene puesto el escenario bueno.
  if (m.peg != null && m.peg >= 2.5 && m.epsProximos5 != null) {
    t.push({
      titulo: "El precio ya tiene puesto el escenario bueno",
      detalle: `PEG ${num(m.peg, 2)}: paga ${veces(
        m.per
      )} ganancias para un crecimiento esperado de ${pct(m.epsProximos5)} anual. No hace falta que la empresa falle para perder plata; alcanza con que cumpla.`,
      tono: "atencion",
      peso: 2,
    });
  }

  // El consenso no se movió con la caída.
  if (
    m.recomendacion != null &&
    m.recomendacion <= 2 &&
    m.desdeMaximo52 != null &&
    m.desdeMaximo52 <= -15
  ) {
    t.push({
      titulo: "El consenso sigue comprando después de la caída",
      detalle: `Recomendación ${num(m.recomendacion, 2)} (${labelRecomendacion(
        m.recomendacion
      )}) con el papel ${pct(Math.abs(m.desdeMaximo52))} abajo del máximo${
        m.precioObjetivo != null && ctx.precio
          ? ` y objetivo en ${usd(m.precioObjetivo)}, ${pctSigno((m.precioObjetivo / ctx.precio - 1) * 100, 0)} arriba`
          : ""
      }. O los analistas tienen razón, o todavía no bajaron los números.`,
      tono: "neutro",
      peso: 2,
    });
  }

  // Los de adentro vendieron.
  if (m.insiderMovimiento != null && m.insiderMovimiento <= -5) {
    t.push({
      titulo: "Los de adentro vendieron",
      detalle: `La tenencia de insiders bajó ${pct(
        Math.abs(m.insiderMovimiento)
      )} en el último trimestre. Puede ser un plan de venta programado o puede no serlo: es de las pocas cosas que conviene mirar en la fuente antes de concluir.`,
      tono: "atencion",
      peso: 2,
    });
  }

  // La estructura de capital manda. Se saltea donde el apalancamiento es el
  // negocio: en un banco, deuda/patrimonio 3 no es un hallazgo.
  if (
    !esApalancadaPorDiseño(ctx.sector) &&
    ((m.deudaPatrimonio != null && m.deudaPatrimonio >= 2) ||
      (m.liquidezSeca != null && m.liquidezSeca < 1))
  ) {
    t.push({
      titulo: "La deuda manda sobre el resultado",
      detalle: `Deuda sobre patrimonio ${num(m.deudaPatrimonio, 2)}${
        m.liquidezSeca != null ? ` y liquidez seca ${num(m.liquidezSeca, 2)}` : ""
      }. Con este apalancamiento, la tasa y el perfil de vencimientos pesan más en el resultado que el negocio operativo: la sección 6 de la ficha es la que decide la tesis.`,
      tono: "atencion",
      peso: 2,
    });
  }

  // Falló el último balance.
  if (m.sorpresaEps != null && m.sorpresaEps <= -5) {
    t.push({
      titulo: "Le erró al consenso en el último balance",
      detalle: `La ganancia salió ${pct(Math.abs(m.sorpresaEps))} por debajo de lo esperado${
        m.sorpresaVentas != null && m.sorpresaVentas > 0
          ? `, con ventas ${pctSigno(m.sorpresaVentas)} por encima`
          : ""
      }. Vendió lo que se esperaba y ganó menos: el problema está en los costos, no en la demanda.`,
      tono: "malo",
      peso: 2,
    });
  }

  // Negocio de calidad, para tenerlo a la vista cuando todo lo demás es ruido.
  if (m.roic != null && m.roic >= 15 && m.margenOperativo != null && m.margenOperativo >= 20) {
    t.push({
      titulo: "El negocio rinde sobre el capital",
      detalle: `ROIC ${pct(m.roic)} con margen operativo ${pct(
        m.margenOperativo
      )}${ctx.wacc != null ? ` contra un WACC estimado de ${pct(ctx.wacc)}` : ""}. Sea cual sea el precio, el negocio de abajo crea valor: la discusión es cuánto pagar por él, no si sirve.`,
      tono: "bueno",
      peso: 1,
    });
  }

  return t.sort((a, b) => b.peso - a.peso);
}

// ─── Veredicto ───────────────────────────────────────────────────────────────

function veredicto(m: MetricasFinviz, ctx: ContextoLectura, tens: Tension[]): string[] {
  const frases: string[] = [];

  // 1. El encuadre: qué se paga contra qué se espera.
  if (m.perForward != null && m.epsProximos5 != null) {
    const juicio =
      m.peg == null
        ? ""
        : m.peg < 1
          ? "menos de una vez su crecimiento"
          : m.peg <= 2
            ? "en línea con su crecimiento"
            : "por encima de su crecimiento";
    frases.push(
      `${ctx.ticker} cotiza a ${veces(m.perForward)} las ganancias del año que viene contra un crecimiento esperado de ${pct(
        m.epsProximos5
      )} anual${m.peg != null ? ` (PEG ${num(m.peg, 2)}): paga ${juicio}` : ""}.`
    );
  } else if (m.per != null) {
    frases.push(`${ctx.ticker} cotiza a ${veces(m.per)} ganancias.`);
  }

  // 2. Las dos tensiones más fuertes: eso es lo que está pasando.
  for (const t of tens.slice(0, 2)) frases.push(t.detalle);

  // 3. Dónde está parado el precio.
  const medias = [m.sma20, m.sma50, m.sma200].filter((x): x is number => x != null);
  if (m.desdeMaximo52 != null && medias.length === 3) {
    const arriba = medias.filter((x) => x > 0).length;
    frases.push(
      `El precio está ${pct(Math.abs(m.desdeMaximo52))} ${
        m.desdeMaximo52 < 0 ? "abajo" : "arriba"
      } del máximo de 52 semanas y ${
        arriba === 3
          ? "arriba de las medias de 20, 50 y 200: la tendencia está intacta"
          : arriba === 0
            ? "abajo de las medias de 20, 50 y 200: la tendencia está rota"
            : "con las medias cruzadas: el mercado todavía no definió"
      }.`
    );
  }

  // 4. Qué dice el consenso, si ninguna tensión lo dijo ya.
  const yaLoDijo = tens.some((t) => t.titulo === "El consenso sigue comprando después de la caída");
  if (!yaLoDijo && m.recomendacion != null) {
    const up = m.precioObjetivo != null && ctx.precio ? (m.precioObjetivo / ctx.precio - 1) * 100 : null;
    frases.push(
      `El consenso está en ${labelRecomendacion(m.recomendacion)} (${num(m.recomendacion, 2)})${
        up != null ? ` con objetivo en ${usd(m.precioObjetivo)}, ${pctSigno(up, 0)} contra el precio de hoy` : ""
      }.`
    );
  }

  return frases;
}

function deQueDepende(m: MetricasFinviz, ctx: ContextoLectura, tens: Tension[]): string[] {
  const puntos: string[] = [];
  const tiene = (titulo: string) => tens.some((t) => t.titulo === titulo);

  if (tiene("Vende más y gana menos") || tiene("Barata por EBITDA, cara por caja")) {
    puntos.push(
      "Que el gasto que hoy se come la ganancia tenga retorno. Es una pregunta de dos o tres trimestres: seguir el margen operativo y la caja libre, no el titular del balance."
    );
  }
  if (tiene("Corrigió sin que el negocio se frene")) {
    puntos.push(
      "Que la desaceleración no llegue a las ventas. Mientras crezcan, la caída es de múltiplo; si se frenan, era el mercado el que tenía razón."
    );
  }
  if (tiene("El precio ya tiene puesto el escenario bueno")) {
    puntos.push(
      "Que el crecimiento esperado se cumpla sin sorpresas. A este múltiplo, cumplir no alcanza para ganar: hay que superar."
    );
  }
  if (tiene("La deuda manda sobre el resultado")) {
    puntos.push(
      "El perfil de vencimientos de los próximos doce meses y si el flujo propio los cubre. Cargar la sección 6 antes de escribir la tesis."
    );
  }
  if (tiene("La caída tiene apuesta en contra")) {
    puntos.push(
      "Qué sabe el que está short. Si no se puede contestar con los números de la ficha, la posición se toma más chica."
    );
  }

  const dias = diasHasta(ctx.proximoBalance);
  if (dias != null && dias >= 0) {
    puntos.push(
      dias === 0
        ? "El balance es hoy: cualquier lectura de este panel puede quedar vieja en unas horas."
        : `El próximo balance, en ${dias} ${dias === 1 ? "día" : "días"}. Es el evento que confirma o rompe todo lo anterior.`
    );
  }

  return puntos;
}

/** La lectura completa de un papel. */
export function radiografiar(m: MetricasFinviz, ctx: ContextoLectura): Radiografia {
  const tens = tensiones(m, ctx);
  return {
    señales: señales(m, ctx),
    tensiones: tens,
    veredicto: veredicto(m, ctx, tens),
    deQueDepende: deQueDepende(m, ctx, tens),
  };
}
