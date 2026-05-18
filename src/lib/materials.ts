import type { MaterialKind } from "@/lib/types";

/** Infer the material kind from filename + extension. */
export function inferMaterialKind(filename: string): MaterialKind {
  const lower = filename.toLowerCase();
  const ext = lower.split(".").pop() ?? "";

  // Extension takes precedence for unambiguous types
  if (["xlsx", "xls", "xlsm", "csv", "tsv"].includes(ext)) return "excel";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "imagen";
  if (["md", "txt"].includes(ext)) return "notas";

  // Filename keyword hints
  const hasKw = (kws: string[]) => kws.some(k => lower.includes(k));

  if (hasKw(["ejercicio", "ejer", "tp", "trabajo-practico", "trabajo_practico", "practica", "práctica", "guia", "guía"])) {
    return "ejercicio";
  }
  if (hasKw(["lectura", "paper", "libro", "biblio", "bibliografia", "bibliografía"])) {
    return "lectura";
  }
  if (hasKw(["slide", "slides", "presentacion", "presentación", "clase", "teorica", "teórica"])) {
    return "slide";
  }

  // Fallback by extension
  if (["pdf", "pptx", "ppt"].includes(ext)) return "slide";
  if (["docx", "doc"].includes(ext)) return "ejercicio";

  return "otro";
}

/** Map a kind to a Spanish label for the UI. */
export const MATERIAL_KIND_LABEL: Record<MaterialKind, string> = {
  slide:     "Slide",
  ejercicio: "Ejercicio",
  excel:     "Excel",
  lectura:   "Lectura",
  notas:     "Notas",
  imagen:    "Imagen",
  otro:      "Otro",
};

/** Tailwind class hints per kind (background, border, text). */
export const MATERIAL_KIND_STYLE: Record<MaterialKind, string> = {
  slide:     "bg-violet-950/40 border-violet-800/60 text-violet-300",
  ejercicio: "bg-amber-950/40 border-amber-800/60 text-amber-300",
  excel:     "bg-emerald-950/40 border-emerald-800/60 text-emerald-300",
  lectura:   "bg-blue-950/40 border-blue-800/60 text-blue-300",
  notas:     "bg-slate-800/60 border-slate-700 text-slate-300",
  imagen:    "bg-pink-950/40 border-pink-800/60 text-pink-300",
  otro:      "bg-slate-800/60 border-slate-700 text-slate-400",
};

/** Parse a class folder name like "Clase 04 - Black-Scholes" → { week, title }. */
export function parseClassFolder(name: string): { week: number | null; title: string } {
  const trimmed = name.trim();

  // Try to extract first integer
  const numMatch = /(\d{1,2})/.exec(trimmed);
  const week = numMatch ? parseInt(numMatch[1], 10) : null;

  // Strip common prefixes (Clase, Semana, Class, T, S) and the number
  let title = trimmed
    .replace(/^(clase|semana|class|módulo|modulo|unidad|tema|t|s|u|m)\s*\.?\s*\d+\s*[-:_–—.]?\s*/i, "")
    .replace(/^\d+\s*[-:_–—.]?\s*/, "")
    .trim();

  // If after stripping we got nothing, leave as the original (minus number if any)
  if (!title) title = trimmed.replace(/\d+/, "").replace(/^[\s\-_:.]+/, "").trim();
  if (!title) title = trimmed;

  return { week, title };
}

/** Sanitize a filename for filesystem (strip path traversal, normalize spaces). */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/\\/g, "/")
    .split("/")
    .pop()!                       // strip directory
    .replace(/[^\w.\-() áéíóúüñÁÉÍÓÚÜÑ]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

/** Format bytes as human-readable size. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** Allowed extensions for uploads. */
export const ALLOWED_EXTS = new Set([
  "pdf", "pptx", "ppt", "docx", "doc",
  "xlsx", "xls", "xlsm", "csv", "tsv",
  "png", "jpg", "jpeg", "gif", "webp", "svg",
  "md", "txt", "rtf",
  "zip",
]);

export function isAllowedFile(filename: string): boolean {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return ALLOWED_EXTS.has(ext);
}

/** Default prompt template per material kind. Used by the "Preguntar a Claude" button. */
export function buildClaudePrompt(kind: MaterialKind, filename: string, subjectName: string): string {
  const fileLine = `Archivo adjunto: ${filename} · materia: ${subjectName}`;

  switch (kind) {
    case "slide":
      return `${fileLine}

Te paso las slides de esta clase. Hacé un repaso estructurado para llevarme los conceptos claros:

1. **Conceptos clave** (5-8 bullets puntuales con los puntos centrales)
2. **Fórmulas / expresiones** importantes (en LaTeX si aplica)
3. **Aplicaciones prácticas** (2-3 ejemplos o casos donde se usa)
4. **Checklist para el examen** (5 ítems con lo que tengo que dominar)

Sé conciso y específico — citá modelos, fórmulas exactas y nombres concretos. No pongas introducciones ni cierres genéricos.`;

    case "ejercicio":
      return `${fileLine}

Te paso una guía/TP de ejercicios. Por cada ejercicio:

1. Identificá qué concepto se está evaluando
2. Resolvelo paso a paso, mostrando las cuentas
3. Explicá el razonamiento detrás de cada paso (qué fórmula aplicás y por qué)
4. Al final, agregá un mini-tip de qué errores típicos hay que evitar en ese tipo de problema

Si hay enunciados que no se entienden bien, marcalos y resolvelos asumiendo lo más probable.`;

    case "excel":
      return `${fileLine}

Te paso una planilla. Analizala y contame:

1. Qué representa cada columna/hoja
2. Qué fórmulas o modelos están aplicados (escribilas en LaTeX si son relevantes)
3. Qué conclusiones se pueden sacar de los datos
4. Cómo replicar este mismo análisis desde cero si me lo piden en un parcial

Sé concreto con los números — citá valores específicos cuando aporten.`;

    case "lectura":
      return `${fileLine}

Te paso una lectura/paper. Hacé un resumen útil para estudio:

1. **Tesis central** (1-2 oraciones)
2. **Argumentos principales** (3-5 bullets)
3. **Datos / evidencia / modelos** que el autor usa para sostener su tesis
4. **Limitaciones o críticas** que el autor reconoce o que vos identifiques
5. **Tres preguntas tipo examen** que se podrían hacer sobre este material

Citá página o sección cuando sea relevante.`;

    case "notas":
      return `${fileLine}

Te paso mis notas de clase. Ordenamelas y completá lo que falte:

1. Reescribilas en formato limpio (bullets jerárquicos)
2. Donde haya conceptos sueltos, agregá una breve explicación
3. Si veo fórmulas a medias, completá la fórmula correcta en LaTeX
4. Al final, marcá los puntos donde mis notas se ven incompletas o confusas para que las repase

No agregues contenido que no esté implícito en mis notas — solo organizá y aclará.`;

    case "imagen":
      return `${fileLine}

Te paso una imagen del material de clase (puede ser una foto del pizarrón, un gráfico, una diapositiva). Describime con detalle:

1. Qué muestra (modelo, gráfico, ecuación, esquema)
2. Cómo se interpreta paso a paso
3. Cómo se aplica en un problema típico
4. Si hay fórmulas, escribilas en LaTeX`;

    case "otro":
    default:
      return `${fileLine}

Te paso este material. Hacé un resumen útil para estudio:

1. Qué contiene este archivo y de qué tema trata
2. Conceptos / fórmulas / datos clave (en LaTeX si aplica)
3. Cómo conecta con el resto de la materia
4. Tres ítems para repasar antes del examen`;
  }
}

