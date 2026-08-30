/**
 * La Fed, en vivo — tasa, expectativas, calendario, autoridades y novedades.
 *
 * Lo que un asesor tiene que poder contestar sin googlear: en cuánto está la
 * tasa, quién la decide, cuándo vuelven a reunirse y qué está descontando el
 * mercado para esa reunión.
 *
 * Fuentes, todas públicas y sin clave:
 *  - **FRED** (`@/lib/fred`) → nivel de tasa, EFFR, SOFR.
 *  - **Futuros de fondos federales (CME, vía Yahoo)** → el sendero implícito.
 *    Es la misma cuenta que hace el FedWatch de CME, que no tiene API abierta.
 *  - **federalreserve.gov** → calendario del FOMC, integrantes del Board y los
 *    RSS de discursos y comunicados.
 *
 * Todo con caché en memoria (patrón `equity.ts`): sin DB, así que anda igual en
 * el deploy efímero de Vercel.
 */

import YahooFinance from "yahoo-finance2";
import { fredVarias, memoFred, ultimo, type PuntoSerie } from "@/lib/fred";

const TIMEOUT_MS = 10_000;

async function getTexto(url: string): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
    // Sin User-Agent de navegador varios sitios de gobierno responden 403.
    headers: { "user-agent": "Mozilla/5.0 (compatible; dashboard-asesor/1.0)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.text();
}

const limpiar = (s: string) =>
  s
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

// ─── Nivel de tasa ───────────────────────────────────────────────────────────

export interface TasaFed {
  /** Piso del rango objetivo, en %. */
  rangoBajo: number;
  /** Techo del rango objetivo, en %. */
  rangoAlto: number;
  /** Effective Federal Funds Rate: la que de verdad se opera. */
  effr: number | null;
  /** SOFR: la tasa colateralizada que reemplazó a la LIBOR. */
  sofr: number | null;
  /** Fecha del dato del rango. */
  fecha: string;
}

export async function getTasaFed(): Promise<TasaFed | null> {
  const s = await fredVarias(["DFEDTARL", "DFEDTARU", "EFFR", "SOFR"]);

  const bajo = ultimo(s.get("DFEDTARL"));
  const alto = ultimo(s.get("DFEDTARU"));
  if (!bajo || !alto) return null;

  return {
    rangoBajo: bajo.valor,
    rangoAlto: alto.valor,
    effr: ultimo(s.get("EFFR"))?.valor ?? null,
    sofr: ultimo(s.get("SOFR"))?.valor ?? null,
    fecha: alto.fecha,
  };
}

// ─── Calendario del FOMC ─────────────────────────────────────────────────────

export interface ReunionFomc {
  /** Fecha del día del anuncio (el último día de la reunión), YYYY-MM-DD. */
  fecha: string;
  /** Primer día de la reunión: casi todas duran dos jornadas. */
  fechaInicio: string;
  /** Lleva proyecciones económicas (el "dot plot"). Son cuatro por año. */
  conProyecciones: boolean;
}

const MESES_EN = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** "Apr" o "April" → 1-12. */
function mesDeNombre(nombre: string): number | null {
  const n = nombre.trim().toLowerCase().slice(0, 3);
  const i = MESES_EN.findIndex((m) => m.startsWith(n));
  return i >= 0 ? i + 1 : null;
}

const iso = (a: number, m: number, d: number) =>
  `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * El calendario oficial, parseado del HTML de federalreserve.gov.
 *
 * La Fed publica las fechas con dos años de anticipación pero no las expone en
 * ningún feed ni API: la única fuente es esa página. El markup es estable y
 * semántico (`fomc-meeting__month` / `fomc-meeting__date`), así que el parseo se
 * apoya en las clases y no en la posición.
 *
 * Dos formas que hay que contemplar:
 *  - `March` + `17-18*` → reunión del 17 al 18, con proyecciones (el asterisco).
 *  - `Apr/May` + `30-1` → arranca el 30 de abril y termina el 1 de mayo. El día
 *    del anuncio es siempre el último, así que ahí cambia también el mes.
 */
export function getCalendarioFomc(): Promise<ReunionFomc[]> {
  return memoFred("fomc:calendario", 86_400, async () => {
    const html = await getTexto("https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm");

    // Cada panel del acordeón es un año; se corta ahí para saber a qué año
    // pertenece cada reunión (el bloque de la reunión no lo dice).
    const panels = [...html.matchAll(/>(\d{4}) FOMC Meetings</g)];
    const reuniones: ReunionFomc[] = [];

    panels.forEach((p, i) => {
      const anio = Number(p[1]);
      const desde = p.index ?? 0;
      const hasta = i + 1 < panels.length ? (panels[i + 1].index ?? html.length) : html.length;
      const bloque = html.slice(desde, hasta);

      const meses = [...bloque.matchAll(/fomc-meeting__month[^>]*><strong>([^<]*)<\/strong>/g)];
      const dias = [...bloque.matchAll(/fomc-meeting__date[^>]*>([^<]*)</g)];

      for (let k = 0; k < Math.min(meses.length, dias.length); k++) {
        const crudoMes = limpiar(meses[k][1]);
        const crudoDia = limpiar(dias[k][1]);
        const conProyecciones = crudoDia.includes("*");

        const partesMes = crudoMes.split("/").map((m) => mesDeNombre(m));
        const partesDia = crudoDia.replace(/\*/g, "").split("-").map((d) => Number(d.trim()));
        if (partesMes.some((m) => m == null) || partesDia.some((d) => !Number.isFinite(d))) continue;

        const mesInicio = partesMes[0]!;
        const mesFin = partesMes[partesMes.length - 1]!;
        const diaInicio = partesDia[0];
        const diaFin = partesDia[partesDia.length - 1];
        // Diciembre/enero cruza de año: el cierre cae en el siguiente.
        const anioFin = mesFin < mesInicio ? anio + 1 : anio;

        reuniones.push({
          fechaInicio: iso(anio, mesInicio, diaInicio),
          fecha: iso(anioFin, mesFin, diaFin),
          conProyecciones,
        });
      }
    });

    return reuniones.sort((a, b) => a.fecha.localeCompare(b.fecha));
  });
}

/** Las reuniones que todavía no pasaron, en orden. */
export async function getProximasReuniones(cuantas = 8): Promise<ReunionFomc[]> {
  const hoy = new Date().toISOString().slice(0, 10);
  const todas = await getCalendarioFomc();
  return todas.filter((r) => r.fecha >= hoy).slice(0, cuantas);
}

// ─── Autoridades ─────────────────────────────────────────────────────────────

export interface MiembroBoard {
  nombre: string;
  /** "Presidente", "Vicepresidente", "Gobernador"… ya en castellano. */
  cargo: string;
  /** Su biografía en federalreserve.gov. */
  link: string;
}

const CARGOS: [RegExp, string][] = [
  [/^chair(man|woman)?$/i, "Presidente"],
  [/^vice chair for supervision$/i, "Vice de Supervisión"],
  [/^vice chair(man|woman)?$/i, "Vicepresidente"],
];

/**
 * Quiénes integran el Board hoy, leído de la página de biografías.
 *
 * Está acá y no hardcodeado a propósito: la presidencia de la Fed cambia —y
 * cambió— y un dashboard que diga el nombre viejo es peor que uno que no diga
 * nada. La lista sale de los links del índice lateral, que son
 * `/aboutthefed/bios/board/<apellido>.htm` con el texto "Nombre, Cargo"; los
 * gobernadores sin cargo ejecutivo aparecen sin coma. Se excluye el link al
 * histórico de integrantes, que comparte el mismo patrón de URL.
 */
export function getAutoridadesFed(): Promise<MiembroBoard[]> {
  return memoFred("fed:board", 86_400, async () => {
    const html = await getTexto("https://www.federalreserve.gov/aboutthefed/bios/board/default.htm");

    const out: MiembroBoard[] = [];
    for (const m of html.matchAll(
      /href="(\/aboutthefed\/bios\/board\/([a-z-]+)\.htm)"[^>]*>([^<]+)</g
    )) {
      const texto = limpiar(m[3]);
      const [nombre, cargoEn] = texto.split(",").map((x) => x.trim());
      if (!nombre || nombre.split(" ").length < 2) continue;
      if (out.some((x) => x.nombre === nombre)) continue;

      // El índice mezcla las biografías con dos links de navegación
      // ("Board Members", el histórico desde 1914). El filtro que los separa sin
      // depender de esos textos: en una biografía el archivo se llama como el
      // apellido —warsh.htm, jefferson.htm—, y en las otras no.
      const apellido = nombre.split(" ").pop()!.toLowerCase();
      const slug = m[2].toLowerCase();
      if (!slug.includes(apellido) && !apellido.includes(slug)) continue;

      out.push({
        nombre,
        cargo: cargoEn ? (CARGOS.find(([re]) => re.test(cargoEn))?.[1] ?? "Gobernador") : "Gobernador",
        link: `https://www.federalreserve.gov${m[1]}`,
      });
    }
    return out;
  });
}

// ─── Sendero implícito de tasa (futuros de fondos federales) ─────────────────

/** Código de mes de los futuros: F=ene, G=feb, H=mar, J=abr, K=may, M=jun… */
const CODIGO_MES = ["F", "G", "H", "J", "K", "M", "N", "Q", "U", "V", "X", "Z"];

export interface PuntoSendero {
  /** Mes del contrato, YYYY-MM. */
  mes: string;
  /** EFFR promedio implícito en el precio del contrato, en %. */
  tasaImplicita: number;
}

export interface ReunionDescontada extends ReunionFomc {
  /** Tasa efectiva que el mercado espera **después** de esa reunión, en %. */
  tasaEsperada: number;
  /** Movimiento implícito en esa reunión, en puntos básicos. */
  cambioPb: number;
  /**
   * Probabilidad implícita de un movimiento de 25 pb en esa reunión, 0-1.
   * Es la lectura binaria (mover 25 o no mover) del FedWatch.
   */
  probabilidad25: number;
  /** "suba" | "baja" según el signo del movimiento descontado. */
  direccion: "suba" | "baja" | "sin cambio";
}

export interface SenderoFed {
  puntos: PuntoSendero[];
  reuniones: ReunionDescontada[];
  /** EFFR de partida con la que se armó el sendero. */
  effrHoy: number;
  /** Movimiento acumulado descontado hasta el final del horizonte, en pb. */
  acumuladoPb: number;
  /** Rango objetivo implícito al final del horizonte. */
  rangoFinal: { bajo: number; alto: number } | null;
}

/** Último precio de un contrato de futuros, vía Yahoo. */
async function precioFuturo(simbolo: string): Promise<number | null> {
  try {
    const yf = new YahooFinance({ validation: { logErrors: false } });
    const res = await yf.chart(simbolo, {
      period1: new Date(Date.now() - 10 * 86_400_000),
      interval: "1d",
    });
    const cierres = (res.quotes ?? []).filter((q) => q.close != null);
    const ultimoCierre = cierres.length > 0 ? (cierres[cierres.length - 1].close as number) : null;
    // `meta` trae el precio en curso; el cierre sirve de respaldo fuera de rueda.
    return (res.meta?.regularMarketPrice as number | undefined) ?? ultimoCierre;
  } catch {
    return null;
  }
}

const diasDelMes = (anio: number, mes: number) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();

/**
 * Mínimos cuadrados por ecuaciones normales, con una pizca de regularización.
 *
 * El sistema del sendero es sobredeterminado —doce contratos para estimar unas
 * pocas reuniones— y eso es justamente lo que lo hace robusto: cada tasa se
 * estima con toda la información disponible y no con un solo contrato.
 */
function minimosCuadrados(A: number[][], b: number[], ridge = 1e-6): number[] | null {
  const n = A[0]?.length ?? 0;
  if (n === 0) return null;

  // Normales: (AᵀA + λI)·x = Aᵀb
  const M: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => {
      if (j === n) return A.reduce((acc, fila, k) => acc + fila[i] * b[k], 0);
      return A.reduce((acc, fila) => acc + fila[i] * fila[j], 0) + (i === j ? ridge : 0);
    })
  );

  // Eliminación gaussiana con pivoteo parcial
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let f = col + 1; f < n; f++) if (Math.abs(M[f][col]) > Math.abs(M[piv][col])) piv = f;
    if (Math.abs(M[piv][col]) < 1e-12) return null;
    [M[col], M[piv]] = [M[piv], M[col]];

    for (let f = 0; f < n; f++) {
      if (f === col) continue;
      const factor = M[f][col] / M[col][col];
      for (let c = col; c <= n; c++) M[f][c] -= factor * M[col][c];
    }
  }
  // Tras la eliminación completa la matriz queda diagonal: x_i = M[i][n] / M[i][i].
  return M.map((fila, i) => fila[n] / fila[i]);
}

/** Todos los días de un mes como ISO, para repartir el promedio del contrato. */
function diasDelMesIso(anio: number, mes: number): string[] {
  const n = diasDelMes(anio, mes);
  return Array.from({ length: n }, (_, i) => iso(anio, mes, i + 1));
}

/**
 * Qué tasa descuenta el mercado para cada reunión, a partir de los futuros.
 *
 * La mecánica es la misma que la del FedWatch de CME, que no publica API. El
 * contrato ZQ de un mes liquida contra el **promedio diario de la EFFR de ese
 * mes**, y su tasa implícita es `100 − precio`. Si en el mes hay una reunión, ese
 * promedio mezcla dos regímenes: la tasa vieja hasta el anuncio y la nueva
 * después (el cambio rige desde el día siguiente).
 *
 * El primer intento fue despejar el sistema mes a mes, encadenando. **No
 * funciona**, y el modo en que falla vale documentarlo: cuando la reunión cae
 * cerca de fin de mes —octubre 28, abril 28— el régimen nuevo ocupa dos días del
 * contrato, el divisor `(n − D)` se hace chiquito y cualquier ruido de un
 * décimo de punto básico en el precio se amplifica quince veces. Daban saltos de
 * 280 pb en una sola reunión.
 *
 * La forma correcta es plantearlo entero y resolverlo por mínimos cuadrados:
 * cada contrato aporta una ecuación
 *
 *     tasa_implícita(mes) = Σ_j (días del mes bajo el régimen j / n) · r_j
 *
 * donde `r_0` es la EFFR de hoy (conocida, pasa al término independiente) y
 * `r_1…r_k` son las tasas después de cada reunión. La reunión del 28 de octubre
 * queda determinada sobre todo por el contrato de **noviembre**, que la contiene
 * entera, que es exactamente de donde hay que leerla.
 *
 * Dos límites honestos, por si el número se compara contra el FedWatch y no da
 * idéntico: la probabilidad supone un único movimiento de 25 pb por reunión, y
 * no se corrige la prima de riesgo de los futuros (chica, pero existe).
 */
export function getSenderoFed(): Promise<SenderoFed | null> {
  return memoFred("fed:sendero", 900, async () => {
    const tasa = await getTasaFed();
    if (!tasa?.effr) return null;
    const effrHoy = tasa.effr;

    // Doce meses de contratos: cubren las ocho reuniones del año próximo.
    const hoy = new Date();
    const contratos = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + i, 1));
      const anio = d.getUTCFullYear();
      const nmes = d.getUTCMonth() + 1;
      return {
        mes: `${anio}-${String(nmes).padStart(2, "0")}`,
        anio,
        nmes,
        simbolo: `ZQ${CODIGO_MES[nmes - 1]}${String(anio).slice(2)}.CBT`,
      };
    });

    const precios = await Promise.all(contratos.map((c) => precioFuturo(c.simbolo)));

    const puntos: PuntoSendero[] = [];
    const observados: { anio: number; nmes: number; tasa: number }[] = [];
    contratos.forEach((c, i) => {
      const p = precios[i];
      if (p == null || !Number.isFinite(p)) return;
      const tasaImplicita = 100 - p;
      puntos.push({ mes: c.mes, tasaImplicita });
      observados.push({ anio: c.anio, nmes: c.nmes, tasa: tasaImplicita });
    });
    if (observados.length === 0) return null;

    const ultimoMes = observados[observados.length - 1];
    const finHorizonte = iso(ultimoMes.anio, ultimoMes.nmes, diasDelMes(ultimoMes.anio, ultimoMes.nmes));
    const candidatas = (await getProximasReuniones(12)).filter((r) => r.fecha <= finHorizonte);

    /**
     * Arma el sistema para las primeras `k` reuniones y devuelve también cuánta
     * masa de observación tiene cada incógnita: una reunión que sólo aparece en
     * los últimos días del último contrato no está determinada y hay que soltarla.
     */
    function armar(k: number) {
      const reuniones = candidatas.slice(0, k);
      const A: number[][] = [];
      const b: number[] = [];
      const masa = new Array(k).fill(0);

      for (const obs of observados) {
        const fila = new Array(k).fill(0);
        let peso0 = 0;
        const dias = diasDelMesIso(obs.anio, obs.nmes);
        for (const dia of dias) {
          // Un día está bajo el régimen j si ya concluyeron j reuniones antes de él.
          const j = reuniones.filter((r) => r.fecha < dia).length;
          if (j === 0) peso0 += 1 / dias.length;
          else fila[j - 1] += 1 / dias.length;
        }
        if (fila.every((w) => w === 0)) continue; // no aporta nada a las incógnitas
        fila.forEach((w, i) => (masa[i] += w));
        A.push(fila);
        b.push(obs.tasa - peso0 * effrHoy);
      }
      return { reuniones, A, b, masa };
    }

    // Se recorta el horizonte hasta que la última reunión tenga observación real.
    let sistema = armar(candidatas.length);
    while (sistema.reuniones.length > 0 && (sistema.masa[sistema.masa.length - 1] ?? 0) < 0.15) {
      sistema = armar(sistema.reuniones.length - 1);
    }
    if (sistema.reuniones.length === 0 || sistema.A.length === 0) return null;

    const x = minimosCuadrados(sistema.A, sistema.b);
    if (!x) return null;

    const reuniones: ReunionDescontada[] = [];
    let previa = effrHoy;
    sistema.reuniones.forEach((r, i) => {
      const nueva = x[i];
      const cambioPb = (nueva - previa) * 100;
      reuniones.push({
        ...r,
        tasaEsperada: nueva,
        cambioPb,
        probabilidad25: Math.min(Math.abs(cambioPb) / 25, 1),
        direccion: Math.abs(cambioPb) < 1 ? "sin cambio" : cambioPb > 0 ? "suba" : "baja",
      });
      previa = nueva;
    });

    const acumuladoPb = (previa - effrHoy) * 100;
    // La EFFR opera unos pocos pb dentro del rango; ese mismo desvío se usa para
    // traducir la tasa implícita al rango objetivo con el que se comunica.
    const spread = effrHoy - (tasa.rangoBajo + tasa.rangoAlto) / 2;
    const mid = previa - spread;
    // Los rangos son bandas de 25 pb: el centro cae siempre en un múltiplo de
    // 0,25 más 0,125 (3,625 para el rango 3,50-3,75).
    const k = Math.round((mid - 0.125) / 0.25);
    const bajo = k * 0.25;

    return {
      puntos,
      reuniones,
      effrHoy,
      acumuladoPb,
      rangoFinal: Number.isFinite(bajo) ? { bajo, alto: bajo + 0.25 } : null,
    };
  });
}

// ─── Novedades (RSS de la Fed) ───────────────────────────────────────────────

export interface NovedadFed {
  titulo: string;
  link: string;
  /** ISO de publicación. */
  fecha: string;
  tipo: "discurso" | "comunicado" | "testimonio";
  /** El copete del feed, recortado. */
  resumen: string | null;
  /** El apellido del orador, cuando el título lo trae adelante. */
  orador: string | null;
}

const FEEDS: { url: string; tipo: NovedadFed["tipo"] }[] = [
  { url: "https://www.federalreserve.gov/feeds/speeches.xml", tipo: "discurso" },
  { url: "https://www.federalreserve.gov/feeds/press_monetary.xml", tipo: "comunicado" },
  { url: "https://www.federalreserve.gov/feeds/testimony.xml", tipo: "testimonio" },
];

function parsearRss(xml: string, tipo: NovedadFed["tipo"]): NovedadFed[] {
  const out: NovedadFed[] = [];
  for (const item of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const bloque = item[1];
    const campo = (n: string) => {
      const m = bloque.match(new RegExp(`<${n}>([\\s\\S]*?)</${n}>`));
      return m ? limpiar(m[1]) : null;
    };
    const titulo = campo("title");
    const link = campo("link");
    if (!titulo || !link) continue;

    const pub = campo("pubDate");
    const fecha = pub ? new Date(pub).toISOString() : new Date().toISOString();
    const resumen = campo("description");
    // Los discursos vienen titulados "Warsh, In Our Time": el apellido adelante.
    const conOrador = tipo === "discurso" ? titulo.match(/^([A-Z][a-zA-Z-]+),\s*(.+)$/) : null;

    out.push({
      titulo: conOrador ? conOrador[2] : titulo,
      link,
      fecha,
      tipo,
      resumen: resumen && resumen !== titulo ? resumen.slice(0, 320) : null,
      orador: conOrador ? conOrador[1] : null,
    });
  }
  return out;
}

/** Discursos, comunicados de política monetaria y testimonios, más nuevo primero. */
export function getNovedadesFed(cuantas = 12): Promise<NovedadFed[]> {
  return memoFred(`fed:novedades:${cuantas}`, 1800, async () => {
    const settled = await Promise.allSettled(FEEDS.map((f) => getTexto(f.url)));
    const todas: NovedadFed[] = [];
    settled.forEach((r, i) => {
      if (r.status === "fulfilled") todas.push(...parsearRss(r.value, FEEDS[i].tipo));
    });
    return todas.sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, cuantas);
  });
}

// ─── Utilidad compartida ─────────────────────────────────────────────────────

export type { PuntoSerie };
