/**
 * Rava Bursátil — el riesgo país intradiario.
 *
 * El panel lo traía de argentinadatos, que publica el **cierre**: a media
 * mañana seguía mostrando el número del día anterior. Rava lo actualiza
 * durante la rueda, y esa diferencia importa justo los días en que importa.
 *
 * ## De dónde sale, y por qué no es scraping frágil
 *
 * La ficha de `rava.com/perfil/RIESGO PAIS` trae un bloque
 * `<script type="application/ld+json">` con schema.org: un `FinancialProduct`
 * con `offers.price`. Eso es dato estructurado, no HTML de presentación —está
 * ahí para Google— así que sobrevive a los rediseños que romperían un selector
 * de CSS. `robots.txt` de rava.com no bloquea nada (`Disallow:` vacío).
 *
 * Igual es una fuente de terceros que puede cambiar: si el bloque no aparece o
 * el número no es plausible, esto tira y **argentinadatos sigue siendo la
 * fuente del cierre y de todo el histórico**. Lo único que se pierde es la
 * frescura del día.
 *
 * ## El orden importa
 *
 * En `FUENTES`, rava va **antes** que argentinadatos. Las dos escriben con
 * `ON CONFLICT DO UPDATE`, así que la última gana: mientras las fechas son
 * distintas (rava escribe hoy, argentinadatos ayer) no se pisan, y el día que
 * argentinadatos publique el cierre de hoy, ese cierre le gana al intradiario.
 * Que es lo correcto: un cierre oficial vale más que una foto de las once.
 */

const PERFIL = "https://www.rava.com/perfil/RIESGO%20PAIS";
const TIMEOUT_MS = 12_000;

/** Un navegador de verdad: sin esto rava contesta distinto. */
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

/**
 * Rango plausible del EMBI argentino, en puntos básicos.
 *
 * No es un capricho: el mínimo histórico de la serie ronda los 300 pb y el
 * máximo, en default, pasó los 25.000. Fuera de esa ventana lo que volvió no
 * es el riesgo país —es un cero, un precio de otra cosa, o un parseo que salió
 * mal— y entra a la serie para quedarse. Más vale no publicar el dato.
 */
const MINIMO = 50;
const MAXIMO = 30_000;

// ─── Caché en memoria (patrón equity/finviz, sin DB) ────────────────────────

interface Entrada {
  valor: number;
  vence: number;
}

declare global {
  var __ravaCache: Map<string, Entrada> | undefined;
}

const cache = (globalThis.__ravaCache ??= new Map<string, Entrada>());

/**
 * La fecha de hoy en Buenos Aires.
 *
 * `localDateStr()` usa la zona del servidor, que en Vercel es UTC: después de
 * las nueve de la noche de Argentina ya es el día siguiente y el valor
 * intradiario quedaría estampado con la fecha equivocada. Éste es un dato de la
 * rueda porteña, así que la fecha se calcula en la zona de la rueda.
 */
export function hoyEnArgentina(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Sábado o domingo en Buenos Aires: no hay rueda que informar. */
export function esFinDeSemanaEnArgentina(): boolean {
  const dia = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "short",
  }).format(new Date());
  return dia === "Sat" || dia === "Sun";
}

/**
 * El riesgo país que rava muestra ahora mismo, en puntos básicos.
 *
 * Cachea cinco minutos: es un intradiario, no un tiempo real, y el panel se
 * refresca varias veces por visita.
 */
export async function getRiesgoPaisRava(): Promise<number> {
  const hit = cache.get("riesgo");
  if (hit && hit.vence > Date.now()) return hit.valor;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let html: string;
  try {
    const r = await fetch(PERFIL, {
      headers: { "user-agent": UA, accept: "text/html" },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`rava HTTP ${r.status}`);
    html = await r.text();
  } finally {
    clearTimeout(t);
  }

  const valor = leerRiesgoPais(html);
  if (valor == null) throw new Error("rava: no se encontró el precio en el JSON-LD");

  cache.set("riesgo", { valor, vence: Date.now() + 300_000 });
  return valor;
}

/**
 * Saca el número del bloque de datos estructurados. Exportada para poder
 * probarla contra un HTML guardado, sin salir a la red.
 */
export function leerRiesgoPais(html: string): number | null {
  const bloques = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  for (const m of bloques) {
    let dato: unknown;
    try {
      dato = JSON.parse(m[1]);
    } catch {
      // Un bloque roto no puede tapar a los otros: la página trae varios.
      continue;
    }

    const d = dato as { "@type"?: string; identifier?: string; offers?: { price?: unknown } };
    if (d?.["@type"] !== "FinancialProduct") continue;
    if (d.identifier && !/riesgo\s*pais/i.test(d.identifier)) continue;

    const precio = Number(d.offers?.price);
    if (Number.isFinite(precio) && precio >= MINIMO && precio <= MAXIMO) return precio;
  }

  return null;
}
