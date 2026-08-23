/**
 * La capa de Claude del monitor de equity.
 *
 * Dos cosas distintas, con costos muy distintos:
 *
 *   1. `getDescripcionEs()` — traduce y resume al castellano la descripción
 *      que Yahoo da en inglés. Una llamada corta, sin herramientas.
 *   2. `getInvestigacion()` — sale a buscar a la web con qué contratos,
 *      clientes, proveedores e inversiones tiene la empresa. Esto **no está
 *      en la API de Yahoo**: vive en los balances y en la prensa.
 *
 * Por qué la investigación usa búsqueda web y no el conocimiento del modelo:
 * un modelo respondiendo de memoria sobre contratos y clientes inventa nombres
 * y fechas que suenan perfectos. Esto termina en una conversación con un
 * cliente, así que cada afirmación tiene que tener una fuente que se pueda
 * abrir y verificar.
 *
 * Sin `ANTHROPIC_API_KEY` las dos funciones devuelven null y la ficha
 * simplemente no muestra esos paneles.
 */
import Anthropic from "@anthropic-ai/sdk";

const MODELO = "claude-opus-5";

// ─── Caché ──────────────────────────────────────────────────────────────────

interface Entrada<T> {
  valor: T;
  vence: number;
}

declare global {
  var __claudeCache: Map<string, Entrada<unknown>> | undefined;
}

const cache = (globalThis.__claudeCache ??= new Map<string, Entrada<unknown>>());

async function memo<T>(clave: string, ttlSegundos: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(clave);
  if (hit && hit.vence > Date.now()) return hit.valor as T;

  const promesa = fn();
  cache.set(clave, { valor: promesa, vence: Date.now() + ttlSegundos * 1000 });
  try {
    return await promesa;
  } catch (e) {
    cache.delete(clave);
    throw e;
  }
}

export function invalidarCacheClaude() {
  cache.clear();
}

function cliente(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return apiKey ? new Anthropic({ apiKey }) : null;
}

export function hayClaude(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Junta el texto de todos los bloques de texto de una respuesta. */
function textoDe(bloques: Anthropic.ContentBlock[]): string {
  return bloques
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

// ─── Descripción en castellano ──────────────────────────────────────────────

/**
 * Traduce y condensa la descripción de negocio de Yahoo. El original es una
 * enumeración larga y en inglés; lo que sirve a la mañana es saber en tres
 * frases de qué vive la empresa.
 */
export function getDescripcionEs(
  ticker: string,
  nombre: string,
  descripcionEn: string
): Promise<string | null> {
  return memo(`desc:${ticker}`, 30 * 86400, async () => {
    const client = cliente();
    if (!client || !descripcionEn) return null;

    const r = await client.messages.create({
      model: MODELO,
      max_tokens: 4000,
      // Traducir y condensar no requiere razonar a fondo.
      output_config: { effort: "low" },
      system:
        "Sos un analista financiero argentino. Escribís en castellano rioplatense, " +
        "claro y sin adornos, para un asesor que necesita entender rápido de qué " +
        "vive una empresa. No usás markdown ni encabezados.",
      messages: [
        {
          role: "user",
          content: `Traducí y condensá esta descripción de ${nombre} (${ticker}) a tres o cuatro frases en castellano.

Reglas:
- Contá de qué vive la empresa: qué vende y a quién.
- Si la descripción menciona segmentos de negocio, decí cuáles son.
- No agregues nada que no esté en el texto original.
- No empieces con "La empresa" ni repitas el nombre en cada frase.

Texto original:
${descripcionEn}`,
        },
      ],
    });

    return textoDe(r.content) || null;
  });
}

// ─── Investigación con fuentes ──────────────────────────────────────────────

export interface Fuente {
  titulo: string;
  url: string;
}

export interface Investigacion {
  /** Secciones en el orden en que se piden. */
  secciones: { titulo: string; texto: string }[];
  fuentes: Fuente[];
  generadoEl: string;
}

const SECCIONES = [
  "NEGOCIO",
  "CLIENTES Y PROVEEDORES",
  "CONTRATOS Y ACUERDOS",
  "INVERSIONES",
  "RIESGOS",
] as const;

const TITULO_SECCION: Record<string, string> = {
  NEGOCIO: "De qué vive realmente",
  "CLIENTES Y PROVEEDORES": "Clientes y proveedores",
  "CONTRATOS Y ACUERDOS": "Contratos y acuerdos",
  INVERSIONES: "Dónde está invirtiendo",
  RIESGOS: "Riesgos concretos",
};

/** Parte la respuesta por los encabezados que se pidieron. */
function partirEnSecciones(texto: string): { titulo: string; texto: string }[] {
  const salida: { titulo: string; texto: string }[] = [];

  for (let i = 0; i < SECCIONES.length; i++) {
    const marca = `## ${SECCIONES[i]}`;
    const desde = texto.indexOf(marca);
    if (desde === -1) continue;

    // Termina donde arranca la próxima sección presente, o al final
    let hasta = texto.length;
    for (let j = i + 1; j < SECCIONES.length; j++) {
      const siguiente = texto.indexOf(`## ${SECCIONES[j]}`, desde + marca.length);
      if (siguiente !== -1) {
        hasta = siguiente;
        break;
      }
    }

    const cuerpo = texto.slice(desde + marca.length, hasta).trim();
    if (cuerpo) {
      salida.push({ titulo: TITULO_SECCION[SECCIONES[i]] ?? SECCIONES[i], texto: cuerpo });
    }
  }

  // Si el modelo no respetó el formato, se muestra entero antes que perderlo
  if (salida.length === 0 && texto) {
    salida.push({ titulo: "Resumen", texto });
  }
  return salida;
}

/** Las páginas que Claude efectivamente consultó, sin repetir. */
function fuentesDe(bloques: Anthropic.ContentBlock[]): Fuente[] {
  const vistas = new Map<string, Fuente>();

  for (const bloque of bloques) {
    if (bloque.type !== "web_search_tool_result") continue;
    // Ante un error la API manda un objeto en vez de la lista de resultados
    if (!Array.isArray(bloque.content)) continue;

    for (const r of bloque.content) {
      if (r.type === "web_search_result" && r.url && !vistas.has(r.url)) {
        vistas.set(r.url, { titulo: r.title || r.url, url: r.url });
      }
    }
  }
  return [...vistas.values()];
}

/**
 * Investiga la empresa en la web y devuelve las secciones con sus fuentes.
 *
 * Cachea 24 horas: es lo más caro de todo el dashboard (unos centavos de dólar
 * por ticker) y esta información no cambia entre la mañana y la tarde.
 */
export function getInvestigacion(ticker: string, nombre: string): Promise<Investigacion | null> {
  return memo(`investigacion:${ticker}`, 86400, async () => {
    const client = cliente();
    if (!client) return null;

    const stream = client.messages.stream({
      model: MODELO,
      max_tokens: 16000,
      output_config: { effort: "high" },
      tools: [
        {
          type: "web_search_20260209",
          name: "web_search",
          max_uses: 8,
        },
      ],
      system:
        "Sos un analista de equity que escribe para un asesor financiero argentino. " +
        "Castellano rioplatense, directo, sin relleno ni lenguaje de folleto.\n\n" +
        "Regla que no se negocia: **cada afirmación concreta tiene que salir de una " +
        "búsqueda que hiciste**. Nombres de clientes, montos de contratos, fechas, " +
        "plantas, adquisiciones: si no lo encontraste buscando, no lo escribís. " +
        "Si sobre un punto no encontraste nada, escribí exactamente 'No encontré " +
        "información reciente sobre esto.' y seguí. Inventar un contrato que no " +
        "existe es peor que dejar la sección vacía, porque esto se le repite a un " +
        "cliente.\n\n" +
        "Cuando cites un dato, mencioná la fuente en el texto entre paréntesis " +
        "(por ejemplo: «según Reuters»). No inventes cifras redondeadas: si la " +
        "fuente dice 4.300 millones, poné 4.300 millones.",
      messages: [
        {
          role: "user",
          content: `Investigá ${nombre} (${ticker}) y escribí exactamente estas cinco secciones, con estos encabezados literales:

## NEGOCIO
De qué vive realmente: de dónde sale la facturación, qué peso tiene cada línea de negocio.

## CLIENTES Y PROVEEDORES
Quiénes son sus clientes principales y de quién depende para producir. Si es proveedora de otra empresa conocida, decilo.

## CONTRATOS Y ACUERDOS
Contratos vigentes o a futuro, acuerdos de provisión, alianzas y backlog anunciado.

## INVERSIONES
Dónde está poniendo capital: plantas, adquisiciones, capex, expansión geográfica.

## RIESGOS
Los dos o tres riesgos concretos que hoy le pueden pegar al negocio o a la acción.

Cada sección: dos o tres frases. Sin listas, sin viñetas, prosa corrida.`,
        },
      ],
    });

    const mensaje = await stream.finalMessage();

    // Los clasificadores de seguridad pueden declinar: hay que mirarlo antes de
    // leer el contenido, o se muestra una ficha vacía sin explicación.
    if (mensaje.stop_reason === "refusal") return null;

    const texto = textoDe(mensaje.content);
    if (!texto) return null;

    return {
      secciones: partirEnSecciones(texto),
      fuentes: fuentesDe(mensaje.content),
      generadoEl: new Date().toISOString(),
    };
  });
}

// ─── Objetivo de un fondo, en castellano ────────────────────────────────────

/**
 * Traduce y aterriza el objetivo declarado de un ETF.
 *
 * El texto original es prospecto puro ("The trust seeks to achieve its
 * investment objective by holding a portfolio of the common stocks…"): dice
 * mucho y explica poco. Lo que sirve es a qué le estás comprando exposición.
 */
export function getObjetivoEs(
  ticker: string,
  nombre: string,
  objetivoEn: string
): Promise<string | null> {
  return memo(`objetivo:${ticker}`, 30 * 86400, async () => {
    const client = cliente();
    if (!client || !objetivoEn) return null;

    const r = await client.messages.create({
      model: MODELO,
      max_tokens: 4000,
      output_config: { effort: "low" },
      system:
        "Sos un analista financiero argentino que le explica productos a un asesor. " +
        "Castellano rioplatense, directo. Sin markdown ni encabezados.",
      messages: [
        {
          role: "user",
          content: `Explicá en dos o tres frases qué es el ETF ${ticker} (${nombre}), a partir de su objetivo declarado.

Reglas:
- Decí a qué le da exposición: qué compra, de qué mercado, con qué criterio.
- Si el texto menciona el índice que replica, nombralo.
- Traducí el contenido, no la jerga de prospecto. "Seeks to provide investment results that correspond generally to the price and yield performance" se dice "replica".
- No agregues datos que no estén en el texto (ni comisiones, ni rendimientos, ni opiniones).
- No empieces con "Este ETF" ni repitas el ticker en cada frase.

Objetivo declarado:
${objetivoEn}`,
        },
      ],
    });

    return textoDe(r.content) || null;
  });
}
