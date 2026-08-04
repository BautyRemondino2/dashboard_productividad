import "server-only";
import path from "path";
import { createClient, type Client, type Row } from "@libsql/client";
import type { Cliente, ClienteInput, Etapa, Fuente, PerfilRiesgo, Urgencia } from "@/lib/crm";
import { sumarDias } from "@/lib/crm";

/**
 * Acceso al CRM. A diferencia del resto del dashboard —que lee un SQLite local
 * con better-sqlite3— los clientes viven en Turso: es el único módulo cuyos
 * datos tienen que sobrevivir al deploy, donde el filesystem es efímero.
 *
 * El mismo cliente sirve para los dos entornos: sin TURSO_DATABASE_URL apunta
 * al archivo local, así que en la máquina se sigue trabajando sin credenciales.
 */
declare global {
  var __crmDb: Client | undefined;
}

export function getCrmDb(): Client {
  if (!global.__crmDb) {
    const url = process.env.TURSO_DATABASE_URL?.trim();
    global.__crmDb = createClient(
      url
        ? { url, authToken: process.env.TURSO_AUTH_TOKEN }
        : { url: `file:${path.join(process.cwd(), "data", "dashboard.db")}` }
    );
  }
  return global.__crmDb;
}

/** True cuando el CRM está apuntando a Turso y no al archivo local. */
export const CRM_REMOTO = Boolean(process.env.TURSO_DATABASE_URL?.trim());

// ── Mapeo ─────────────────────────────────────────────────────────────────────

const texto = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

function mapCliente(row: Row): Cliente {
  return {
    id: Number(row.id),
    nombre: String(row.nombre),
    apellido: String(row.apellido ?? ""),
    email: texto(row.email),
    telefono: texto(row.telefono),
    fuente: String(row.fuente) as Fuente,
    referido_por: texto(row.referido_por),
    etapa: String(row.etapa) as Etapa,
    ticket_estimado: Number(row.ticket_estimado ?? 0),
    perfil_riesgo: texto(row.perfil_riesgo) as PerfilRiesgo | null,
    productos_interes: texto(row.productos_interes),
    proxima_accion: texto(row.proxima_accion),
    fecha_proxima_accion: texto(row.fecha_proxima_accion),
    ultima_interaccion: texto(row.ultima_interaccion),
    notas: texto(row.notas),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

// ── Lecturas ──────────────────────────────────────────────────────────────────

export interface FiltrosClientes {
  etapa?: string;
  fuente?: string;
  urgencia?: Urgencia;
  q?: string;
  sort?: string;
  order?: "ASC" | "DESC";
  hoy: string;
}

/** Columnas admitidas para ordenar: nunca se interpola texto del request. */
export const COLUMNAS_ORDENABLES = [
  "nombre", "apellido", "etapa", "fuente", "ticket_estimado",
  "fecha_proxima_accion", "ultima_interaccion", "created_at", "updated_at",
] as const;

export async function listarClientes(f: FiltrosClientes): Promise<Cliente[]> {
  let sql = "SELECT * FROM clientes WHERE 1=1";
  const args: (string | number)[] = [];

  if (f.etapa) { sql += " AND etapa = ?"; args.push(f.etapa); }
  if (f.fuente) { sql += " AND fuente = ?"; args.push(f.fuente); }

  if (f.q) {
    sql += " AND (nombre LIKE ? OR apellido LIKE ? OR (nombre || ' ' || apellido) LIKE ? OR email LIKE ?)";
    const like = `%${f.q}%`;
    args.push(like, like, like, like);
  }

  if (f.urgencia === "vencida") { sql += " AND fecha_proxima_accion IS NOT NULL AND fecha_proxima_accion < ?"; args.push(f.hoy); }
  if (f.urgencia === "hoy") { sql += " AND fecha_proxima_accion = ?"; args.push(f.hoy); }
  if (f.urgencia === "semana") { sql += " AND fecha_proxima_accion > ? AND fecha_proxima_accion <= ?"; args.push(f.hoy, sumarDias(f.hoy, 7)); }
  if (f.urgencia === "futuro") { sql += " AND fecha_proxima_accion > ?"; args.push(sumarDias(f.hoy, 7)); }
  if (f.urgencia === "sin_fecha") { sql += " AND fecha_proxima_accion IS NULL"; }

  const sort = (COLUMNAS_ORDENABLES as readonly string[]).includes(f.sort ?? "")
    ? f.sort
    : "fecha_proxima_accion";
  const order = f.order === "DESC" ? "DESC" : "ASC";
  sql += ` ORDER BY ${sort} IS NULL, ${sort} ${order}, apellido ASC`;

  const rs = await getCrmDb().execute({ sql, args });
  return rs.rows.map(mapCliente);
}

export async function obtenerCliente(id: number): Promise<Cliente | null> {
  const rs = await getCrmDb().execute({ sql: "SELECT * FROM clientes WHERE id = ?", args: [id] });
  return rs.rows[0] ? mapCliente(rs.rows[0]) : null;
}

/** Vencidas y de hoy, de mayor a menor ticket: lo que alimenta el widget. */
export async function clientesPendientes(hoy: string): Promise<Cliente[]> {
  const rs = await getCrmDb().execute({
    sql: `SELECT * FROM clientes
          WHERE fecha_proxima_accion IS NOT NULL
            AND fecha_proxima_accion <= ?
            AND etapa != 'Descartado'
          ORDER BY ticket_estimado DESC`,
    args: [hoy],
  });
  return rs.rows.map(mapCliente);
}

// ── Escrituras ────────────────────────────────────────────────────────────────

export async function crearCliente(data: Partial<ClienteInput>): Promise<Cliente> {
  const rs = await getCrmDb().execute({
    sql: `INSERT INTO clientes (
            nombre, apellido, email, telefono, fuente, referido_por, etapa, ticket_estimado,
            perfil_riesgo, productos_interes, proxima_accion, fecha_proxima_accion,
            ultima_interaccion, notas
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING *`,
    args: [
      data.nombre ?? "", data.apellido ?? "", data.email ?? null, data.telefono ?? null,
      data.fuente ?? "Otro", data.referido_por ?? null, data.etapa ?? "Prospecto",
      data.ticket_estimado ?? 0, data.perfil_riesgo ?? null, data.productos_interes ?? null,
      data.proxima_accion ?? null, data.fecha_proxima_accion ?? null,
      data.ultima_interaccion ?? null, data.notas ?? null,
    ],
  });
  return mapCliente(rs.rows[0]);
}

/** Devuelve null si el id no existe. Los nombres de columna los pone el caller. */
export async function actualizarCliente(
  id: number,
  campos: readonly string[],
  valores: (string | number | null)[]
): Promise<Cliente | null> {
  const sets = campos.map((c) => `${c} = ?`).join(", ");
  const rs = await getCrmDb().execute({
    sql: `UPDATE clientes SET ${sets}, updated_at = datetime('now') WHERE id = ? RETURNING *`,
    args: [...valores, id],
  });
  return rs.rows[0] ? mapCliente(rs.rows[0]) : null;
}

export async function borrarCliente(id: number): Promise<boolean> {
  const rs = await getCrmDb().execute({ sql: "DELETE FROM clientes WHERE id = ?", args: [id] });
  return rs.rowsAffected > 0;
}
