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

/** Save (or clear) the per-class summary. Pasting from claude.ai lands here. */
export async function updateClassSummary(classId: number, summary: string | null) {
  const db = getDb();
  const row = db.prepare("SELECT subject_id FROM classes WHERE id = ?").get(classId) as { subject_id: number } | undefined;
  if (!row) return;
  const trimmed = summary && summary.trim() ? summary.trim() : null;
  db.prepare("UPDATE classes SET summary = ?, summarized = ? WHERE id = ?").run(trimmed, trimmed ? 1 : 0, classId);
  revalidatePath(`/facultad/${row.subject_id}`);
  revalidatePath("/");
}

/** Update class title and/or week — for inline editing. */
export async function updateClass(classId: number, patch: { title?: string; week?: number }) {
  const db = getDb();
  const row = db.prepare("SELECT subject_id FROM classes WHERE id = ?").get(classId) as { subject_id: number } | undefined;
  if (!row) return;

  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (t) db.prepare("UPDATE classes SET title = ? WHERE id = ?").run(t, classId);
  }
  if (patch.week !== undefined && Number.isFinite(patch.week) && patch.week > 0) {
    db.prepare("UPDATE classes SET week = ? WHERE id = ?").run(patch.week, classId);
  }
  revalidatePath(`/facultad/${row.subject_id}`);
}

/** Delete a class. Its materials fall to the inbox (class_id set to NULL). */
export async function deleteClass(classId: number) {
  const db = getDb();
  const row = db.prepare("SELECT subject_id FROM classes WHERE id = ?").get(classId) as { subject_id: number } | undefined;
  if (!row) return;

  const tx = db.transaction(() => {
    // Materials: detach to inbox (class_id NULL). The ON DELETE SET NULL FK does this
    // automatically, but we run it explicitly to also move files on disk later if we
    // want to. For now the FK handles the DB side and the files keep their disk paths.
    db.prepare("UPDATE class_materials SET class_id = NULL WHERE class_id = ?").run(classId);
    db.prepare("DELETE FROM classes WHERE id = ?").run(classId);
  });
  tx();

  revalidatePath(`/facultad/${row.subject_id}`);
  revalidatePath("/");
}

// ── Command Palette + Study Sessions ──────────────────────────────────────

export interface CommandPaletteItem {
  type: "subject" | "class" | "task" | "material" | "glossary";
  id: number;
  label: string;
  subtitle?: string;
  href?: string;
  hue?: number;
  priority?: Priority;
  dueDate?: string | null;
  kind?: MaterialKind;
}

export interface CommandPaletteData {
  subjects: CommandPaletteItem[];
  classes: CommandPaletteItem[];
  tasks: CommandPaletteItem[];
  materials: CommandPaletteItem[];
  glossary: CommandPaletteItem[];
}

/** Fetch everything the Cmd+K palette can search through, scoped to the active semester. */
export async function getCommandPaletteData(): Promise<CommandPaletteData> {
  const db = getDb();
  const active = db.prepare("SELECT id FROM semesters WHERE status='active' ORDER BY id DESC LIMIT 1").get() as { id: number } | undefined;
  const semId = active?.id ?? null;

  const subjectRows = semId
    ? db.prepare("SELECT id, name, short, hue FROM subjects WHERE semester_id = ? ORDER BY name").all(semId) as { id: number; name: string; short: string; hue: number }[]
    : [];

  const subjectIds = subjectRows.map(s => s.id);
  const inList = subjectIds.length ? subjectIds.map(() => "?").join(",") : "NULL";

  const classRows = subjectIds.length
    ? db.prepare(`SELECT c.id, c.subject_id, c.week, c.title, s.short as subject_short, s.hue as subject_hue FROM classes c JOIN subjects s ON s.id = c.subject_id WHERE c.subject_id IN (${inList}) ORDER BY c.subject_id, c.week`).all(...subjectIds) as { id: number; subject_id: number; week: number; title: string; subject_short: string; subject_hue: number }[]
    : [];

  const taskRows = subjectIds.length
    ? db.prepare(`SELECT t.id, t.title, t.priority, t.due_date, t.subject_id, s.short as subject_short, s.hue as subject_hue FROM tasks t LEFT JOIN subjects s ON s.id = t.subject_id WHERE t.status = 'pendiente' AND (t.subject_id IN (${inList}) OR t.subject_id IS NULL) ORDER BY CASE t.priority WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END, t.due_date ASC LIMIT 60`).all(...subjectIds) as { id: number; title: string; priority: Priority; due_date: string | null; subject_id: number | null; subject_short: string | null; subject_hue: number | null }[]
    : [];

  const materialRows = subjectIds.length
    ? db.prepare(`SELECT m.id, m.filename, m.kind, m.subject_id, m.class_id, s.short as subject_short, s.hue as subject_hue, c.week as class_week, c.title as class_title FROM class_materials m JOIN subjects s ON s.id = m.subject_id LEFT JOIN classes c ON c.id = m.class_id WHERE m.subject_id IN (${inList}) ORDER BY m.created_at DESC LIMIT 40`).all(...subjectIds) as { id: number; filename: string; kind: MaterialKind; subject_id: number; class_id: number | null; subject_short: string; subject_hue: number; class_week: number | null; class_title: string | null }[]
    : [];

  const glossaryRows = db.prepare("SELECT id, term, category FROM glossary_terms ORDER BY term").all() as { id: number; term: string; category: string }[];

  return {
    subjects: subjectRows.map(s => ({
      type: "subject" as const,
      id: s.id,
      label: s.name,
      subtitle: s.short,
      href: `/facultad/${s.id}`,
      hue: s.hue,
    })),
    classes: classRows.map(c => ({
      type: "class" as const,
      id: c.id,
      label: `Clase ${c.week} · ${c.title}`,
      subtitle: c.subject_short,
      href: `/facultad/${c.subject_id}`,
      hue: c.subject_hue,
    })),
    tasks: taskRows.map(t => ({
      type: "task" as const,
      id: t.id,
      label: t.title,
      subtitle: t.subject_short ?? "Sin materia",
      hue: t.subject_hue ?? 220,
      priority: t.priority,
      dueDate: t.due_date,
    })),
    materials: materialRows.map(m => ({
      type: "material" as const,
      id: m.id,
      label: m.filename,
      subtitle: m.class_title ? `${m.subject_short} · Clase ${m.class_week}` : `${m.subject_short} · Inbox`,
      href: `/api/materials/${m.id}`,
      hue: m.subject_hue,
      kind: m.kind,
    })),
    glossary: glossaryRows.map(g => ({
      type: "glossary" as const,
      id: g.id,
      label: g.term,
      subtitle: g.category,
      href: `/glossary`,
    })),
  };
}

/** Subjects in the active semester — used by the pomodoro picker, etc. */
export async function getActiveSubjects(): Promise<{ id: number; name: string; short: string; hue: number }[]> {
  const db = getDb();
  const active = db.prepare("SELECT id FROM semesters WHERE status='active' ORDER BY id DESC LIMIT 1").get() as { id: number } | undefined;
  if (!active) return [];
  return db
    .prepare("SELECT id, name, short, hue FROM subjects WHERE semester_id = ? ORDER BY name")
    .all(active.id) as { id: number; name: string; short: string; hue: number }[];
}

/** Log a completed pomodoro / study session (called when a work cycle ends). */
export async function logStudySession(subjectId: number, minutes: number, notes: string = "") {
  if (!Number.isFinite(subjectId) || !Number.isFinite(minutes) || minutes <= 0) return null;
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const r = db
    .prepare("INSERT INTO study_sessions (subject_id, date, minutes, notes) VALUES (?, ?, ?, ?)")
    .run(subjectId, today, Math.round(minutes), notes);
  revalidatePath("/", "layout");
  return Number(r.lastInsertRowid);
}

/** Create a task linked to a specific class (material_id is the class id per the schema). */
export async function createTaskForClass(classId: number, title: string, priority: Priority = "media", dueDate: string | null = null) {
  const db = getDb();
  const row = db.prepare("SELECT subject_id FROM classes WHERE id = ?").get(classId) as { subject_id: number } | undefined;
  if (!row) return null;
  const t = title.trim();
  if (!t) return null;
  const r = db
    .prepare("INSERT INTO tasks (title, priority, due_date, subject_id, material_id) VALUES (?, ?, ?, ?, ?)")
    .run(t, priority, dueDate, row.subject_id, classId);
  revalidatePath(`/facultad/${row.subject_id}`);
  revalidatePath("/");
  return Number(r.lastInsertRowid);
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

/** Common ingest logic: takes a flat list of files with their relative paths and
 *  groups them into classes by top-level directory. */
type IngestResult = {
  ok: boolean;
  classesCreated: number;
  filesImported: number;
  filesSkipped: number;
  message?: string;
};

function ingestMaterialFiles(
  subjectId: number,
  files: { path: string; data: Buffer }[]
): IngestResult {
  if (files.length === 0) {
    return { ok: false, classesCreated: 0, filesImported: 0, filesSkipped: 0, message: "No hay archivos" };
  }

  // Normalize + filter
  const normalized = files
    .map(f => ({ path: f.path.replace(/^\/+/, "").replace(/\\/g, "/"), data: f.data }))
    .filter(f => f.path && !f.path.includes("..") && !f.path.startsWith("__MACOSX/"));

  if (normalized.length === 0) {
    return { ok: false, classesCreated: 0, filesImported: 0, filesSkipped: 0, message: "No hay archivos válidos" };
  }

  // Detect single top-level wrapper folder
  const topLevels = new Set<string>();
  for (const f of normalized) {
    const parts = f.path.split("/");
    if (parts.length >= 1) topLevels.add(parts[0]);
  }
  const stripWrapper = topLevels.size === 1 && normalized.some(f => f.path.includes("/"));

  // Group: classFolder -> [{fileName, data}]
  const groups = new Map<string, { fileName: string; data: Buffer }[]>();
  const INBOX = "__inbox__";

  for (const f of normalized) {
    let rawPath = f.path;
    if (stripWrapper) {
      const parts = rawPath.split("/");
      parts.shift();
      rawPath = parts.join("/");
    }
    if (!rawPath) continue;

    const parts = rawPath.split("/");
    const fileName = sanitizeFilename(parts[parts.length - 1]);
    if (!fileName || fileName.startsWith(".")) continue;
    if (!isAllowedFile(fileName)) continue;
    if (f.data.length > MAX_FILE_BYTES) continue;

    const folder = parts.length > 1 ? parts.slice(0, -1).join(" / ") : INBOX;
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder)!.push({ fileName, data: f.data });
  }

  if (groups.size === 0) {
    return { ok: false, classesCreated: 0, filesImported: 0, filesSkipped: 0, message: "Ningún archivo pasó los filtros (extensión no permitida o demasiado grande)" };
  }

  const db = getDb();
  let classesCreated = 0;
  let filesImported = 0;
  let filesSkipped = 0;

  const tx = db.transaction(() => {
    for (const [folder, items] of groups.entries()) {
      let classId: number | null = null;

      if (folder !== INBOX) {
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
      for (const item of items) {
        try {
          const finalPath = uniqueFilePath(dir, item.fileName);
          fs.writeFileSync(finalPath, item.data);
          const kind = inferMaterialKind(item.fileName);
          const mime = mimeFromExt(item.fileName);
          const relPath = path.relative(MATERIALS_ROOT, finalPath);
          db.prepare(
            "INSERT INTO class_materials (subject_id, class_id, kind, filename, file_path, mime, size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?)"
          ).run(subjectId, classId, kind, item.fileName, relPath, mime, item.data.length);
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

/** Bulk-import a .zip whose top-level directories are class folders. */
export async function importZip(formData: FormData): Promise<IngestResult> {
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

  const entries = zip.getEntries().filter(e => !e.isDirectory);
  const files = entries.map(e => ({ path: e.entryName, data: e.getData() }));

  return ingestMaterialFiles(subjectId, files);
}

/** Bulk-import a folder by its absolute path on disk. The Next.js dev server
 *  runs on the user's machine, so it can read filesystem paths directly — no
 *  browser folder-upload quirks involved. THIS IS THE RECOMMENDED METHOD. */
export async function importLocalFolder(
  subjectId: number,
  folderPath: string
): Promise<IngestResult> {
  if (!folderPath || typeof folderPath !== "string") {
    return { ok: false, classesCreated: 0, filesImported: 0, filesSkipped: 0, message: "Sin ruta" };
  }
  if (!Number.isFinite(subjectId)) {
    return { ok: false, classesCreated: 0, filesImported: 0, filesSkipped: 0, message: "Materia inválida" };
  }

  // Expand ~ to home dir for convenience
  let pathStr = folderPath.trim();
  // Strip surrounding quotes that some terminals/Finder paste with
  if ((pathStr.startsWith('"') && pathStr.endsWith('"')) || (pathStr.startsWith("'") && pathStr.endsWith("'"))) {
    pathStr = pathStr.slice(1, -1);
  }
  if (pathStr.startsWith("~")) {
    pathStr = path.join(process.env.HOME ?? "", pathStr.slice(1));
  }
  const resolved = path.resolve(pathStr);

  if (!fs.existsSync(resolved)) {
    return { ok: false, classesCreated: 0, filesImported: 0, filesSkipped: 0, message: `La ruta no existe: ${resolved}` };
  }
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    return { ok: false, classesCreated: 0, filesImported: 0, filesSkipped: 0, message: "La ruta no apunta a una carpeta" };
  }

  const files: { path: string; data: Buffer }[] = [];
  let totalBytes = 0;
  let tooBig = false;

  const walk = (dir: string, relBase: string) => {
    if (tooBig) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.name === "__MACOSX") continue;
      const full = path.join(dir, entry.name);
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(full, rel);
      } else if (entry.isFile()) {
        let st: fs.Stats;
        try { st = fs.statSync(full); } catch { continue; }
        if (st.size > MAX_FILE_BYTES) continue;
        totalBytes += st.size;
        if (totalBytes > MAX_ZIP_BYTES) { tooBig = true; return; }
        try {
          const data = fs.readFileSync(full);
          files.push({ path: rel, data });
        } catch { /* skip unreadable */ }
      }
    }
  };

  try {
    walk(resolved, "");
  } catch (err) {
    return {
      ok: false, classesCreated: 0, filesImported: 0, filesSkipped: 0,
      message: `Error leyendo la carpeta: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (tooBig) {
    return { ok: false, classesCreated: 0, filesImported: 0, filesSkipped: 0, message: "Carpeta demasiado pesada (>250 MB total)" };
  }
  if (files.length === 0) {
    return { ok: false, classesCreated: 0, filesImported: 0, filesSkipped: 0, message: "No se encontraron archivos en la carpeta" };
  }

  return ingestMaterialFiles(subjectId, files);
}

/** Bulk-import a folder picked via <input webkitdirectory>. Files come in with
 *  their relative path encoded as the filename. */
export async function importFolder(formData: FormData): Promise<IngestResult & { samplePaths?: string[] }> {
  const subjectIdRaw = formData.get("subject_id");
  const allFiles = formData.getAll("files");

  if (!subjectIdRaw) {
    return { ok: false, classesCreated: 0, filesImported: 0, filesSkipped: 0, message: "Materia no especificada" };
  }
  const subjectId = Number(subjectIdRaw);
  if (!Number.isFinite(subjectId)) {
    return { ok: false, classesCreated: 0, filesImported: 0, filesSkipped: 0, message: "Materia inválida" };
  }
  if (allFiles.length === 0) {
    return { ok: false, classesCreated: 0, filesImported: 0, filesSkipped: 0, message: "No hay archivos en la carpeta" };
  }

  const files: { path: string; data: Buffer }[] = [];
  let totalBytes = 0;
  for (const f of allFiles) {
    if (!(f instanceof File)) continue;
    totalBytes += f.size;
    if (totalBytes > MAX_ZIP_BYTES) {
      return { ok: false, classesCreated: 0, filesImported: 0, filesSkipped: 0, message: "Carpeta demasiado pesada (>250 MB total)" };
    }
    const buf = Buffer.from(await f.arrayBuffer());
    // The webkitRelativePath is encoded into f.name by the client
    files.push({ path: f.name, data: buf });
  }

  // Diagnostic: log the actual paths we received to /tmp for inspection
  try {
    const logPath = path.join(process.cwd(), "data", "last-folder-upload.log");
    const summary = [
      `[${new Date().toISOString()}] subject=${subjectId}, total files=${files.length}`,
      "Paths received:",
      ...files.map(f => `  ${f.path}`),
    ].join("\n");
    fs.writeFileSync(logPath, summary);
  } catch { /* ignore */ }

  const result = ingestMaterialFiles(subjectId, files);
  return { ...result, samplePaths: files.slice(0, 5).map(f => f.path) };
}

/** Nuclear option — wipe every class + material for a subject (preserves the subject row,
 *  its exams and tasks). Use to restart the import from scratch. */
export async function clearAllSubjectMaterials(subjectId: number): Promise<{
  materialsDeleted: number;
  classesDeleted: number;
}> {
  const db = getDb();
  const materials = db
    .prepare("SELECT id FROM class_materials WHERE subject_id = ?")
    .all(subjectId) as { id: number }[];

  // Remove the whole subject directory tree on disk (much faster than file-by-file)
  try {
    const subjectDir = path.join(MATERIALS_ROOT, `subject-${subjectId}`);
    if (fs.existsSync(subjectDir)) {
      fs.rmSync(subjectDir, { recursive: true, force: true });
    }
  } catch { /* ignore */ }

  // Delete materials first (class_id may reference classes)
  db.prepare("DELETE FROM class_materials WHERE subject_id = ?").run(subjectId);
  const classRes = db.prepare("DELETE FROM classes WHERE subject_id = ?").run(subjectId);

  revalidatePath(`/facultad/${subjectId}`);
  return { materialsDeleted: materials.length, classesDeleted: Number(classRes.changes) };
}

/** Delete every unassigned (inbox) material for a subject — both DB rows and files on disk. */
export async function clearInbox(subjectId: number): Promise<{ deleted: number }> {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM class_materials WHERE subject_id = ? AND class_id IS NULL")
    .all(subjectId) as ClassMaterial[];

  for (const r of rows) {
    try {
      const abs = path.join(MATERIALS_ROOT, r.file_path);
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    } catch { /* ignore */ }
  }

  // Also try to remove the now-empty inbox directory
  try {
    const dir = subjectMaterialDir(subjectId, null);
    if (fs.existsSync(dir)) {
      const remaining = fs.readdirSync(dir);
      if (remaining.length === 0) fs.rmdirSync(dir);
    }
  } catch { /* ignore */ }

  db.prepare("DELETE FROM class_materials WHERE subject_id = ? AND class_id IS NULL").run(subjectId);
  revalidatePath(`/facultad/${subjectId}`);
  return { deleted: rows.length };
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

/** Save a summary that the user pasted back from Claude.ai. */
export async function updateMaterialSummary(materialId: number, summary: string | null) {
  const db = getDb();
  const row = db.prepare("SELECT subject_id FROM class_materials WHERE id = ?").get(materialId) as { subject_id: number } | undefined;
  if (!row) return;
  const trimmed = summary && summary.trim() ? summary.trim() : null;
  db.prepare("UPDATE class_materials SET summary = ? WHERE id = ?").run(trimmed, materialId);
  revalidatePath(`/facultad/${row.subject_id}`);
}

/** Set or clear the Claude.ai Project URL for a subject (used by "Preguntar a Claude"). */
export async function setSubjectClaudeProject(subjectId: number, url: string | null) {
  const trimmed = url && url.trim() ? url.trim() : null;
  if (trimmed && !/^https?:\/\/(claude\.ai|www\.claude\.ai)\//i.test(trimmed)) {
    return { ok: false, message: "La URL tiene que empezar con https://claude.ai/..." };
  }
  getDb().prepare("UPDATE subjects SET claude_project_url = ? WHERE id = ?").run(trimmed, subjectId);
  revalidatePath(`/facultad/${subjectId}`);
  return { ok: true };
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

