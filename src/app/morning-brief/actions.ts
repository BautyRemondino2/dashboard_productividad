"use server";

import { revalidatePath } from "next/cache";
import { construirSnapshot } from "@/lib/morning-brief-snapshot";
import { generarBrief as generarBriefConClaude } from "@/lib/morning-brief-claude";
import { validarBrief } from "@/lib/morning-brief-validacion";
import { evaluarPredicciones } from "@/lib/morning-brief-evaluacion";
import {
  agregarAgendaItem,
  borrarAgendaItem,
  borrarCliente,
  editarAgendaItem,
  getBrief,
  guardarAprendizaje,
  guardarBriefGenerado,
  guardarCliente,
  guardarEvaluacion,
  guardarTesisAcierto,
  guardarTesisPropia,
  toggleCliente,
} from "@/lib/morning-brief-db";
import type { EventoCliente, TenenciaCliente } from "@/lib/morning-brief-tipos";

const PATH = "/morning-brief";

// ── Tesis y generación ───────────────────────────────────────────────────────

export async function guardarTesisPropiaAction(fecha: string, texto: string): Promise<{ ok: boolean; error?: string }> {
  if (!texto.trim()) return { ok: false, error: "Escribí la tesis antes de guardar" };
  guardarTesisPropia(fecha, texto);
  revalidatePath(PATH);
  return { ok: true };
}

export async function generarBriefAction(): Promise<{ ok: boolean; error?: string }> {
  try {
    const snapshot = await construirSnapshot();
    const brief = await generarBriefConClaude(snapshot);
    const advertencias = validarBrief(brief, snapshot);
    guardarBriefGenerado(snapshot.fecha, snapshot, brief, advertencias);
    revalidatePath(PATH);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function evaluarCierreAction(fecha: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const row = getBrief(fecha);
    if (!row?.brief) return { ok: false, error: "Todavía no hay un brief generado para esa fecha" };

    const { cierre, evaluacion, aciertos, total } = await evaluarPredicciones(row.brief.predicciones);
    guardarEvaluacion(fecha, cierre, evaluacion, aciertos, total);
    revalidatePath(PATH);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function guardarAprendizajeAction(fecha: string, texto: string) {
  guardarAprendizaje(fecha, texto);
  revalidatePath(PATH);
}

export async function guardarTesisAciertoAction(fecha: string, valor: "si" | "parcial" | "no") {
  guardarTesisAcierto(fecha, valor);
  revalidatePath(PATH);
}

// ── Agenda ────────────────────────────────────────────────────────────────────

export async function agregarAgendaAction(data: {
  fecha: string;
  hora_art: string;
  evento: string;
  consenso: string;
  anterior: string;
  dato: string;
}) {
  if (!data.fecha || !data.evento.trim()) return;
  agregarAgendaItem({
    fecha: data.fecha,
    hora_art: data.hora_art.trim() || "—",
    evento: data.evento.trim(),
    consenso: data.consenso.trim() || null,
    anterior: data.anterior.trim() || null,
    dato: data.dato.trim() || null,
  });
  revalidatePath(PATH);
}

export async function editarAgendaAction(
  id: number,
  data: { hora_art: string; evento: string; consenso: string; anterior: string; dato: string }
) {
  editarAgendaItem(id, {
    hora_art: data.hora_art.trim() || "—",
    evento: data.evento.trim(),
    consenso: data.consenso.trim() || null,
    anterior: data.anterior.trim() || null,
    dato: data.dato.trim() || null,
  });
  revalidatePath(PATH);
}

export async function borrarAgendaAction(id: number) {
  borrarAgendaItem(id);
  revalidatePath(PATH);
}

// ── Clientes ──────────────────────────────────────────────────────────────────

export async function guardarClienteAction(data: {
  alias: string;
  perfil: string;
  tenencias: TenenciaCliente[];
  eventos: EventoCliente[];
}): Promise<{ ok: boolean; error?: string }> {
  const r = guardarCliente(data);
  if (r.ok) revalidatePath(PATH);
  return r;
}

export async function toggleClienteAction(id: number, activo: boolean) {
  toggleCliente(id, activo);
  revalidatePath(PATH);
}

export async function borrarClienteAction(id: number) {
  borrarCliente(id);
  revalidatePath(PATH);
}
