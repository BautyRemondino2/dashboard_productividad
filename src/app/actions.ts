"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import type { Context, Priority } from "@/lib/types";

// ── Tasks ─────────────────────────────────────────────────────────────────────

export async function createTask(formData: FormData) {
  const title = (formData.get("title") as string)?.trim();
  if (!title) return;

  const context = (formData.get("context") as Context) || "casa";
  const priority = (formData.get("priority") as Priority) || "media";
  const due_date = (formData.get("due_date") as string) || null;

  const db = getDb();
  db.prepare(
    "INSERT INTO tasks (title, context, priority, due_date) VALUES (?, ?, ?, ?)"
  ).run(title, context, priority, due_date);

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
  getDb().prepare("UPDATE tasks SET priority = ? WHERE id = ?").run(priority, id);
  revalidatePath("/", "layout");
}

// ── Habits ────────────────────────────────────────────────────────────────────

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
