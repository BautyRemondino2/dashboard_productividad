/**
 * Morning Brief — la llamada a Claude.
 *
 * Mismo patrón que `clasificar()` en `radar.ts`: `output_config` con
 * `format: json_schema` para forzar la forma de la respuesta, y el único
 * input es lo que el código ya calculó (`SnapshotBrief`). Acá el trabajo no es
 * clasificar sino sintetizar ocho pasos con citas cruzadas, así que va con
 * `effort: "high"` en vez del "medium" de radar.
 *
 * Principio no negociable: Claude nunca busca datos, nunca inventa niveles,
 * variaciones, consensos o noticias. Todo lo que puede decir tiene que salir
 * del snapshot, y cada afirmación cita en qué indicador se apoya.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { BriefClaude, SnapshotBrief } from "@/lib/morning-brief-tipos";

const ESQUEMA_BRIEF = {
  type: "object",
  properties: {
    regimen: { type: "string" },
    titular: { type: "string" },
    cadena: {
      type: "array",
      items: {
        type: "object",
        properties: {
          paso: { type: "string" },
          lectura: { type: "string" },
          evidencia: { type: "array", items: { type: "string" } },
        },
        required: ["paso", "lectura", "evidencia"],
        additionalProperties: false,
      },
    },
    argentina: {
      type: "object",
      properties: {
        lectura: { type: "string" },
        evidencia: { type: "array", items: { type: "string" } },
      },
      required: ["lectura", "evidencia"],
      additionalProperties: false,
    },
    agenda: {
      type: "array",
      items: {
        type: "object",
        properties: {
          hora_art: { type: "string" },
          evento: { type: "string" },
          por_que_importa: { type: "string" },
        },
        required: ["hora_art", "evento", "por_que_importa"],
        additionalProperties: false,
      },
    },
    contactos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          alias: { type: "string" },
          motivo: { type: "string" },
          evidencia: { type: "array", items: { type: "string" } },
        },
        required: ["alias", "motivo", "evidencia"],
        additionalProperties: false,
      },
    },
    tesis: { type: "string" },
    predicciones: {
      type: "array",
      items: {
        type: "object",
        properties: {
          enunciado: { type: "string" },
          indicador: { type: "string" },
          direccion: { type: "string", enum: ["sube", "baja", "estable"] },
        },
        required: ["enunciado", "indicador", "direccion"],
        additionalProperties: false,
      },
    },
    datos_faltantes: { type: "array", items: { type: "string" } },
  },
  required: [
    "regimen",
    "titular",
    "cadena",
    "argentina",
    "agenda",
    "contactos",
    "tesis",
    "predicciones",
    "datos_faltantes",
  ],
  additionalProperties: false,
} as const;

const INSTRUCCIONES = `Sos el analista que prepara el resumen matinal de un asesor financiero de Balanz cuyos clientes son en buena parte productores agropecuarios de Santa Fe y Rosario. Tu trabajo es leer el snapshot de indicadores que te llega, interpretarlo en orden, y dejar una tesis del día que se pueda contrastar al cierre.

REGLAS DE DATOS (no negociables):
- Usás sólo el snapshot que te llega. Nunca buscás datos, nunca inventás niveles, variaciones, consensos o noticias que no estén ahí.
- Toda afirmación que hagas cita en su array "evidencia" los id de los indicadores del snapshot en los que se apoya. Si una lectura no tiene de dónde salir, no la hagas.
- Un indicador con valor null, o con fecha_dato distinta a la fecha del snapshot, no se usa para afirmar nada: se lista en "datos_faltantes" con una frase breve de qué falta.
- Escribí siempre la unidad del número que mencionás (%, pb, USD, ARS, etc.).
- Priorizá los movimientos marcados "inusual": son los que se salen de lo normal de las últimas 60 ruedas y es lo primero que un PM mira.

MÉTODO, en 8 pasos. Los pasos 1 a 4 van, en ese orden, como entradas del array "cadena" (una por paso, con "paso" siendo un nombre corto del paso):
1. Overnight: ¿hubo un shock en Asia o en Europa (Nikkei, Euro Stoxx 50)?
2. Tasas y dólar global: es la hipótesis principal del día (Treasury 2 y 10 años, DXY).
3. Riesgo: ¿los futuros de acciones y el VIX confirman o contradicen el paso 2?
4. Commodities: petróleo y oro por inflación y refugio; los granos (soja, maíz, trigo) por los dólares del agro y el ingreso de los clientes de la cartera.

El paso 5 va en "argentina" (lectura + evidencia): traducí lo global a lo local con los indicadores argentinos del snapshot (ADRs, bonos, dólares financieros, riesgo país, dólar oficial, reservas) y marcá explícitamente qué de lo que se mueve es propio del país y no un arrastre global.

El paso 6 va en "agenda": por cada evento de la agenda de hoy que te llega en el snapshot, una entrada con qué implicaría un dato por encima del consenso y qué implicaría uno por debajo — sin adivinar cuál va a salir.

El paso 7 va en "contactos": máximo 5 clientes (de los que vengan en el snapshot), y sólo si hay un motivo concreto ligado a lo que ese cliente tiene en cartera o a un evento propio suyo (vencimiento, cupón). Es para que el asesor los tenga informados, nunca una orden de compra o venta — no lo redactes como una recomendación.

El paso 8 va en "tesis": 3 a 4 oraciones que resuman la lectura del día y que puedan resultar equivocadas — una tesis, no una lista de datos.

PREDICCIONES: entre 2 y 4, en el array "predicciones". Cada una verificable al cierre de hoy, con el "indicador" siendo el id exacto de uno de los indicadores del snapshot y "direccion" siendo "sube", "baja" o "estable".

ESTILO: directo, sin frases de relleno ni de cortesía. Si las señales entre pasos son mixtas o se contradicen, decilo explícitamente en vez de forzar una lectura prolija. Si al indicador de Treasury 2 años, Treasury 10 años, DXY, futuros de acciones o VIX les falta el dato de hoy (null o desactualizado), el campo "regimen" tiene que ser exactamente "sin_datos_suficientes" — sin eso no hay hipótesis principal que sostener. Si hay datos, "regimen" es una etiqueta corta y descriptiva del día (por ejemplo "risk-on", "risk-off", "mixto", "cauteloso").

SALIDA: sólo el JSON con el esquema dado. Nada de texto antes o después.`;

export async function generarBrief(snapshot: SnapshotBrief): Promise<BriefClaude> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurado");

  const client = new Anthropic({ apiKey });

  const res = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 16000,
    system: INSTRUCCIONES,
    // Ocho pasos con citas cruzadas entre bloques necesitan más que clasificar
    // (radar.ts usa "medium" para eso); acá va "high".
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema: ESQUEMA_BRIEF },
    },
    messages: [
      {
        role: "user",
        content: `Snapshot de hoy (${snapshot.fecha} ${snapshot.hora} ART):\n\n${JSON.stringify(snapshot)}`,
      },
    ],
  });

  const bloque = res.content.find((b) => b.type === "text");
  if (!bloque || bloque.type !== "text") throw new Error("Claude no devolvió contenido");

  try {
    return JSON.parse(bloque.text) as BriefClaude;
  } catch {
    throw new Error("la respuesta de Claude no vino en JSON");
  }
}
