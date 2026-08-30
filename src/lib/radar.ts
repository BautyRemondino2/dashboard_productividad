/**
 * Radar — lo que llega por los canales de WhatsApp, filtrado.
 *
 * El problema que resuelve: los canales de research y de brokers tiran cien
 * mensajes por día y adentro hay cinco que importan. Leerlos todos no escala y
 * saltearlos significa enterarse tarde. Acá se pega el volcado, Claude separa
 * las noticias del ruido, las clasifica y las deja como un feed ordenado por
 * relevancia.
 *
 * Dos formas de que entre el texto, las dos contra la misma función:
 *  1. La caja de pegado en `/radar`.
 *  2. `POST /api/radar/ingest` con un token — pensado para un Atajo de iOS:
 *     seleccionar mensajes en WhatsApp → Compartir → y ya están clasificados.
 *
 * No hay API de canales de WhatsApp (ni oficial ni razonable), así que la
 * automatización posible es esa: que compartir sea un gesto y el resto pase
 * solo. Cualquier cosa que intente leer WhatsApp por su cuenta implica
 * automatizar un cliente web, que rompe los términos y se cae sola.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import { getDb } from "@/lib/db";
import { localDateStr } from "@/lib/utils";

export const TEMAS = [
  "tasas",
  "fx",
  "renta_fija",
  "equity",
  "macro_ar",
  "macro_usa",
  "regulatorio",
  "commodities",
  "cripto",
  "otro",
] as const;

export type Tema = (typeof TEMAS)[number];

export const TEMA_LABEL: Record<Tema, string> = {
  tasas: "Tasas",
  fx: "Dólar",
  renta_fija: "Renta fija",
  equity: "Acciones",
  macro_ar: "Macro AR",
  macro_usa: "Macro EE.UU.",
  regulatorio: "Regulatorio",
  commodities: "Commodities",
  cripto: "Cripto",
  otro: "Otro",
};

/** El tono de cada tema, en la misma familia que los acentos del resto del panel. */
export const TEMA_COLOR: Record<Tema, string> = {
  tasas: "#38bdf8",
  fx: "#34d399",
  renta_fija: "#a78bfa",
  equity: "#fbbf24",
  macro_ar: "#f87171",
  macro_usa: "#60a5fa",
  regulatorio: "#f472b6",
  commodities: "#fb923c",
  cripto: "#94a3b8",
  otro: "#64748b",
};

export interface RadarItem {
  id: number;
  fecha: string;
  titulo: string;
  resumen: string;
  tema: Tema;
  relevancia: number;
  tickers: string[];
  accionable: string | null;
  fuente: string | null;
  original: string;
  leido: boolean;
  origen: string;
  created_at: string;
}

interface FilaCruda extends Omit<RadarItem, "tickers" | "leido"> {
  tickers: string;
  leido: number;
}

function hidratar(f: FilaCruda): RadarItem {
  let tickers: string[] = [];
  try {
    const parsed = JSON.parse(f.tickers);
    if (Array.isArray(parsed)) tickers = parsed.filter((t): t is string => typeof t === "string");
  } catch {
    /* tickers corruptos: el item vale igual sin ellos */
  }
  return { ...f, tickers, leido: f.leido === 1 };
}

// ─── Lectura ─────────────────────────────────────────────────────────────────

export interface FiltroRadar {
  tema?: Tema;
  /** Relevancia mínima, 1-5. */
  minRelevancia?: number;
  /** Cuántos días hacia atrás. */
  dias?: number;
}

export function listarRadar(filtro: FiltroRadar = {}): RadarItem[] {
  const db = getDb();
  const condiciones: string[] = ["fecha >= ?"];
  const params: (string | number)[] = [localDateStr(-(filtro.dias ?? 30))];

  if (filtro.tema) {
    condiciones.push("tema = ?");
    params.push(filtro.tema);
  }
  if (filtro.minRelevancia) {
    condiciones.push("relevancia >= ?");
    params.push(filtro.minRelevancia);
  }

  const filas = db
    .prepare(
      `SELECT * FROM radar_items WHERE ${condiciones.join(" AND ")}
       ORDER BY fecha DESC, relevancia DESC, id DESC LIMIT 300`
    )
    .all(...params) as FilaCruda[];

  return filas.map(hidratar);
}

/** Cuántos items hay por tema en la ventana, para los chips de filtro. */
export function conteoPorTema(dias = 30): Record<string, number> {
  const db = getDb();
  const filas = db
    .prepare(
      "SELECT tema, COUNT(*) as n FROM radar_items WHERE fecha >= ? GROUP BY tema"
    )
    .all(localDateStr(-dias)) as { tema: string; n: number }[];
  return Object.fromEntries(filas.map((f) => [f.tema, f.n]));
}

export function marcarLeido(id: number, leido: boolean) {
  getDb().prepare("UPDATE radar_items SET leido = ? WHERE id = ?").run(leido ? 1 : 0, id);
}

export function borrarItem(id: number) {
  getDb().prepare("DELETE FROM radar_items WHERE id = ?").run(id);
}

// ─── Clasificación ───────────────────────────────────────────────────────────

/**
 * Normaliza un título para deduplicar: sin acentos, sin puntuación, en
 * minúsculas. "BCRA baja la tasa al 22%" y "El BCRA bajó la tasa al 22%."
 * siguen siendo distintos —no es un deduplicador semántico— pero el mismo
 * mensaje reenviado por tres canales colapsa en uno, que es el caso frecuente.
 */
function claveDedup(titulo: string): string {
  const limpio = titulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha1").update(limpio).digest("hex");
}

const ESQUEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          resumen: { type: "string" },
          tema: { type: "string", enum: [...TEMAS] },
          relevancia: { type: "integer", minimum: 1, maximum: 5 },
          tickers: { type: "array", items: { type: "string" } },
          accionable: { type: "string" },
          fuente: { type: "string" },
          original: { type: "string" },
        },
        required: ["titulo", "resumen", "tema", "relevancia", "tickers", "accionable", "original"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

interface ItemClasificado {
  titulo: string;
  resumen: string;
  tema: Tema;
  relevancia: number;
  tickers: string[];
  accionable: string;
  fuente?: string;
  original: string;
}

const INSTRUCCIONES = `Sos el analista que filtra el flujo de información de un asesor financiero argentino (clientes con carteras en pesos y en dólares: soberanos, ONs, lecaps, CEDEARs, FCI).

Te llega un volcado crudo de mensajes de canales de WhatsApp: research de brokers, flashes de mercado, comentarios, reenvíos, y bastante ruido. Tu trabajo es quedarte con lo que un asesor necesita saber y descartar el resto.

DESCARTÁ sin piedad:
- saludos, emojis sueltos, "buen día equipo", agradecimientos
- publicidad, invitaciones a webinars, promociones de cursos
- opiniones sin dato ("el mercado está raro hoy")
- repeticiones de algo que ya está en la lista de títulos recientes que te paso
- precios sueltos sin contexto (el dashboard ya los tiene en vivo)

QUEDATE con: decisiones de política monetaria o fiscal, datos que se publican (inflación, actividad, empleo, reservas), licitaciones del Tesoro, cambios regulatorios o impositivos, resultados corporativos, emisiones y canjes, movimientos grandes con explicación, y declaraciones de funcionarios con contenido.

Para cada noticia que sobrevive:
- "titulo": una línea factual, sin adjetivos ni signos de exclamación. En castellano.
- "resumen": una o dos oraciones con el dato concreto (números si los hay).
- "tema": el que corresponda de la lista.
- "relevancia": 1 a 5 para un asesor argentino. 5 = cambia lo que le decís a un cliente hoy (decisión de tasa, salto del dólar, default, cambio de cepo). 4 = mueve precios de algo que tenés en cartera. 3 = contexto importante. 2 = útil de fondo. 1 = anecdótico.
- "tickers": los que aparezcan explícitamente (AL30, GD35, YPFD, SPX…). Vacío si no hay.
- "accionable": una línea de qué implica para una cartera. Si de verdad no implica nada, poné "Contexto, sin implicancia directa de cartera."
- "fuente": el canal o autor si se puede identificar en el texto. Omitilo si no.
- "original": el fragmento textual del que sacaste la noticia, tal cual vino.

No inventes datos que no estén en el texto. Si un mensaje afirma algo sin fuente, el resumen tiene que dejarlo claro ("se comenta que…"). Si el volcado entero es ruido, devolvé una lista vacía.`;

/**
 * Clasifica un volcado crudo y devuelve sólo lo que vale la pena guardar.
 *
 * Se le pasan los títulos recientes para que descarte lo repetido: es la única
 * forma de que el reenvío de la misma noticia por cuatro canales no aparezca
 * cuatro veces. El hash del título normalizado atrapa el resto.
 */
async function clasificar(texto: string, titulosRecientes: string[]): Promise<ItemClasificado[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurado");

  const client = new Anthropic({ apiKey });

  const contexto =
    titulosRecientes.length > 0
      ? `\n\nTítulos ya cargados en los últimos días (no los repitas):\n${titulosRecientes
          .map((t) => `- ${t}`)
          .join("\n")}`
      : "";

  const res = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    system: INSTRUCCIONES,
    // Clasificar y resumir no necesita razonamiento profundo, y con esfuerzo
    // medio el volcado de un día entero vuelve en pocos segundos.
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: ESQUEMA },
    },
    messages: [
      {
        role: "user",
        content: `Volcado de hoy (${localDateStr()}):\n\n${texto}${contexto}`,
      },
    ],
  });

  const bloque = res.content.find((b) => b.type === "text");
  if (!bloque || bloque.type !== "text") return [];

  try {
    const parsed = JSON.parse(bloque.text) as { items?: ItemClasificado[] };
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    throw new Error("la respuesta del clasificador no vino en JSON");
  }
}

export interface ResultadoIngesta {
  guardados: number;
  duplicados: number;
  descartados: number;
}

/**
 * El camino único de entrada: clasifica el texto y guarda lo nuevo.
 *
 * `descartados` es la cuenta de mensajes que el clasificador tiró y es un dato
 * que vale mostrar: es la medida de cuánto trabajo se ahorró el asesor.
 */
export async function ingerirTexto(
  texto: string,
  origen: "pegado" | "atajo" = "pegado"
): Promise<ResultadoIngesta> {
  const limpio = texto.trim();
  if (limpio.length < 20) return { guardados: 0, duplicados: 0, descartados: 0 };

  const db = getDb();
  const recientes = (
    db
      .prepare("SELECT titulo FROM radar_items WHERE fecha >= ? ORDER BY id DESC LIMIT 40")
      .all(localDateStr(-7)) as { titulo: string }[]
  ).map((r) => r.titulo);

  const items = await clasificar(limpio, recientes);

  const ins = db.prepare(
    `INSERT OR IGNORE INTO radar_items
       (hash, fecha, titulo, resumen, tema, relevancia, tickers, accionable, fuente, original, origen)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let guardados = 0;
  const hoy = localDateStr();
  const guardarTodos = db.transaction((lista: ItemClasificado[]) => {
    for (const it of lista) {
      const r = ins.run(
        claveDedup(it.titulo),
        hoy,
        it.titulo,
        it.resumen,
        TEMAS.includes(it.tema) ? it.tema : "otro",
        Math.min(5, Math.max(1, Math.round(it.relevancia))),
        JSON.stringify(it.tickers ?? []),
        it.accionable ?? null,
        it.fuente ?? null,
        it.original ?? limpio,
        origen
      );
      if (r.changes > 0) guardados++;
    }
  });
  guardarTodos(items);

  // Una medida honesta de lo filtrado: los mensajes del volcado que no
  // sobrevivieron. Se cuentan por saltos de línea, que es como llegan.
  const lineas = limpio.split("\n").filter((l) => l.trim().length > 0).length;

  return {
    guardados,
    duplicados: items.length - guardados,
    descartados: Math.max(lineas - items.length, 0),
  };
}
