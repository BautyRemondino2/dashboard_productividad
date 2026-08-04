/**
 * Clases de color del CRM. Viven acá porque las comparten la tabla, el panel de
 * edición y el widget del home: el color de una etapa tiene que ser el mismo en
 * los tres lados.
 */
import type { Etapa, Urgencia } from "@/lib/crm";

/** Badge de etapa: avanza de gris a verde a medida que progresa el funnel. */
export const ETAPA_CLASS: Record<Etapa, string> = {
  "Prospecto":         "border-slate-700 bg-slate-800/50 text-slate-300",
  "Primer contacto":   "border-sky-900/60 bg-sky-950/40 text-sky-300",
  "Reunión agendada":  "border-indigo-900/60 bg-indigo-950/40 text-indigo-300",
  "Propuesta enviada": "border-amber-900/60 bg-amber-950/40 text-amber-300",
  "Cliente activo":    "border-emerald-900/60 bg-emerald-950/40 text-emerald-300",
  "Descartado":        "border-slate-800 bg-slate-900/40 text-slate-600 line-through",
};

/** Color del funnel de Recharts — mismo criterio que los badges. */
export const ETAPA_COLOR: Record<Etapa, string> = {
  "Prospecto":         "oklch(60% 0.02 250)",
  "Primer contacto":   "oklch(62% 0.11 235)",
  "Reunión agendada":  "oklch(60% 0.12 275)",
  "Propuesta enviada": "oklch(72% 0.13 75)",
  "Cliente activo":    "oklch(70% 0.14 160)",
  "Descartado":        "oklch(38% 0.02 250)",
};

/** Badge de urgencia de la próxima acción. */
export const URGENCIA_CLASS: Record<Urgencia, string> = {
  vencida:   "border-red-900/60 bg-red-950/40 text-red-300",
  hoy:       "border-amber-900/60 bg-amber-950/40 text-amber-300",
  semana:    "border-yellow-900/50 bg-yellow-950/30 text-yellow-400/90",
  futuro:    "border-slate-800 bg-slate-900/40 text-slate-400",
  sin_fecha: "border-slate-800/60 bg-transparent text-slate-600",
};

/** Punto de color para listas compactas (widget del home). */
export const URGENCIA_DOT: Record<Urgencia, string> = {
  vencida:   "bg-red-400",
  hoy:       "bg-amber-400",
  semana:    "bg-yellow-500",
  futuro:    "bg-slate-600",
  sin_fecha: "bg-slate-700",
};

export const BADGE_BASE =
  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] whitespace-nowrap";
