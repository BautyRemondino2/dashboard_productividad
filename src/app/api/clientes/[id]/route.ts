import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { revalidarCrm } from "@/lib/crm-server";
import { CAMPOS_EDITABLES, validarClienteInput, type Cliente } from "@/lib/crm";

type Ctx = { params: Promise<{ id: string }> };

/** Valida el id de la URL antes de tocar la DB. */
function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function buscar(id: number): Cliente | undefined {
  return getDb().prepare("SELECT * FROM clientes WHERE id = ?").get(id) as Cliente | undefined;
}

/** GET /api/clientes/[id] */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const id = parseId((await ctx.params).id);
  if (id === null) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  try {
    const cliente = buscar(id);
    if (!cliente) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    return NextResponse.json(cliente);
  } catch (e) {
    return NextResponse.json(
      { error: "No se pudo leer el cliente", detalle: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
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

  const campos = CAMPOS_EDITABLES.filter((c) => c in data);
  if (campos.length === 0) {
    return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
  }

  try {
    if (!buscar(id)) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

    // Los nombres de columna salen de CAMPOS_EDITABLES, nunca del body
    const sets = campos.map((c) => `${c} = ?`).join(", ");
    const valores = campos.map((c) => data[c] ?? null);
    getDb()
      .prepare(`UPDATE clientes SET ${sets}, updated_at = datetime('now') WHERE id = ?`)
      .run(...valores, id);

    revalidarCrm();
    return NextResponse.json(buscar(id));
  } catch (e) {
    return NextResponse.json(
      { error: "No se pudo actualizar el cliente", detalle: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

/** DELETE /api/clientes/[id] */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const id = parseId((await ctx.params).id);
  if (id === null) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  try {
    const info = getDb().prepare("DELETE FROM clientes WHERE id = ?").run(id);
    if (info.changes === 0) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

    revalidarCrm();
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json(
      { error: "No se pudo borrar el cliente", detalle: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
