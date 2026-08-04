import { NextRequest, NextResponse } from "next/server";
import { revalidarCrm } from "@/lib/crm-server";
import { actualizarCliente, borrarCliente, obtenerCliente } from "@/lib/crm-db";
import { CAMPOS_EDITABLES, validarClienteInput, type ClienteInput } from "@/lib/crm";

type Ctx = { params: Promise<{ id: string }> };

/** Valida el id de la URL antes de tocar la DB. */
function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function error500(mensaje: string, e: unknown) {
  return NextResponse.json(
    { error: mensaje, detalle: e instanceof Error ? e.message : String(e) },
    { status: 500 }
  );
}

/** GET /api/clientes/[id] */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const id = parseId((await ctx.params).id);
  if (id === null) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  try {
    const cliente = await obtenerCliente(id);
    if (!cliente) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    return NextResponse.json(cliente);
  } catch (e) {
    return error500("No se pudo leer el cliente", e);
  }
}

/** PATCH /api/clientes/[id] — actualiza sólo los campos presentes en el body. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const id = parseId((await ctx.params).id);
  if (id === null) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { ok, errores, data } = validarClienteInput(body, true);
  if (!ok) return NextResponse.json({ error: "Datos inválidos", errores }, { status: 422 });

  // Los nombres de columna salen de CAMPOS_EDITABLES, nunca del body
  const campos = CAMPOS_EDITABLES.filter((c) => c in data);
  if (campos.length === 0) {
    return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
  }

  try {
    const valores = campos.map((c) => (data[c] as ClienteInput[typeof c] | undefined) ?? null);
    const actualizado = await actualizarCliente(id, campos, valores);
    if (!actualizado) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

    revalidarCrm();
    return NextResponse.json(actualizado);
  } catch (e) {
    return error500("No se pudo actualizar el cliente", e);
  }
}

/** DELETE /api/clientes/[id] */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const id = parseId((await ctx.params).id);
  if (id === null) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  try {
    const borrado = await borrarCliente(id);
    if (!borrado) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

    revalidarCrm();
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return error500("No se pudo borrar el cliente", e);
  }
}
