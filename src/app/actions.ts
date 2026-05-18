"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import type { Priority, MaterialKind, ClassMaterial } from "@/lib/types";
import type { GlossaryTerm } from "@/lib/glossary";
import {
  inferMaterialKind,
  parseClassFolder,
  sanitizeFilename,
  isAllowedFile,
} from "@/lib/materials";
import path from "path";
import fs from "fs";
import AdmZip from "adm-zip";
import Anthropic from "@anthropic-ai/sdk";

const MATERIALS_ROOT = path.join(process.cwd(), "data", "materials");
const MAX_FILE_BYTES = 50 * 1024 * 1024;   // 50 MB single file
const MAX_ZIP_BYTES  = 250 * 1024 * 1024;  // 250 MB zip

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function subjectMaterialDir(subjectId: number, classId: number | null): string {
  const subDir = classId !== null ? `class-${classId}` : "inbox";
  return path.join(MATERIALS_ROOT, `subject-${subjectId}`, subDir);
}

function uniqueFilePath(dir: string, filename: string): string {
  ensureDir(dir);
  let candidate = path.join(dir, filename);
  if (!fs.existsSync(candidate)) return candidate;
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  for (let i = 2; i < 1000; i++) {
    candidate = path.join(dir, `${base} (${i})${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
  throw new Error("No se pudo encontrar un nombre único de archivo");
}

function mimeFromExt(filename: string): string | null {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    pdf:  "application/pdf",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ppt:  "application/vnd.ms-powerpoint",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc:  "application/msword",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls:  "application/vnd.ms-excel",
    csv:  "text/csv",
    tsv:  "text/tab-separated-values",
    md:   "text/markdown",
    txt:  "text/plain",
    png:  "image/png",
    jpg:  "image/jpeg",
    jpeg: "image/jpeg",
    gif:  "image/gif",
    webp: "image/webp",
    svg:  "image/svg+xml",
  };
  return map[ext] ?? null;
}

// ── Tasks ──────────────────────────────────────────────────────────────────

export async function createTask(formData: FormData) {
  const title = (formData.get("title") as string)?.trim();
  if (!title) return;

  const priority = (formData.get("priority") as Priority) || "media";
  const due_date = (formData.get("due_date") as string) || null;
  const subject_id = formData.get("subject_id")
    ? Number(formData.get("subject_id"))
    : null;

  const db = getDb();
  db.prepare(
    "INSERT INTO tasks (title, priority, due_date, subject_id) VALUES (?, ?, ?, ?)"
  ).run(title, priority, due_date, subject_id);

  revalidatePath("/", "layout");
}

export async function toggleTask(id: number) {
  const db = getDb();
  const task = db.prepare("SELECT status FROM tasks WHERE id = ?").get(id) as
    | { status: string }
    | undefined;
  if (!task) return;

  const nowDone = task.status === "pendiente";
  db.prepare(
    "UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?"
  ).run(
    nowDone ? "hecha" : "pendiente",
    nowDone ? new Date().toISOString() : null,
    id
  );

  revalidatePath("/", "layout");
}

export async function deleteTask(id: number) {
  getDb().prepare("DELETE FROM tasks WHERE id = ?").run(id);
  revalidatePath("/", "layout");
}

export async function updateTaskPriority(id: number, priority: Priority) {
  getDb()
    .prepare("UPDATE tasks SET priority = ? WHERE id = ?")
    .run(priority, id);
  revalidatePath("/", "layout");
}

// ── Classes ────────────────────────────────────────────────────────────────

export async function addClass(formData: FormData) {
  const subject_id = Number(formData.get("subject_id"));
  const title = (formData.get("title") as string)?.trim();
  const date = (formData.get("date") as string) || new Date().toISOString().slice(0, 10);
  if (!title || !subject_id) return;

  const db = getDb();
  const maxWeek = (
    db
      .prepare(
        "SELECT COALESCE(MAX(week), 0) as m FROM classes WHERE subject_id = ?"
      )
      .get(subject_id) as { m: number }
  ).m;

  db.prepare(
    "INSERT INTO classes (subject_id, week, title, date) VALUES (?, ?, ?, ?)"
  ).run(subject_id, maxWeek + 1, title, date);

  revalidatePath(`/facultad/${subject_id}`);
  revalidatePath("/");
}

export async function setSummarized(classId: number, subjectId: number) {
  getDb()
    .prepare("UPDATE classes SET summarized = 1 WHERE id = ?")
    .run(classId);
  revalidatePath(`/facultad/${subjectId}`);
  revalidatePath("/");
}

// ── Habits ────────────────────────────────────────────────────────────────

export async function toggleHabitLog(habitId: number, date: string) {
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM habit_logs WHERE habit_id = ? AND date = ?")
    .get(habitId, date);

  if (existing) {
    db.prepare("DELETE FROM habit_logs WHERE habit_id = ? AND date = ?").run(habitId, date);
  } else {
    db.prepare("INSERT INTO habit_logs (habit_id, date) VALUES (?, ?)").run(habitId, date);
  }

  revalidatePath("/habitos");
}

export async function createHabit(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  if (!name) return;
  getDb().prepare("INSERT OR IGNORE INTO habits (name) VALUES (?)").run(name);
  revalidatePath("/habitos");
}

// ── Exams ──────────────────────────────────────────────────────────────────

export async function setExamGrade(examId: number, grade: number, subjectId: number) {
  getDb()
    .prepare("UPDATE exams SET grade = ? WHERE id = ?")
    .run(grade, examId);
  revalidatePath(`/facultad/${subjectId}`);
}

// ── Glossary ───────────────────────────────────────────────────────────────

const GLOSSARY_ALLOWED = ["term", "category", "short_def", "detail", "example", "ticker", "formula", "term_type"];

export async function updateGlossaryTerm(
  id: number,
  field: string,
  value: string | null
) {
  if (!GLOSSARY_ALLOWED.includes(field)) return;
  getDb()
    .prepare(`UPDATE glossary_terms SET ${field} = ? WHERE id = ?`)
    .run(value, id);
  revalidatePath("/glossary");
}

export async function createGlossaryTerm(
  formData: FormData
): Promise<GlossaryTerm | null> {
  const term = (formData.get("term") as string)?.trim();
  const category = (formData.get("category") as string)?.trim();
  const short_def = (formData.get("short_def") as string)?.trim();
  const detail = (formData.get("detail") as string)?.trim();
  const example = (formData.get("example") as string)?.trim();
  const ticker = (formData.get("ticker") as string)?.trim() || null;
  const term_type = (formData.get("term_type") as string)?.trim() || "concepto";
  const formula = (formData.get("formula") as string)?.trim() || null;

  if (!term || !category || !short_def || !detail || !example) return null;

  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO glossary_terms (term, category, short_def, detail, example, ticker, term_type, formula) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(term, category, short_def, detail, example, ticker, term_type, formula);

  const newTerm = db
    .prepare("SELECT * FROM glossary_terms WHERE id = ?")
    .get(result.lastInsertRowid) as GlossaryTerm | undefined;

  revalidatePath("/glossary");
  return newTerm ?? null;
}

export async function deleteGlossaryTerm(id: number) {
  getDb().prepare("DELETE FROM glossary_terms WHERE id = ?").run(id);
  revalidatePath("/glossary");
}

// ── Class Materials ────────────────────────────────────────────────────────

/** Upload a single material file to a subject, optionally tied to a class. */
export async function uploadMaterial(formData: FormData): Promise<ClassMaterial | null> {
  const subjectIdRaw = formData.get("subject_id");
  const classIdRaw = formData.get("class_id");
  const file = formData.get("file") as File | null;

  if (!file || !(file instanceof File)) return null;
  if (!subjectIdRaw) return null;

  const subjectId = Number(subjectIdRaw);
  const classId = classIdRaw && classIdRaw !== "" ? Number(classIdRaw) : null;

  if (!Number.isFinite(subjectId)) return null;
  if (classId !== null && !Number.isFinite(classId)) return null;
  if (file.size > MAX_FILE_BYTES) return null;

  const safeName = sanitizeFilename(file.name);
  if (!isAllowedFile(safeName)) return null;

  const dir = subjectMaterialDir(subjectId, classId);
  const finalPath = uniqueFilePath(dir, safeName);
  const buf = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(finalPath, buf);

  const kind = inferMaterialKind(safeName);
  const mime = mimeFromExt(safeName);
  const relPath = path.relative(MATERIALS_ROOT, finalPath);

  const db = getDb();
  const r = db
    .prepare(
      "INSERT INTO class_materials (subject_id, class_id, kind, filename, file_path, mime, size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(subjectId, classId, kind, safeName, relPath, mime, buf.length);

  const row = db
    .prepare("SELECT * FROM class_materials WHERE id = ?")
    .get(Number(r.lastInsertRowid)) as ClassMaterial;

  revalidatePath(`/facultad/${subjectId}`);
  return row;
}

/** Bulk-import a .zip whose top-level directories are class folders. */
export async function importZip(formData: FormData): Promise<{
  ok: boolean;
  classesCreated: number;
  filesImported: number;
  filesSkipped: number;
  message?: string;
}> {
  const subjectIdRaw = formData.get("subject_id");
  const file = formData.get("file") as File | null;

  if (!file || !(file instanceof File)) {
    return { ok: false, classesCreated: 0, filesImported: 0, filesSkipped: 0, message: "Sin archivo" };
  }
  if (!subjectIdRaw) {
    return { ok: false, classesCreated: 0, filesImported: 0, filesSkipped: 0, message: "Materia no especificada" };
  }
  if (file.size > MAX_ZIP_BYTES) {
    return { ok: false, classesCreated: 0, filesImported: 0, filesSkipped: 0, message: "Zip demasiado pesado (>250 MB)" };
  }
  if (!file.name.toLowerCase().endsWith(".zip")) {
    return { ok: false, classesCreated: 0, filesImported: 0, filesSkipped: 0, message: "El archivo no es un zip" };
  }

  const subjectId = Number(subjectIdRaw);
  if (!Number.isFinite(subjectId)) {
    return { ok: false, classesCreated: 0, filesImported: 0, filesSkipped: 0, message: "Materia inválida" };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let zip: AdmZip;
  try {
    zip = new AdmZip(buf);
  } catch {
    return { ok: false, classesCreated: 0, filesImported: 0, filesSkipped: 0, message: "No se pudo abrir el zip" };
  }

  // Group entries by their top-level directory
  // If everything lives under a single top-level dir (e.g. "Materia/"), we unwrap it.
  const allEntries = zip.getEntries().filter(e => !e.isDirectory);
  if (allEntries.length === 0) {
    return { ok: false, classesCreated: 0, filesImported: 0, filesSkipped: 0, message: "Zip vacío" };
  }

  // Detect single top-level wrapper
  const topLevels = new Set<string>();
  for (const e of allEntries) {
    const parts = e.entryName.replace(/^\/+/, "").split("/");
    if (parts.length >= 1) topLevels.add(parts[0]);
  }
  const stripWrapper = topLevels.size === 1;

  // Group: classFolder -> [{relativePath, data}]
  const groups = new Map<string, { fileName: string; data: Buffer; rel: string }[]>();
  const INBOX = "__inbox__";

  for (const entry of allEntries) {
    let rawPath = entry.entryName.replace(/^\/+/, "");
    if (stripWrapper) {
      const parts = rawPath.split("/");
      parts.shift();
      rawPath = parts.join("/");
    }
    if (!rawPath) continue;
    if (rawPath.includes("..")) continue;          // path traversal guard
    if (rawPath.startsWith("__MACOSX/")) continue; // mac noise

    const parts = rawPath.split("/");
    const fileName = sanitizeFilename(parts[parts.length - 1]);
    if (!fileName || fileName.startsWith(".")) continue;
    if (!isAllowedFile(fileName)) continue;

    const folder = parts.length > 1 ? parts.slice(0, -1).join(" / ") : INBOX;
    const data = entry.getData();
    if (data.length > MAX_FILE_BYTES) continue;

    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder)!.push({ fileName, data, rel: rawPath });
  }

  const db = getDb();
  let classesCreated = 0;
  let filesImported = 0;
  let filesSkipped = 0;

  const tx = db.transaction(() => {
    for (const [folder, files] of groups.entries()) {
      let classId: number | null = null;

      if (folder !== INBOX) {
        // Try to match an existing class by parsed week, else create one
        const { week, title } = parseClassFolder(folder);
        const existing = week !== null
          ? db.prepare("SELECT id FROM classes WHERE subject_id = ? AND week = ?").get(subjectId, week) as { id: number } | undefined
          : undefined;

        if (existing) {
          classId = existing.id;
        } else {
          const nextWeek = week ?? (db.prepare("SELECT COALESCE(MAX(week),0)+1 as w FROM classes WHERE subject_id = ?").get(subjectId) as { w: number }).w;
          const today = new Date().toISOString().slice(0, 10);
          const r = db
            .prepare("INSERT INTO classes (subject_id, week, title, date) VALUES (?, ?, ?, ?)")
            .run(subjectId, nextWeek, title || folder.slice(0, 80), today);
          classId = Number(r.lastInsertRowid);
          classesCreated++;
        }
      }

      const dir = subjectMaterialDir(subjectId, classId);
      for (const f of files) {
        try {
          const finalPath = uniqueFilePath(dir, f.fileName);
          fs.writeFileSync(finalPath, f.data);
          const kind = inferMaterialKind(f.fileName);
          const mime = mimeFromExt(f.fileName);
          const relPath = path.relative(MATERIALS_ROOT, finalPath);
          db.prepare(
            "INSERT INTO class_materials (subject_id, class_id, kind, filename, file_path, mime, size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?)"
          ).run(subjectId, classId, kind, f.fileName, relPath, mime, f.data.length);
          filesImported++;
        } catch {
          filesSkipped++;
        }
      }
    }
  });

  tx();
  revalidatePath(`/facultad/${subjectId}`);
  revalidatePath("/today");

  return { ok: true, classesCreated, filesImported, filesSkipped };
}

export async function deleteMaterial(id: number) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM class_materials WHERE id = ?").get(id) as ClassMaterial | undefined;
  if (!row) return;

  // Delete file from disk (best-effort)
  try {
    const abs = path.join(MATERIALS_ROOT, row.file_path);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch { /* ignore */ }

  db.prepare("DELETE FROM class_materials WHERE id = ?").run(id);
  revalidatePath(`/facultad/${row.subject_id}`);
}

export async function assignMaterialToClass(materialId: number, classId: number | null) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM class_materials WHERE id = ?").get(materialId) as ClassMaterial | undefined;
  if (!row) return;

  // Move file on disk to new dir
  const newDir = subjectMaterialDir(row.subject_id, classId);
  const oldAbs = path.join(MATERIALS_ROOT, row.file_path);
  if (fs.existsSync(oldAbs)) {
    const newAbs = uniqueFilePath(newDir, row.filename);
    fs.renameSync(oldAbs, newAbs);
    const newRel = path.relative(MATERIALS_ROOT, newAbs);
    db.prepare("UPDATE class_materials SET class_id = ?, file_path = ? WHERE id = ?").run(classId, newRel, materialId);
  } else {
    db.prepare("UPDATE class_materials SET class_id = ? WHERE id = ?").run(classId, materialId);
  }

  revalidatePath(`/facultad/${row.subject_id}`);
}

export async function updateMaterialKind(materialId: number, kind: MaterialKind) {
  const allowed: MaterialKind[] = ["slide", "ejercicio", "excel", "lectura", "notas", "imagen", "otro"];
  if (!allowed.includes(kind)) return;

  const db = getDb();
  const row = db.prepare("SELECT subject_id FROM class_materials WHERE id = ?").get(materialId) as { subject_id: number } | undefined;
  if (!row) return;
  db.prepare("UPDATE class_materials SET kind = ? WHERE id = ?").run(kind, materialId);
  revalidatePath(`/facultad/${row.subject_id}`);
}

/** Manually trigger an AI summary of a material via Claude. */
export async function summarizeMaterial(materialId: number): Promise<{ ok: boolean; summary?: string; message?: string }> {
  const db = getDb();
  const row = db.prepare("SELECT * FROM class_materials WHERE id = ?").get(materialId) as ClassMaterial | undefined;
  if (!row) return { ok: false, message: "Material no encontrado" };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, message: "Falta ANTHROPIC_API_KEY en el .env del proyecto" };
  }

  const ext = row.filename.toLowerCase().split(".").pop() ?? "";
  if (!["pdf", "txt", "md"].includes(ext)) {
    return {
      ok: false,
      message: `Por ahora solo se pueden resumir PDF, TXT y MD (este es .${ext}).`,
    };
  }

  const abs = path.join(MATERIALS_ROOT, row.file_path);
  if (!fs.existsSync(abs)) return { ok: false, message: "Archivo no encontrado en disco" };

  const client = new Anthropic({ apiKey });

  const prompt = `Resumí este material de la clase en español. Estructura el resumen así:

**Conceptos clave** (5-8 bullets con los puntos centrales)
**Fórmulas / expresiones** (si las hay, escribir en LaTeX inline)
**Aplicaciones prácticas** (2-3 ejemplos o casos donde aplica)
**Para repasar antes del examen** (3-5 ítems puntuales)

Sé conciso pero específico — citá nombres, modelos, formulas exactas. No agregues introducciones ni cierres genéricos.`;

  let content: Anthropic.MessageParam["content"];
  if (ext === "pdf") {
    const data = fs.readFileSync(abs).toString("base64");
    content = [
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data },
      },
      { type: "text", text: prompt },
    ];
  } else {
    const txt = fs.readFileSync(abs, "utf8").slice(0, 200_000);
    content = [{ type: "text", text: `${prompt}\n\n--- Contenido del archivo ---\n\n${txt}` }];
  }

  try {
    const stream = client.messages.stream({
      model: "claude-opus-4-7",
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content }],
    });

    const msg = await stream.finalMessage();
    const text = msg.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map(c => c.text)
      .join("\n")
      .trim();

    if (!text) return { ok: false, message: "El modelo no devolvió texto" };

    db.prepare("UPDATE class_materials SET summary = ? WHERE id = ?").run(text, materialId);
    revalidatePath(`/facultad/${row.subject_id}`);
    return { ok: true, summary: text };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `Error al llamar al modelo: ${msg}` };
  }
}

// ── Semesters ──────────────────────────────────────────────────────────────

const DEFAULT_SUBJECT_TEMPLATE: { name: string; short: string; hue: number; credits: number }[] = [
  { name: "Pronósticos Financieros",  short: "Pronósticos",       hue: 200, credits: 6 },
  { name: "Instrumentos Financieros", short: "Instrumentos",      hue: 100, credits: 6 },
  { name: "Ingeniería Financiera",    short: "Ing. Financiera",   hue: 280, credits: 6 },
  { name: "Finanzas Corporativas",    short: "Fin. Corporativas", hue: 340, credits: 6 },
  { name: "Taller de Tesis",          short: "Tesis",              hue: 30,  credits: 4 },
];

function nextSemesterName(currentName: string): string {
  // "2026-1S" -> "2026-2S"; "2026-2S" -> "2027-1S"
  const m = /^(\d{4})-(1S|2S)$/.exec(currentName);
  if (!m) {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() < 6 ? "1S" : "2S"}`;
  }
  const year = Number(m[1]);
  const half = m[2];
  return half === "1S" ? `${year}-2S` : `${year + 1}-1S`;
}

export async function closeSemester() {
  const db = getDb();
  const active = db
    .prepare("SELECT id, name FROM semesters WHERE status = 'active' ORDER BY id DESC LIMIT 1")
    .get() as { id: number; name: string } | undefined;

  if (!active) return;

  const tx = db.transaction(() => {
    // archive current
    db.prepare(
      "UPDATE semesters SET status = 'archived', archived_at = datetime('now') WHERE id = ?"
    ).run(active.id);

    // create new semester
    const newName = nextSemesterName(active.name);
    const r = db
      .prepare("INSERT INTO semesters (name, status) VALUES (?, 'active')")
      .run(newName);
    const newSemId = Number(r.lastInsertRowid);

    // seed with the 5 template subjects (empty — no classes/exams/tasks)
    const ins = db.prepare(
      "INSERT INTO subjects (name, short, hue, credits, semester_id) VALUES (?, ?, ?, ?, ?)"
    );
    for (const t of DEFAULT_SUBJECT_TEMPLATE) {
      ins.run(t.name, t.short, t.hue, t.credits, newSemId);
    }
  });

  tx();
  revalidatePath("/", "layout");
}

