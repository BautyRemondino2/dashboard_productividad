"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import type { Priority } from "@/lib/types";
import type { GlossaryTerm } from "@/lib/glossary";

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
