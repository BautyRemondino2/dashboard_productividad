import { NextRequest, NextResponse } from "next/server";
import { revalidarCrm } from "@/lib/crm-server";
import { COLUMNAS_ORDENABLES, crearCliente, listarClientes } from "@/lib/crm-db";
import {
  ETAPAS, FUENTES, URGENCIAS, hoyISO, validarClienteInput, type Urgencia,
} from "@/lib/crm";

/**
 * GET /api/clientes
 * Filtros: ?etapa=&fuente=&urgencia=&q=&sort=&order=asc|desc
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
  if (!(COLUMNAS_ORDENABLES as readonly string[]).includes(sort)) {
    return NextResponse.json({ error: `sort inválido (opciones: ${COLUMNAS_ORDENABLES.join(", ")})` }, { status: 400 });
  }

  try {
    const clientes = await listarClientes({
      etapa, fuente, q, sort, order,
      urgencia: (urgencia || undefined) as Urgencia | undefined,
      hoy: hoyISO(),
    });
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
    const creado = await crearCliente(data);
    revalidarCrm();
    return NextResponse.json(creado, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "No se pudo crear el cliente", detalle: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
