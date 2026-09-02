/**
 * Valuación por flujos: el DCF y, sobre todo, el DCF inverso.
 *
 * La ficha de análisis pide escribir a mano "qué descuenta el precio hoy". Es
 * la pregunta más honesta de un análisis y también la más mecánica de
 * contestar: si están el flujo de caja libre, la tasa de descuento, la deuda
 * neta y las acciones, el crecimiento implícito es el único número que hace
 * cerrar la ecuación. La regla del proyecto es que lo que se puede calcular no
 * se pregunta, así que se calcula.
 *
 * ## Por qué inverso y no directo
 *
 * Un DCF directo devuelve "vale US$182,40" con cuatro supuestos adentro que
 * nadie ve, y esa falsa precisión es peor que no tener nada: mover el
 * crecimiento dos puntos cambia el valor un 30%. El inverso da vuelta la
 * pregunta y no pide creer nada: **el precio de hoy exige que la caja crezca
 * X% al año durante diez años**. Eso sí se puede juzgar — contra lo que la
 * empresa viene creciendo, contra lo que espera el consenso, contra lo que
 * crece la industria.
 *
 * ## El modelo, con sus supuestos a la vista
 *
 *  - **Diez años explícitos** con crecimiento constante, y después una
 *    perpetuidad de Gordon al crecimiento terminal. Constante y no en descenso
 *    a propósito: "crece X% por diez años" se puede contrastar con la realidad;
 *    "crece a una tasa que decae linealmente" no se puede contrastar con nada.
 *  - **Crecimiento terminal 2,5%**, el orden de la inflación de largo de EE.UU.
 *    Una empresa no puede crecer para siempre más rápido que la economía.
 *  - **Se descuenta FCF al WACC** y se llega al enterprise value; de ahí se
 *    resta la deuda neta para el equity. Es el estándar; la alternativa
 *    (descontar flujo al accionista al costo del capital propio) necesita
 *    proyectar la estructura de financiamiento.
 *  - **El FCF de partida es el de los últimos doce meses.** Si ese año fue
 *    atípico —un capex grande, un juicio pagado—, todo el ejercicio se
 *    contamina. Por eso se informa también el promedio de los ejercicios
 *    cerrados: cuando los dos números difieren mucho, el punto de partida es
 *    una decisión y no un dato.
 *
 * Nada de esto sirve con FCF negativo. Una empresa que quema caja puede valer
 * mucho, pero no por este camino: hay que proyectar cuándo deja de quemarla, y
 * eso es un modelo, no una cuenta.
 */

/** Crecimiento a perpetuidad, en %. La inflación de largo de EE.UU. */
export const G_TERMINAL = 2.5;

/** Años de proyección explícita antes de la perpetuidad. */
export const HORIZONTE = 10;

export interface EntradaDcf {
  /** Flujo de caja libre de partida, en USD. */
  fcf: number;
  /** Tasa de descuento, en %. */
  wacc: number;
  /** Crecimiento a perpetuidad, en %. */
  gTerminal: number;
  /** Deuda neta a restar del enterprise value, en USD. Negativa si hay caja neta. */
  deudaNeta: number;
  /** Acciones en circulación. */
  acciones: number;
  años?: number;
}

/**
 * Valor por acción si la caja crece `g` durante el horizonte y después al
 * terminal. Null cuando el modelo no aplica: sin FCF positivo no hay nada que
 * descontar, y con una tasa que no supera al crecimiento terminal la
 * perpetuidad diverge (el valor da infinito, que no es un resultado).
 */
export function valorPorAccion(e: EntradaDcf, g: number): number | null {
  const { fcf, wacc, gTerminal, deudaNeta, acciones, años = HORIZONTE } = e;
  if (!(fcf > 0) || !(acciones > 0)) return null;
  if (!(wacc > gTerminal + 0.25)) return null;

  const r = wacc / 100;
  const tasa = g / 100;
  const terminal = gTerminal / 100;

  let vp = 0;
  let flujo = fcf;
  for (let t = 1; t <= años; t++) {
    flujo *= 1 + tasa;
    vp += flujo / (1 + r) ** t;
  }

  // Gordon sobre el flujo del último año explícito, traído a hoy.
  const valorTerminal = (flujo * (1 + terminal)) / (r - terminal);
  const ev = vp + valorTerminal / (1 + r) ** años;

  return (ev - deudaNeta) / acciones;
}

/**
 * El crecimiento que hace que el modelo dé exactamente el precio de mercado.
 *
 * El valor es monótono creciente en `g`, así que se resuelve por bisección —60
 * pasos, precisión de sobra— entre una caída del 30% anual y un crecimiento del
 * 100%. Fuera de ese rango el número dejó de significar algo: si el precio
 * exige 120% anual por diez años, la conclusión práctica ("el precio descuenta
 * algo que no tiene antecedente") es la misma que con 100.
 */
export function crecimientoImplicito(e: EntradaDcf, precio: number): number | null {
  if (!(precio > 0)) return null;

  const MIN = -30;
  const MAX = 100;
  const vMin = valorPorAccion(e, MIN);
  const vMax = valorPorAccion(e, MAX);
  if (vMin == null || vMax == null) return null;
  if (precio < vMin || precio > vMax) return null;

  let bajo = MIN;
  let alto = MAX;
  for (let i = 0; i < 60; i++) {
    const medio = (bajo + alto) / 2;
    const v = valorPorAccion(e, medio);
    if (v == null) return null;
    if (v < precio) bajo = medio;
    else alto = medio;
  }
  return (bajo + alto) / 2;
}

// ─── Lo que consume la pantalla ─────────────────────────────────────────────

export interface Escenario {
  nombre: string;
  /** De dónde sale el crecimiento: se declara, no se esconde. */
  fuente: string;
  /** El crecimiento con el que se valuó, ya recortado si hacía falta. */
  crecimiento: number;
  /** El que traía la referencia, cuando hubo que recortarlo. */
  original: number | null;
  valor: number | null;
  /** Contra el precio de hoy, en %. */
  potencial: number | null;
}

/**
 * Techo del crecimiento de un escenario, en %.
 *
 * El consenso de Finviz proyecta EPS a cinco años y el modelo pide diez: cuando
 * ese número es 60% —NVIDIA, mediados de 2026— extenderlo una década da un
 * valor por acción seis veces el precio, y eso no es un escenario alcista, es
 * una cuenta que se rompió. Sostener 25% anual de caja libre por diez años ya
 * lo logra un puñado de empresas por generación; arriba de ahí el modelo deja
 * de informar. Cuando se recorta, se muestra el original al lado.
 */
export const TECHO_ESCENARIO = 25;

export interface Valuacion {
  /** Qué crecimiento anual de FCF hay que creer para pagar el precio de hoy. */
  implicito: number | null;
  /**
   * Por qué no se pudo calcular, cuando no se pudo. Se muestra en pantalla: un
   * panel vacío no distingue "falta un dato" de "la empresa quema caja".
   */
  problema: string | null;
  entrada: EntradaDcf;
  precio: number;
  /** FCF por acción de partida, para leer el múltiplo implícito. */
  fcfPorAccion: number;
  /** Rendimiento de la caja libre al precio de hoy, en %. */
  fcfYield: number;
  /** Promedio de FCF de los ejercicios cerrados: el control del punto de partida. */
  fcfPromedio: number | null;
  escenarios: Escenario[];
  /** Valor por acción para cada cruce de crecimiento (filas) y WACC (columnas). */
  matriz: { crecimientos: number[]; waccs: number[]; valores: (number | null)[][] };
}

/** Un crecimiento candidato para los escenarios, con su procedencia. */
export interface Referencia {
  nombre: string;
  fuente: string;
  crecimiento: number | null;
}

/**
 * Arma la valuación completa de un papel.
 *
 * Los escenarios no los inventa el modelo: son crecimientos que vienen de algún
 * lado —lo que la empresa viene haciendo, lo que espera el consenso— y se
 * muestran con la fuente al lado. El único que sale del modelo es el implícito,
 * que es justamente el que no supone nada.
 */
export function armarValuacion({
  fcf,
  fcfPromedio = null,
  wacc,
  deudaNeta,
  acciones,
  precio,
  referencias = [],
  gTerminal = G_TERMINAL,
  motivoNoAplica = null,
}: {
  fcf: number | null;
  fcfPromedio?: number | null;
  wacc: number | null;
  deudaNeta: number | null;
  acciones: number | null;
  precio: number | null;
  referencias?: Referencia[];
  gTerminal?: number;
  /** Cuando el método no corresponde al negocio, más allá de los números. */
  motivoNoAplica?: string | null;
}): Valuacion | null {
  if (precio == null || !(precio > 0) || acciones == null || !(acciones > 0)) return null;
  if (fcf == null || wacc == null) return null;

  const entrada: EntradaDcf = {
    fcf,
    wacc,
    gTerminal,
    deudaNeta: deudaNeta ?? 0,
    acciones,
    años: HORIZONTE,
  };

  const problema =
    motivoNoAplica ??
    (fcf <= 0
      ? "La empresa no genera caja libre en los últimos doce meses: descontar flujos negativos no da un valor, da un número sin sentido. Acá hay que proyectar cuándo deja de quemar caja, que es un modelo y no una cuenta."
      : wacc <= gTerminal + 0.25
        ? `El WACC estimado (${wacc.toFixed(1)}%) no supera al crecimiento terminal (${gTerminal}%): la perpetuidad diverge y el modelo no cierra. Pasa con betas muy bajas y tasas largas planas.`
        : null);

  const implicito = problema ? null : crecimientoImplicito(entrada, precio);

  const potencialDe = (v: number | null) => (v == null ? null : (v / precio - 1) * 100);

  const candidatos: Referencia[] = [
    ...referencias,
    { nombre: "Sin crecimiento real", fuente: `sólo inflación de largo, ${gTerminal}%`, crecimiento: gTerminal },
  ];

  const escenarios: Escenario[] = candidatos
    .filter((c): c is Referencia & { crecimiento: number } => c.crecimiento != null)
    .map((c) => {
      const usado = Math.max(-30, Math.min(TECHO_ESCENARIO, c.crecimiento));
      const valor = problema ? null : valorPorAccion(entrada, usado);
      return {
        nombre: c.nombre,
        fuente: c.fuente,
        crecimiento: usado,
        original: usado === c.crecimiento ? null : c.crecimiento,
        valor,
        potencial: potencialDe(valor),
      };
    });

  // La matriz se centra en el crecimiento implícito cuando existe —así se ve de
  // un vistazo cuánto hay que equivocarse para que el precio deje de cerrar— y
  // en el del consenso cuando no.
  const centro = implicito ?? escenarios[0]?.crecimiento ?? 8;
  const paso = Math.max(2, Math.round(Math.abs(centro) / 4));
  const crecimientos = [-2, -1, 0, 1, 2].map((k) => Math.round((centro + k * paso) * 10) / 10);
  const waccs = [-2, -1, 0, 1, 2].map((k) => Math.round((wacc + k) * 10) / 10);

  return {
    implicito,
    problema,
    entrada,
    precio,
    fcfPorAccion: fcf / acciones,
    fcfYield: ((fcf / acciones) / precio) * 100,
    fcfPromedio,
    escenarios,
    matriz: {
      crecimientos,
      waccs,
      valores: crecimientos.map((g) =>
        waccs.map((w) => (problema ? null : valorPorAccion({ ...entrada, wacc: w }, g)))
      ),
    },
  };
}

// ─── La lectura ─────────────────────────────────────────────────────────────

/**
 * El crecimiento implícito contra los que vienen de algún lado.
 *
 * Es la única conclusión que el panel se permite, y es una comparación, no un
 * juicio: "el precio exige más de lo que la empresa hizo en cinco años" es un
 * hecho verificable. "Está cara" no lo es —puede estar exigiendo mucho porque
 * el mercado ve algo que la serie histórica no tiene— y esa parte la firma el
 * analista en la tesis.
 */
export function leerValuacion(v: Valuacion): string[] {
  if (v.problema) return [v.problema];
  if (v.implicito == null) {
    return [
      "El precio de hoy queda fuera del rango que el modelo puede resolver: ni con una caída del 30% anual ni con un crecimiento del 100% por diez años se llega a este valor. Suele pasar cuando el FCF de los últimos doce meses es una fracción mínima de la capitalización.",
    ];
  }

  const pct = (x: number) => `${x.toFixed(1).replace(".", ",")}%`;
  const out: string[] = [
    `Al precio de hoy, el mercado está pagando por una empresa cuya caja libre crece ${pct(
      v.implicito
    )} al año durante ${v.entrada.años ?? HORIZONTE} años y después acompaña a la inflación. Ese es el número a discutir: si se cree que va a crecer más, está barata; si menos, cara.`,
  ];

  for (const e of v.escenarios) {
    if (e.nombre === "Sin crecimiento real") continue;
    // La comparación va contra lo que la referencia realmente dice, no contra
    // el número recortado con el que se valuó: si el consenso proyecta 60%, lo
    // relevante es que el precio pide la mitad de eso.
    const referencia = e.original ?? e.crecimiento;

    // Una referencia por encima del techo no es una referencia: el consenso de
    // NVIDIA proyecta 64% anual y su propia caja libre viene creciendo al 186%.
    // Comparar el implícito contra eso da una frase aritméticamente correcta y
    // analíticamente vacía ("el precio pide 157 puntos menos por año").
    if (e.original != null) {
      out.push(
        `${e.nombre} da ${pct(referencia)} anual, que no es una referencia proyectable a diez años: sirve para saber de dónde viene, no para valuar. El escenario de la tabla usa el techo del modelo, ${pct(
          TECHO_ESCENARIO
        )}.`
      );
      continue;
    }

    const dif = v.implicito - referencia;
    if (Math.abs(dif) < 1.5) {
      out.push(`Es prácticamente lo mismo que ${e.nombre.toLowerCase()} (${pct(referencia)}): el precio está en línea con esa referencia.`);
    } else if (dif > 0) {
      out.push(
        `Son ${pct(dif)} más por año que ${e.nombre.toLowerCase()} (${pct(referencia)}): el precio ya descuenta una mejora sobre esa referencia.`
      );
    } else {
      out.push(
        `Son ${pct(-dif)} menos por año que ${e.nombre.toLowerCase()} (${pct(referencia)}): el precio no le está pidiendo tanto como esa referencia sugiere.`
      );
    }
  }

  if (v.implicito > 20) {
    out.push(
      "Ojo con el nivel: sostener más de 20% anual de crecimiento de caja durante diez años lo logra una minoría muy chica de empresas, y el precio lo está dando por hecho."
    );
  }

  if (v.fcfPromedio != null && v.entrada.fcf > 0) {
    const desvio = (v.entrada.fcf / v.fcfPromedio - 1) * 100;
    if (Math.abs(desvio) > 25) {
      out.push(
        `El punto de partida es discutible: la caja libre de los últimos doce meses está ${pct(
          Math.abs(desvio)
        )} ${desvio > 0 ? "por encima" : "por debajo"} del promedio de los ejercicios cerrados. Todo el ejercicio se apoya en ese número.`
      );
    }
  }

  return out;
}
