import { NextRequest, NextResponse } from "next/server";
import { UNIVERSO } from "@/lib/equity-universo";
import { SECTOR_LABEL } from "@/lib/equity-sectores";

/**
 * Busca en el universo completo, no sólo en el ranking.
 *
 * El ranking muestra 150 papeles —los de más momentum— y el buscador de la
 * tabla filtra sobre esos. Si alguien busca un ticker que hoy no está entre
 * ellos no encuentra nada, y no tiene forma de llegar a su ficha.
 *
 * Va por API y no en el cliente porque las 2.126 empresas pesan 44 KB: no
 * tienen por qué viajar al navegador sólo para tipear en un campo.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  if (q.length < 2) return NextResponse.json({ resultados: [] });

  const conPuntaje = [];
  for (const e of UNIVERSO) {
    const ticker = e.ticker.toLowerCase();
    const nombre = e.nombre.toLowerCase();

    // El ticker exacto primero, después por prefijo, y recién ahí el nombre:
    // buscar "tem" tiene que traer TEM antes que "Aehr Test Systems"
    const puntaje =
      ticker === q ? 0
      : ticker.startsWith(q) ? 1
      : nombre.startsWith(q) ? 2
      : ticker.includes(q) ? 3
      : nombre.includes(q) ? 4
      : -1;

    if (puntaje >= 0) conPuntaje.push({ e, puntaje });
  }

  const resultados = conPuntaje
    .sort((a, b) => a.puntaje - b.puntaje || a.e.ticker.localeCompare(b.e.ticker))
    .slice(0, 8)
    .map(({ e }) => ({
      ticker: e.ticker,
      nombre: e.nombre,
      sector: SECTOR_LABEL[e.sector],
      argentino: e.argentino,
    }));

  return NextResponse.json({ resultados });
}
