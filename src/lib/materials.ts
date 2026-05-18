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
