import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { revalidarCrm } from "@/lib/crm-server";
import {
  ETAPAS, FUENTES, URGENCIAS, hoyISO, sumarDias, validarClienteInput,
  type Cliente, type Urgencia,
} from "@/lib/crm";

/** Columnas por las que se puede ordenar desde la query. */
const ORDENABLES = [
  "nombre", "apellido", "etapa", "fuente", "ticket_estimado",
  "fecha_proxima_accion", "ultima_interaccion", "created_at", "updated_at",
] as const;

/**
 * GET /api/clientes
 * Filtros: ?etapa=&fuente=&urgencia=&q=&sort=&order=asc|desc
 * La urgencia se resuelve en SQL contra la fecha de hoy del servidor.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const etapa = searchParams.get("etapa")?.trim() ?? "";
  const fuente = searchParams.get("fuente")?.trim() ?? "";
  const urgencia = searchParams.get("urgencia")?.trim() ?? "";
  const q = searchParams.get("q")?.trim() ?? "";
  const sort = searchParams.get("sort")?.trim() ?? "fecha_proxima_accion";
  const order = searchParams.get("order")?.trim().toLowerCase() === "desc" ? "DESC" : "ASC";

  if (etapa && !(ETAPAS as readonly string[]).includes(etapa)) {
    return NextResponse.json({ error: `etapa inválida (opciones: ${ETAPAS.join(", ")})` }, { status: 400 });
  }
  if (fuente && !(FUENTES as readonly string[]).includes(fuente)) {
    return NextResponse.json({ error: `fuente inválida (opciones: ${FUENTES.join(", ")})` }, { status: 400 });
  }
  if (urgencia && !(URGENCIAS as readonly string[]).includes(urgencia)) {
    return NextResponse.json({ error: `urgencia inválida (opciones: ${URGENCIAS.join(", ")})` }, { status: 400 });
  }
  if (!(ORDENABLES as readonly string[]).includes(sort)) {
    return NextResponse.json({ error: `sort inválido (opciones: ${ORDENABLES.join(", ")})` }, { status: 400 });
  }

  let query = "SELECT * FROM clientes WHERE 1=1";
  const args: (string | number)[] = [];

  if (etapa) { query += " AND etapa = ?"; args.push(etapa); }
  if (fuente) { query += " AND fuente = ?"; args.push(fuente); }

  if (q) {
    query += " AND (nombre LIKE ? OR apellido LIKE ? OR (nombre || ' ' || apellido) LIKE ? OR email LIKE ?)";
    const like = `%${q}%`;
    args.push(like, like, like, like);
  }

  const hoy = hoyISO();
  const filtroUrgencia: Record<Urgencia, string> = {
    vencida:   " AND fecha_proxima_accion IS NOT NULL AND fecha_proxima_accion < ?",
    hoy:       " AND fecha_proxima_accion = ?",
    semana:    " AND fecha_proxima_accion > ? AND fecha_proxima_accion <= ?",
    futuro:    " AND fecha_proxima_accion > ?",
    sin_fecha: " AND fecha_proxima_accion IS NULL",
  };
  if (urgencia) {
    query += filtroUrgencia[urgencia as Urgencia];
    if (urgencia === "vencida" || urgencia === "hoy") args.push(hoy);
    if (urgencia === "semana") args.push(hoy, sumarDias(hoy, 7));
    if (urgencia === "futuro") args.push(sumarDias(hoy, 7));
  }

  // Las fechas nulas van siempre al final, ordene como ordene
  query += ` ORDER BY ${sort} IS NULL, ${sort} ${order}, apellido ASC`;

  try {
    const clientes = getDb().prepare(query).all(...args) as Cliente[];
    return NextResponse.json(clientes);
  } catch (e) {
    return NextResponse.json(
      { error: "No se pudo leer la base", detalle: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

/** POST /api/clientes — crea un registro. */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { ok, errores, data } = validarClienteInput(body, false);
  if (!ok) return NextResponse.json({ error: "Datos inválidos", errores }, { status: 422 });

  try {
    const db = getDb();
    const info = db
      .prepare(
        `INSERT INTO clientes (
           nombre, apellido, email, telefono, fuente, referido_por, etapa, ticket_estimado,
           perfil_riesgo, productos_interes, proxima_accion, fecha_proxima_accion,
           ultima_interaccion, notas
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.nombre, data.apellido, data.email ?? null, data.telefono ?? null,
        data.fuente ?? "Otro", data.referido_por ?? null, data.etapa ?? "Prospecto",
        data.ticket_estimado ?? 0, data.perfil_riesgo ?? null, data.productos_interes ?? null,
        data.proxima_accion ?? null, data.fecha_proxima_accion ?? null,
        data.ultima_interaccion ?? null, data.notas ?? null
      );

    const creado = db.prepare("SELECT * FROM clientes WHERE id = ?").get(info.lastInsertRowid) as Cliente;
    revalidarCrm();
    return NextResponse.json(creado, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "No se pudo crear el cliente", detalle: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
