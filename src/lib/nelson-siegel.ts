/**
 * Nelson-Siegel: la curva que resume una nube de bonos.
 *
 * Un panel de bonos son treinta puntos sueltos. Nelson-Siegel los resume en una
 * función de tres parámetros que tienen lectura económica directa:
 *
 *   y(t) = β0 + β1·f1(t) + β2·f2(t)
 *
 *   β0  el nivel al que tiende la curva en el infinito
 *   β1  la pendiente, con signo cambiado: β0+β1 es la tasa instantánea
 *   β2  la joroba del medio, positiva si el tramo intermedio paga de más
 *   λ   dónde cae esa joroba
 *
 * Sirve para dos cosas. La primera es tener una curva y no una línea quebrada:
 * unir los puntos con segmentos sugiere que entre dos bonos la tasa hace exacta
 * mente eso, y no hay ninguna razón para creerlo. La segunda, más útil: el
 * residuo. Un bono que rinde 80 pb más que la curva que forman sus pares o está
 * barato o tiene algo que los demás no tienen, y en cualquier caso es la
 * pregunta que vale la pena hacerse.
 *
 * ── Sobre el eje ────────────────────────────────────────────────────────────
 *
 * El ajuste se hace contra **duration**, no contra el plazo al vencimiento, que
 * es como se mira una curva de bonos que amortizan. La formulación original de
 * Nelson y Siegel describe tasas spot contra plazo; acá se la usa como lo que
 * es en la práctica del mercado local: la familia de curvas suaves con la que
 * se resume una nube de TIRes. No es una curva cero cupón bootstrapeada, y no
 * debería leerse como tal.
 *
 * ── Sobre el ajuste ─────────────────────────────────────────────────────────
 *
 * Fijado λ, el modelo es lineal en β: se resuelve por mínimos cuadrados exacto.
 * Así que en vez de tirarle un optimizador no lineal a los cuatro parámetros
 * —que con pocos puntos se cuelga en mínimos locales— se barre λ en una grilla
 * y para cada λ se resuelven los β de una. Es la receta estándar y no puede
 * divergir: el peor caso es que la grilla sea gruesa.
 *
 * ── Por qué los β no se muestran en pantalla ────────────────────────────────
 *
 * Porque con estos bonos no significan lo que parecen. β0 es la tasa a plazo
 * infinito, y los soberanos van de 1,5 a 5,9 años de duration: no hay dato que
 * ancle esa asíntota. Dejando λ libre, el ajuste elegía λ≈12 años y salía
 * β0=-258% con β2=+345% —dos números enormes que se cancelan— con un error de
 * 13 pb. La curva estaba perfecta y los parámetros eran ficción.
 *
 * De ahí las dos decisiones de acá. Una: λ se acota a la mitad del plazo más
 * largo, que es la condición para que los factores alcancen a decaer dentro del
 * rango con datos. Cuesta unos pocos puntos básicos de ajuste —13 pb pasaron a
 * 17— y a cambio los β dejan de explotar. Dos: lo que se publica hacia afuera
 * no son los β sino la curva evaluada en plazos que existen, más la pendiente
 * entre los dos extremos observados. Eso es lo que el ajuste sostiene de verdad.
 */

export interface PuntoAjuste {
  ticker: string;
  /** Eje X del ajuste, en años. */
  duration: number;
  /** TIR en %. */
  tir: number;
}

export interface Residuo {
  ticker: string;
  /** TIR observada menos la de la curva, en puntos básicos. Positivo = rinde más. */
  pb: number;
}

/** La curva evaluada en un plazo redondo que cae dentro del rango con datos. */
export interface PlazoClave {
  /** En años. */
  plazo: number;
  /** TIR ajustada a ese plazo, en %. */
  tir: number;
}

export interface AjusteNS {
  /** Crudos, para quien quiera mirarlos: no son para mostrar. Ver el encabezado. */
  beta0: number;
  beta1: number;
  beta2: number;
  lambda: number;
  /** La curva ajustada: duration en años → TIR en %. */
  tasa: (t: number) => number;
  /** Puntos para dibujar la línea. */
  curva: { duration: number; tir: number }[];
  /** Entre qué durations hay bonos: fuera de ahí la curva es extrapolación. */
  rango: { min: number; max: number };
  /** La curva en 1, 2, 3, 5 y 10 años, salteando los que no tienen datos cerca. */
  plazosClave: PlazoClave[];
  /** Cuánto sube la curva entre el bono más corto y el más largo, en pb. */
  pendientePb: number;
  /** Cuánto de la dispersión explica la curva, 0 a 1. */
  r2: number;
  /** El mismo R² descontando el premio por tener parámetros. Es el que se muestra. */
  r2Ajustado: number;
  /** false cuando hubo tan pocos bonos que la curvatura no se estimó. */
  conJoroba: boolean;
  /** Error típico del ajuste, en puntos básicos. */
  rmsePb: number;
  /** Cuánto se aparta cada bono de la curva. Ordenados de más barato a más caro. */
  residuos: Residuo[];
  n: number;
}

/**
 * Los dos factores de Nelson-Siegel.
 *
 * En t→0 el primero tiende a 1 y el segundo a 0; se resuelve el límite a mano
 * porque la fórmula divide por t y una Lecer a diez días tiene duration 0,03.
 */
function factores(t: number, lambda: number): [number, number] {
  const x = t / lambda;
  if (x < 1e-6) return [1, 0];
  const e = Math.exp(-x);
  const f1 = (1 - e) / x;
  return [f1, f1 - e];
}

/** Sistema k×k por eliminación gaussiana con pivoteo. `null` si es singular. */
function resolver(a: number[][], b: number[]): number[] | null {
  const k = b.length;
  const m = a.map((fila, i) => [...fila, b[i]]);

  for (let col = 0; col < k; col++) {
    let mejor = col;
    for (let f = col + 1; f < k; f++) if (Math.abs(m[f][col]) > Math.abs(m[mejor][col])) mejor = f;
    if (Math.abs(m[mejor][col]) < 1e-12) return null;
    [m[col], m[mejor]] = [m[mejor], m[col]];

    for (let f = 0; f < k; f++) {
      if (f === col) continue;
      const factor = m[f][col] / m[col][col];
      for (let c = col; c <= k; c++) m[f][c] -= factor * m[col][c];
    }
  }

  // Tras la eliminación la matriz es diagonal: cada incógnita sale de su fila
  return m.map((fila, i) => fila[k] / fila[i]);
}

/**
 * Mínimos cuadrados de los β con λ fijo.
 *
 * Con `joroba` en false se estiman sólo el nivel y la pendiente, y β2 queda en
 * cero: es la versión de dos factores, para cuando no hay bonos suficientes
 * como para estimar también la curvatura.
 */
function betasPara(puntos: PuntoAjuste[], lambda: number, joroba: boolean): [number, number, number] | null {
  const k = joroba ? 3 : 2;
  // Matriz normal XᵀX y vector Xᵀy, con la columna de unos del intercepto
  const xtx = Array.from({ length: k }, () => new Array(k).fill(0));
  const xty = new Array(k).fill(0);

  for (const p of puntos) {
    const [f1, f2] = factores(p.duration, lambda);
    const x = [1, f1, f2].slice(0, k);
    for (let i = 0; i < k; i++) {
      xty[i] += x[i] * p.tir;
      for (let j = 0; j < k; j++) xtx[i][j] += x[i] * x[j];
    }
  }

  const sol = resolver(xtx, xty);
  if (!sol) return null;
  return [sol[0], sol[1], joroba ? sol[2] : 0];
}

/**
 * Con menos de esto no se ajusta nada.
 *
 * Tres puntos y tres parámetros pasan por los tres exactamente: el ajuste daría
 * R²=1 y no diría nada.
 */
const MINIMO_PUNTOS = 4;

/**
 * Y con menos de esto no se estima la joroba.
 *
 * Contando λ, la versión completa tiene cuatro parámetros: con cuatro bonos no
 * queda ningún grado de libertad y la curva pasa por todos los puntos diga lo
 * que diga el mercado. Abajo del umbral se ajusta la versión de dos factores
 * —nivel y pendiente, sin curvatura—, que es lo que se hace con curvas ralas.
 *
 * Con cinco queda un grado de libertad, que es poco pero no es nada: quien
 * lee el ajuste tiene el R² ajustado al lado, que descuenta exactamente eso.
 */
const MINIMO_PARA_JOROBA = 5;

/**
 * Ajusta Nelson-Siegel a una nube de bonos.
 *
 * Devuelve `null` si no hay puntos suficientes o si están todos apilados en la
 * misma duration —dos casos donde la curva sería una invención—.
 */
export function ajustarNelsonSiegel(entrada: PuntoAjuste[]): AjusteNS | null {
  const puntos = entrada.filter(
    (p) => Number.isFinite(p.duration) && Number.isFinite(p.tir) && p.duration > 0
  );
  if (puntos.length < MINIMO_PUNTOS) return null;

  const durations = puntos.map((p) => p.duration);
  const dMin = Math.min(...durations);
  const dMax = Math.max(...durations);
  if (dMax - dMin < 0.25) return null;

  // λ se barre en escala logarítmica hasta la mitad del plazo más largo: más
  // allá los dos factores no llegan a decaer dentro del rango con datos y los β
  // se van a cualquier lado sin que el ajuste empeore (ver el encabezado)
  const lo = Math.log(0.15);
  const hi = Math.log(Math.max(dMax / 2, 0.3));
  const PASOS = 160;

  const joroba = puntos.length >= MINIMO_PARA_JOROBA;
  let mejor: { lambda: number; betas: [number, number, number]; sse: number } | null = null;

  for (let i = 0; i <= PASOS; i++) {
    const lambda = Math.exp(lo + ((hi - lo) * i) / PASOS);
    const betas = betasPara(puntos, lambda, joroba);
    if (!betas) continue;

    let sse = 0;
    for (const p of puntos) {
      const [f1, f2] = factores(p.duration, lambda);
      const e = p.tir - (betas[0] + betas[1] * f1 + betas[2] * f2);
      sse += e * e;
    }
    if (!Number.isFinite(sse)) continue;
    if (!mejor || sse < mejor.sse) mejor = { lambda, betas, sse };
  }

  if (!mejor) return null;

  const [beta0, beta1, beta2] = mejor.betas;
  const tasa = (t: number) => {
    const [f1, f2] = factores(t, mejor.lambda);
    return beta0 + beta1 * f1 + beta2 * f2;
  };

  const media = puntos.reduce((s, p) => s + p.tir, 0) / puntos.length;
  const sst = puntos.reduce((s, p) => s + (p.tir - media) ** 2, 0);
  const r2 = sst > 0 ? 1 - mejor.sse / sst : 0;

  // R² ajustado, que descuenta lo que explica el modelo sólo por tener
  // parámetros. Con cinco bonos y cuatro parámetros —los tres β más λ— el R²
  // crudo da 0,98 casi sin importar dónde caigan los puntos; el ajustado, 0,92,
  // que es la lectura honesta de un ajuste con un grado de libertad.
  const parametros = (joroba ? 3 : 2) + 1;
  const gl = puntos.length - parametros;
  const r2Ajustado = gl > 0 ? 1 - (1 - r2) * ((puntos.length - 1) / gl) : r2;
  const rmsePb = Math.sqrt(mejor.sse / puntos.length) * 100;

  const residuos = puntos
    .map((p) => ({ ticker: p.ticker, pb: (p.tir - tasa(p.duration)) * 100 }))
    .sort((a, b) => b.pb - a.pb);

  // La línea va del primer bono al último y ni un año más: afuera de ese rango
  // el modelo no tiene con qué, y una línea que sigue de largo invita a leer un
  // rendimiento donde no hay ningún bono que lo pague
  const PUNTOS_LINEA = 80;
  const curva = Array.from({ length: PUNTOS_LINEA + 1 }, (_, i) => {
    const duration = dMin + ((dMax - dMin) * i) / PUNTOS_LINEA;
    return { duration, tir: tasa(duration) };
  });

  // Sólo los plazos redondos que caen dentro de la nube: uno afuera sería la
  // curva inventando dónde no hay bonos
  const plazosClave = [1, 2, 3, 5, 10]
    .filter((t) => t >= dMin && t <= dMax)
    .map((plazo) => ({ plazo, tir: tasa(plazo) }));

  return {
    beta0, beta1, beta2,
    lambda: mejor.lambda,
    tasa,
    curva,
    rango: { min: dMin, max: dMax },
    plazosClave,
    pendientePb: (tasa(dMax) - tasa(dMin)) * 100,
    r2,
    r2Ajustado,
    conJoroba: joroba,
    rmsePb,
    residuos,
    n: puntos.length,
  };
}
