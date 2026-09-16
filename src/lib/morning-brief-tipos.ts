/**
 * Morning Brief — tipos compartidos entre snapshot, Claude, validación,
 * evaluación y persistencia. Separado para que ningún módulo tenga que
 * importar al otro sólo por un tipo.
 */
import type { IndicadorBrief } from "@/lib/morning-brief-datos";

export interface TenenciaCliente {
  ticker: string;
  descripcion: string;
}

export interface EventoCliente {
  fecha: string;
  descripcion: string;
}

export interface ClienteSnapshot {
  alias: string;
  perfil: string;
  tenencias: TenenciaCliente[];
  eventos: EventoCliente[];
}

export interface AgendaSnapshot {
  hora_art: string;
  evento: string;
  consenso: string | null;
  anterior: string | null;
  dato: string | null;
}

/** Lo único que Claude recibe: nunca busca datos, sólo interpreta esto. */
export interface SnapshotBrief {
  fecha: string;
  hora: string;
  indicadores: IndicadorBrief[];
  agenda: AgendaSnapshot[];
  clientes: ClienteSnapshot[];
}

// ─── Lo que devuelve Claude ──────────────────────────────────────────────────

export interface PasoBrief {
  paso: string;
  lectura: string;
  evidencia: string[];
}

export interface ArgentinaBrief {
  lectura: string;
  evidencia: string[];
}

export interface AgendaBrief {
  hora_art: string;
  evento: string;
  por_que_importa: string;
}

export interface ContactoBrief {
  alias: string;
  motivo: string;
  evidencia: string[];
}

export type DireccionPrediccion = "sube" | "baja" | "estable";

export interface PrediccionBrief {
  enunciado: string;
  indicador: string;
  direccion: DireccionPrediccion;
}

export interface BriefClaude {
  regimen: string;
  titular: string;
  cadena: PasoBrief[];
  argentina: ArgentinaBrief;
  agenda: AgendaBrief[];
  contactos: ContactoBrief[];
  tesis: string;
  predicciones: PrediccionBrief[];
  datos_faltantes: string[];
}

// ─── Validación ──────────────────────────────────────────────────────────────

export interface Advertencia {
  tipo: "id_inexistente" | "id_sin_valor" | "id_desactualizado" | "alias_inexistente";
  mensaje: string;
}

// ─── Evaluación al cierre ────────────────────────────────────────────────────

export interface EvaluacionPrediccion {
  enunciado: string;
  indicador: string;
  direccion_predicha: DireccionPrediccion;
  direccion_real: DireccionPrediccion | null;
  acierto: boolean | null;
}

export interface EvaluacionBrief {
  predicciones: EvaluacionPrediccion[];
}
