/**
 * Persistencia de Morning Brief: agenda, clientes y la fila diaria del brief.
 *
 * Separado del cálculo (`morning-brief-datos.ts`) y de la llamada a Claude
 * (`morning-brief-claude.ts`) por la misma razón que `equity-ficha-db.ts`:
 * acá vive `better-sqlite3`.
 */
import { getDb } from "@/lib/db";
import { localDateStr } from "@/lib/utils";
import type {
  Advertencia,
  BriefClaude,
  EvaluacionBrief,
  EventoCliente,
  SnapshotBrief,
  TenenciaCliente,
} from "@/lib/morning-brief-tipos";

// ─── Agenda ──────────────────────────────────────────────────────────────────

export interface AgendaItem {
  id: number;
  fecha: string;
  hora_art: string;
  evento: string;
  consenso: string | null;
  anterior: string | null;
  dato: string | null;
  created_at: string;
}

export function listarAgenda(fecha?: string): AgendaItem[] {
  const db = getDb();
  if (fecha) {
    return db
      .prepare("SELECT * FROM morning_brief_agenda WHERE fecha = ? ORDER BY hora_art ASC")
      .all(fecha) as AgendaItem[];
  }
  // Sin fecha: la agenda de hoy hacia adelante, para gestionarla desde la UI.
  return db
    .prepare("SELECT * FROM morning_brief_agenda WHERE fecha >= ? ORDER BY fecha ASC, hora_art ASC")
    .all(localDateStr(-1)) as AgendaItem[];
}

export function agregarAgendaItem(data: {
  fecha: string;
  hora_art: string;
  evento: string;
  consenso: string | null;
  anterior: string | null;
  dato: string | null;
}) {
  getDb()
    .prepare(
      `INSERT INTO morning_brief_agenda (fecha, hora_art, evento, consenso, anterior, dato)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(data.fecha, data.hora_art, data.evento, data.consenso, data.anterior, data.dato);
}

export function editarAgendaItem(
  id: number,
  data: Partial<{ hora_art: string; evento: string; consenso: string | null; anterior: string | null; dato: string | null }>
) {
  const actual = getDb().prepare("SELECT * FROM morning_brief_agenda WHERE id = ?").get(id) as
    | AgendaItem
    | undefined;
  if (!actual) return;
  const next = { ...actual, ...data };
  getDb()
    .prepare(
      `UPDATE morning_brief_agenda SET hora_art = ?, evento = ?, consenso = ?, anterior = ?, dato = ? WHERE id = ?`
    )
    .run(next.hora_art, next.evento, next.consenso, next.anterior, next.dato, id);
}

export function borrarAgendaItem(id: number) {
  getDb().prepare("DELETE FROM morning_brief_agenda WHERE id = ?").run(id);
}

// ─── Clientes ────────────────────────────────────────────────────────────────

export interface ClienteBrief {
  id: number;
  alias: string;
  perfil: string;
  tenencias: TenenciaCliente[];
  eventos: EventoCliente[];
  activo: boolean;
  created_at: string;
}

interface FilaCliente {
  id: number;
  alias: string;
  perfil: string;
  tenencias_json: string;
  eventos_json: string;
  activo: number;
  created_at: string;
}

function parseArray<T>(json: string): T[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function hidratarCliente(f: FilaCliente): ClienteBrief {
  return {
    id: f.id,
    alias: f.alias,
    perfil: f.perfil,
    tenencias: parseArray<TenenciaCliente>(f.tenencias_json),
    eventos: parseArray<EventoCliente>(f.eventos_json),
    activo: f.activo === 1,
    created_at: f.created_at,
  };
}

export function listarClientes(soloActivos = false): ClienteBrief[] {
  const db = getDb();
  const filas = (
    soloActivos
      ? db.prepare("SELECT * FROM morning_brief_clientes WHERE activo = 1 ORDER BY alias").all()
      : db.prepare("SELECT * FROM morning_brief_clientes ORDER BY alias").all()
  ) as FilaCliente[];
  return filas.map(hidratarCliente);
}

export function guardarCliente(data: {
  alias: string;
  perfil: string;
  tenencias: TenenciaCliente[];
  eventos: EventoCliente[];
}): { ok: boolean; error?: string } {
  const alias = data.alias.trim();
  if (!alias) return { ok: false, error: "El alias es obligatorio" };
  try {
    getDb()
      .prepare(
        `INSERT INTO morning_brief_clientes (alias, perfil, tenencias_json, eventos_json)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(alias) DO UPDATE SET
           perfil = excluded.perfil,
           tenencias_json = excluded.tenencias_json,
           eventos_json = excluded.eventos_json`
      )
      .run(alias, data.perfil.trim(), JSON.stringify(data.tenencias), JSON.stringify(data.eventos));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function toggleCliente(id: number, activo: boolean) {
  getDb().prepare("UPDATE morning_brief_clientes SET activo = ? WHERE id = ?").run(activo ? 1 : 0, id);
}

export function borrarCliente(id: number) {
  getDb().prepare("DELETE FROM morning_brief_clientes WHERE id = ?").run(id);
}

// ─── El brief diario ─────────────────────────────────────────────────────────

export interface BriefRow {
  fecha: string;
  tesis_propia: string | null;
  snapshot: SnapshotBrief | null;
  brief: BriefClaude | null;
  advertencias: Advertencia[];
  cierre: Record<string, unknown> | null;
  evaluacion: EvaluacionBrief | null;
  aciertos: number | null;
  total_predicciones: number | null;
  tesis_acierto: "si" | "parcial" | "no" | null;
  aprendizaje: string | null;
  created_at: string;
}

interface FilaBrief {
  fecha: string;
  tesis_propia: string | null;
  snapshot_json: string | null;
  brief_json: string | null;
  advertencias_json: string | null;
  cierre_json: string | null;
  evaluacion_json: string | null;
  aciertos: number | null;
  total_predicciones: number | null;
  tesis_acierto: "si" | "parcial" | "no" | null;
  aprendizaje: string | null;
  created_at: string;
}

function parseOrNull<T>(json: string | null): T | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function hidratarBrief(f: FilaBrief): BriefRow {
  return {
    fecha: f.fecha,
    tesis_propia: f.tesis_propia,
    snapshot: parseOrNull<SnapshotBrief>(f.snapshot_json),
    brief: parseOrNull<BriefClaude>(f.brief_json),
    advertencias: parseOrNull<Advertencia[]>(f.advertencias_json) ?? [],
    cierre: parseOrNull<Record<string, unknown>>(f.cierre_json),
    evaluacion: parseOrNull<EvaluacionBrief>(f.evaluacion_json),
    aciertos: f.aciertos,
    total_predicciones: f.total_predicciones,
    tesis_acierto: f.tesis_acierto,
    aprendizaje: f.aprendizaje,
    created_at: f.created_at,
  };
}

export function getBrief(fecha: string): BriefRow | null {
  const fila = getDb().prepare("SELECT * FROM morning_briefs WHERE fecha = ?").get(fecha) as
    | FilaBrief
    | undefined;
  return fila ? hidratarBrief(fila) : null;
}

/** Crea o actualiza la tesis propia del día — es lo que desbloquea el resto. */
export function guardarTesisPropia(fecha: string, texto: string) {
  getDb()
    .prepare(
      `INSERT INTO morning_briefs (fecha, tesis_propia) VALUES (?, ?)
       ON CONFLICT(fecha) DO UPDATE SET tesis_propia = excluded.tesis_propia`
    )
    .run(fecha, texto.trim());
}

export function guardarBriefGenerado(
  fecha: string,
  snapshot: SnapshotBrief,
  brief: BriefClaude,
  advertencias: Advertencia[]
) {
  getDb()
    .prepare(
      `INSERT INTO morning_briefs (fecha, snapshot_json, brief_json, advertencias_json)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(fecha) DO UPDATE SET
         snapshot_json = excluded.snapshot_json,
         brief_json = excluded.brief_json,
         advertencias_json = excluded.advertencias_json`
    )
    .run(fecha, JSON.stringify(snapshot), JSON.stringify(brief), JSON.stringify(advertencias));
}

export function guardarEvaluacion(
  fecha: string,
  cierre: Record<string, unknown>,
  evaluacion: EvaluacionBrief,
  aciertos: number,
  total: number
) {
  getDb()
    .prepare(
      `INSERT INTO morning_briefs (fecha, cierre_json, evaluacion_json, aciertos, total_predicciones)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(fecha) DO UPDATE SET
         cierre_json = excluded.cierre_json,
         evaluacion_json = excluded.evaluacion_json,
         aciertos = excluded.aciertos,
         total_predicciones = excluded.total_predicciones`
    )
    .run(fecha, JSON.stringify(cierre), JSON.stringify(evaluacion), aciertos, total);
}

export function guardarAprendizaje(fecha: string, texto: string) {
  getDb()
    .prepare(
      `INSERT INTO morning_briefs (fecha, aprendizaje) VALUES (?, ?)
       ON CONFLICT(fecha) DO UPDATE SET aprendizaje = excluded.aprendizaje`
    )
    .run(fecha, texto.trim());
}

/**
 * Autoevaluación del asesor sobre su propia tesis del día. La tesis es prosa
 * libre — no hay forma de calificarla en código, así que la carga el propio
 * asesor al evaluar el cierre. Alimenta "mi tasa de aciertos" del historial.
 */
export function guardarTesisAcierto(fecha: string, valor: "si" | "parcial" | "no") {
  getDb()
    .prepare(
      `INSERT INTO morning_briefs (fecha, tesis_acierto) VALUES (?, ?)
       ON CONFLICT(fecha) DO UPDATE SET tesis_acierto = excluded.tesis_acierto`
    )
    .run(fecha, valor);
}

/** Historial para la tabla de aciertos — más nuevo primero. */
export function listarHistorial(limite = 60): BriefRow[] {
  const filas = getDb()
    .prepare(
      `SELECT * FROM morning_briefs WHERE brief_json IS NOT NULL ORDER BY fecha DESC LIMIT ?`
    )
    .all(limite) as FilaBrief[];
  return filas.map(hidratarBrief);
}
