/** Tipos, constantes y helpers puros del CRM. Los comparten API y frontend. */

export const FUENTES = ["UdeSA", "Referido", "NewsFolio", "Contenido", "Frío", "Otro"] as const;
export type Fuente = (typeof FUENTES)[number];

/** El orden importa: es el orden del funnel, de arriba hacia abajo. */
export const ETAPAS = [
  "Prospecto",
  "Primer contacto",
  "Reunión agendada",
  "Propuesta enviada",
  "Cliente activo",
  "Descartado",
] as const;
export type Etapa = (typeof ETAPAS)[number];

export const PERFILES_RIESGO = ["Conservador", "Moderado", "Agresivo"] as const;
export type PerfilRiesgo = (typeof PERFILES_RIESGO)[number];

export interface Cliente {
  id: number;
  nombre: string;
  apellido: string;
  email: string | null;
  telefono: string | null;
  fuente: Fuente;
  referido_por: string | null;
  etapa: Etapa;
  ticket_estimado: number;
  perfil_riesgo: PerfilRiesgo | null;
  productos_interes: string | null;
  proxima_accion: string | null;
  /** YYYY-MM-DD */
  fecha_proxima_accion: string | null;
  /** YYYY-MM-DD */
  ultima_interaccion: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

/** Campos que aceptan POST y PATCH: todo menos los que maneja la DB. */
export type ClienteInput = Omit<Cliente, "id" | "created_at" | "updated_at">;

export const CAMPOS_EDITABLES = [
  "nombre", "apellido", "email", "telefono", "fuente", "referido_por", "etapa",
  "ticket_estimado", "perfil_riesgo", "productos_interes", "proxima_accion",
  "fecha_proxima_accion", "ultima_interaccion", "notas",
] as const satisfies readonly (keyof ClienteInput)[];

// ── Urgencia de la próxima acción ─────────────────────────────────────────────

export const URGENCIAS = ["vencida", "hoy", "semana", "futuro", "sin_fecha"] as const;
export type Urgencia = (typeof URGENCIAS)[number];

export const URGENCIA_LABEL: Record<Urgencia, string> = {
  vencida:   "Vencida",
  hoy:       "Hoy",
  semana:    "Esta semana",
  futuro:    "Más adelante",
  sin_fecha: "Sin fecha",
};

/**
 * Clasifica una fecha contra el día de hoy. Se compara como string YYYY-MM-DD
 * para no arrastrar zonas horarias: la fecha de una acción es un día del
 * calendario, no un instante.
 */
export function urgenciaDe(fecha: string | null | undefined, hoy: string): Urgencia {
  if (!fecha) return "sin_fecha";
  if (fecha < hoy) return "vencida";
  if (fecha === hoy) return "hoy";
  return fecha <= sumarDias(hoy, 7) ? "semana" : "futuro";
}

/** hoy en formato YYYY-MM-DD según la hora local del navegador/servidor. */
export function hoyISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function sumarDias(fechaISO: string, dias: number): string {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const base = new Date(y, m - 1, d);
  base.setDate(base.getDate() + dias);
  return hoyISO(base);
}

/** "hace 3 días" / "en 5 días" — para la columna de próxima acción. */
export function diasRelativos(fecha: string, hoy: string): string {
  const [y1, m1, d1] = hoy.split("-").map(Number);
  const [y2, m2, d2] = fecha.split("-").map(Number);
  const dias = Math.round(
    (new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86_400_000
  );
  if (dias === 0) return "hoy";
  if (dias === 1) return "mañana";
  if (dias === -1) return "ayer";
  return dias > 0 ? `en ${dias} días` : `hace ${Math.abs(dias)} días`;
}

// ── Métricas ──────────────────────────────────────────────────────────────────

export interface MetricasCrm {
  porEtapa: { etapa: Etapa; cantidad: number }[];
  /** Suma de tickets de todo lo que sigue vivo (excluye Descartado). */
  aumPotencial: number;
  /** Suma de tickets de los que ya son clientes. */
  aumActivo: number;
  /** activos / trabajados, en 0..1. */
  tasaConversion: number;
  /** Denominador de la conversión: los que salieron de Prospecto. */
  trabajados: number;
  activos: number;
  total: number;
}

/**
 * "Trabajados" son los que pasaron de Prospecto en algún momento, incluidos los
 * descartados: la conversión mide qué porcentaje de los contactos efectivamente
 * trabajados terminó siendo cliente. Los que siguen en Prospecto todavía no
 * tuvieron su chance, así que no ensucian el denominador.
 */
export function computeMetricas(clientes: Cliente[]): MetricasCrm {
  const porEtapa = ETAPAS.map((etapa) => ({
    etapa,
    cantidad: clientes.filter((c) => c.etapa === etapa).length,
  }));

  const aumPotencial = clientes
    .filter((c) => c.etapa !== "Descartado")
    .reduce((acc, c) => acc + c.ticket_estimado, 0);

  const activosList = clientes.filter((c) => c.etapa === "Cliente activo");
  const aumActivo = activosList.reduce((acc, c) => acc + c.ticket_estimado, 0);

  const trabajados = clientes.filter((c) => c.etapa !== "Prospecto").length;

  return {
    porEtapa,
    aumPotencial,
    aumActivo,
    tasaConversion: trabajados > 0 ? activosList.length / trabajados : 0,
    trabajados,
    activos: activosList.length,
    total: clientes.length,
  };
}

// ── Formato ───────────────────────────────────────────────────────────────────

export function formatUSD(valor: number): string {
  return `US$${valor.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

/** Montos grandes en los tiles: US$1,2M / US$450k. */
export function formatUSDCorto(valor: number): string {
  if (Math.abs(valor) >= 1_000_000) {
    return `US$${(valor / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })}M`;
  }
  if (Math.abs(valor) >= 1_000) {
    return `US$${(valor / 1_000).toLocaleString("es-AR", { maximumFractionDigits: 0 })}k`;
  }
  return formatUSD(valor);
}

export function nombreCompleto(c: Pick<Cliente, "nombre" | "apellido">): string {
  return `${c.nombre} ${c.apellido}`.trim();
}

// ── CSV ───────────────────────────────────────────────────────────────────────

const COLUMNAS_CSV = [
  "id", "nombre", "apellido", "email", "telefono", "fuente", "referido_por",
  "etapa", "ticket_estimado", "perfil_riesgo", "productos_interes",
  "proxima_accion", "fecha_proxima_accion", "ultima_interaccion", "notas",
  "created_at", "updated_at",
] as const satisfies readonly (keyof Cliente)[];

function celdaCsv(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  const s = String(valor);
  // Comillas, comas y saltos de línea obligan a citar el campo
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV con BOM: sin él Excel en Windows rompe los acentos. */
export function clientesToCsv(clientes: Cliente[]): string {
  const filas = clientes.map((c) => COLUMNAS_CSV.map((col) => celdaCsv(c[col])).join(","));
  return "\uFEFF" + [COLUMNAS_CSV.join(","), ...filas].join("\r\n");
}

// ── Validación (la usan los route handlers) ───────────────────────────────────

export interface ResultadoValidacion {
  ok: boolean;
  errores: string[];
  data: Partial<ClienteInput>;
}

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function textoOpcional(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/**
 * Valida el body de POST/PATCH. En modo parcial (PATCH) sólo mira los campos
 * presentes; en modo completo exige nombre y apellido. Ignora cualquier campo
 * que no esté en CAMPOS_EDITABLES en vez de fallar: así el front puede mandar
 * el objeto entero sin filtrar id/created_at.
 */
export function validarClienteInput(body: unknown, parcial: boolean): ResultadoValidacion {
  const errores: string[] = [];
  const data: Partial<ClienteInput> = {};

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, errores: ["El body tiene que ser un objeto JSON"], data };
  }
  const raw = body as Record<string, unknown>;
  const presente = (campo: string) => Object.prototype.hasOwnProperty.call(raw, campo);

  if (presente("nombre") || !parcial) {
    const nombre = textoOpcional(raw.nombre);
    if (!nombre) errores.push("nombre es obligatorio");
    else data.nombre = nombre;
  }

  if (presente("apellido") || !parcial) {
    const apellido = textoOpcional(raw.apellido);
    if (!apellido) errores.push("apellido es obligatorio");
    else data.apellido = apellido;
  }

  if (presente("email")) {
    const email = textoOpcional(raw.email);
    if (email && !RE_EMAIL.test(email)) errores.push("email inválido");
    else data.email = email;
  }

  if (presente("telefono")) data.telefono = textoOpcional(raw.telefono);
  if (presente("referido_por")) data.referido_por = textoOpcional(raw.referido_por);
  if (presente("productos_interes")) data.productos_interes = textoOpcional(raw.productos_interes);
  if (presente("proxima_accion")) data.proxima_accion = textoOpcional(raw.proxima_accion);
  if (presente("notas")) data.notas = textoOpcional(raw.notas);

  if (presente("fuente") || !parcial) {
    const fuente = textoOpcional(raw.fuente) ?? "Otro";
    if (!(FUENTES as readonly string[]).includes(fuente)) {
      errores.push(`fuente inválida (opciones: ${FUENTES.join(", ")})`);
    } else {
      data.fuente = fuente as Fuente;
    }
  }

  if (presente("etapa") || !parcial) {
    const etapa = textoOpcional(raw.etapa) ?? "Prospecto";
    if (!(ETAPAS as readonly string[]).includes(etapa)) {
      errores.push(`etapa inválida (opciones: ${ETAPAS.join(", ")})`);
    } else {
      data.etapa = etapa as Etapa;
    }
  }

  if (presente("perfil_riesgo")) {
    const perfil = textoOpcional(raw.perfil_riesgo);
    if (perfil !== null && !(PERFILES_RIESGO as readonly string[]).includes(perfil)) {
      errores.push(`perfil_riesgo inválido (opciones: ${PERFILES_RIESGO.join(", ")})`);
    } else {
      data.perfil_riesgo = perfil as PerfilRiesgo | null;
    }
  }

  if (presente("ticket_estimado") || !parcial) {
    const bruto = raw.ticket_estimado;
    const ticket = bruto === null || bruto === undefined || bruto === "" ? 0 : Number(bruto);
    if (!Number.isFinite(ticket) || ticket < 0) errores.push("ticket_estimado tiene que ser un número >= 0");
    else data.ticket_estimado = ticket;
  }

  for (const campo of ["fecha_proxima_accion", "ultima_interaccion"] as const) {
    if (!presente(campo)) continue;
    const fecha = textoOpcional(raw[campo]);
    if (fecha !== null && !RE_FECHA.test(fecha)) errores.push(`${campo} tiene que ser YYYY-MM-DD`);
    else data[campo] = fecha;
  }

  return { ok: errores.length === 0, errores, data };
}
