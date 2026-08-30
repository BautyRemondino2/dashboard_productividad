import { NextRequest } from "next/server";
import { ingerirTexto } from "@/lib/radar";

export const dynamic = "force-dynamic";

/**
 * Ingesta desde afuera del navegador — pensado para un Atajo de iOS.
 *
 * El flujo que automatiza: seleccionar mensajes en un canal de WhatsApp →
 * Compartir → el Atajo → llegan acá ya clasificados. Es lo más cerca de
 * "automático" que se puede llegar sin automatizar un cliente de WhatsApp, que
 * no tiene API de canales y rompería los términos del servicio.
 *
 * El Atajo, tres acciones:
 *   1. Recibir texto desde la hoja de compartir
 *   2. Obtener contenido de URL — POST a https://<dominio>/api/radar/ingest
 *      Encabezados: x-radar-token: <RADAR_TOKEN> · content-type: application/json
 *      Cuerpo JSON: { "texto": <Texto de la entrada> }
 *   3. Mostrar notificación con el resultado
 *
 * Sin `RADAR_TOKEN` configurado el endpoint queda cerrado: es preferible a que
 * un endpoint que escribe en la base y gasta tokens de API quede abierto.
 */
export async function POST(req: NextRequest) {
  const esperado = process.env.RADAR_TOKEN;
  if (!esperado) {
    return Response.json({ error: "RADAR_TOKEN no configurado en el servidor" }, { status: 503 });
  }
  if (req.headers.get("x-radar-token") !== esperado) {
    return Response.json({ error: "token inválido" }, { status: 401 });
  }

  let texto = "";
  try {
    const body = (await req.json()) as { texto?: string };
    texto = (body.texto ?? "").trim();
  } catch {
    return Response.json({ error: "cuerpo JSON inválido" }, { status: 400 });
  }

  if (texto.length < 20) {
    return Response.json({ error: "texto demasiado corto" }, { status: 400 });
  }

  try {
    const r = await ingerirTexto(texto, "atajo");
    // El Atajo muestra este mensaje en una notificación, así que se devuelve ya
    // redactado y no como tres números que habría que armar del lado del iPhone.
    return Response.json({
      ...r,
      mensaje:
        r.guardados > 0
          ? `${r.guardados} ${r.guardados === 1 ? "noticia" : "noticias"} al radar` +
            (r.descartados > 0 ? ` · ${r.descartados} descartados` : "")
          : "Nada nuevo: todo era ruido o ya estaba cargado",
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
