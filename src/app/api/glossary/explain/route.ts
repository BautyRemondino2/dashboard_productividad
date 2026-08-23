import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  const { term, category, short_def, detail } = await req.json() as {
    term: string;
    category: string;
    short_def: string;
    detail: string;
  };

  if (!term) {
    return new Response("term required", { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response("ANTHROPIC_API_KEY no configurado", { status: 503 });
  }

  const client = new Anthropic({ apiKey });

  const stream = client.messages.stream({
    model: "claude-opus-5",
    // En Opus 5 el razonamiento viene activado por omisión y consume tokens de
    // salida: con los 700 de antes la explicación se cortaba a la mitad.
    max_tokens: 8000,
    // Explicar un término de glosario no amerita razonar a fondo; con esfuerzo
    // medio la respuesta empieza a salir rápido y no pierde calidad.
    output_config: { effort: "medium" },
    messages: [
      {
        role: "user",
        content: `Sos un profesor de finanzas especializado en mercados argentinos y finanzas cuantitativas.

Explicá el término financiero "${term}" (categoría: ${category}).

Contexto base disponible:
- Definición corta: ${short_def}
- Detalle: ${detail}

Tu explicación debe:
1. Ampliar la definición con intuición económica
2. Incluir al menos un ejemplo numérico concreto (si aplica)
3. Mencionar su relevancia específica en el mercado argentino o en las materias de finanzas
4. Ser clara para un estudiante universitario de finanzas
5. Máximo 4-5 párrafos cortos

Respondé directamente sin encabezados ni formato markdown excesivo. Usá prosa fluida.`,
      },
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
