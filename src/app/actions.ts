"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { localDateStr } from "@/lib/utils";
import type { Priority, ExamType } from "@/lib/types";
import type { GlossaryTerm } from "@/lib/glossary";
import Anthropic from "@anthropic-ai/sdk";

// ── Tasks ─────────────────────────────────────────────────────────────────────

export async function createTask(formData: FormData) {
  const title = (formData.get("title") as string)?.trim();
  if (!title) return;
  const priority   = (formData.get("priority")   as Priority) || "media";
  const due_date   = (formData.get("due_date")   as string)   || null;
  const subject_id = formData.get("subject_id") ? Number(formData.get("subject_id")) : null;

  // Always hardcode context = 'facultad'
  getDb().prepare(
    "INSERT INTO tasks (title, context, priority, due_date, subject_id) VALUES (?, 'facultad', ?, ?, ?)"
  ).run(title, priority, due_date, subject_id);

  revalidatePath("/", "layout");
}

export async function toggleTask(id: number) {
  const db   = getDb();
  const task = db.prepare("SELECT status FROM tasks WHERE id = ?").get(id) as
    | { status: string } | undefined;
  if (!task) return;

  const nowDone = task.status === "pendiente";
  db.prepare("UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?").run(
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

// ── Habits ────────────────────────────────────────────────────────────────────

export async function toggleHabitLog(habitId: number, date: string) {
  const db  = getDb();
  const row = db.prepare("SELECT id FROM habit_logs WHERE habit_id = ? AND date = ?").get(habitId, date);
  if (row) {
    db.prepare("DELETE FROM habit_logs WHERE habit_id = ? AND date = ?").run(habitId, date);
  } else {
    db.prepare("INSERT INTO habit_logs (habit_id, date) VALUES (?, ?)").run(habitId, date);
  }
  revalidatePath("/habitos");
  revalidatePath("/today");
}

export async function createHabit(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  if (!name) return;
  getDb().prepare("INSERT OR IGNORE INTO habits (name) VALUES (?)").run(name);
  revalidatePath("/habitos");
}

// ── Exámenes ──────────────────────────────────────────────────────────────────

export async function createExam(formData: FormData) {
  const subject_id = Number(formData.get("subject_id"));
  const title      = (formData.get("title") as string)?.trim();
  const type       = (formData.get("type")  as ExamType) || "parcial";
  const date       = (formData.get("date")  as string)   || localDateStr();
  const notes      = (formData.get("notes") as string | null)?.trim() || null;
  const gradeRaw   = formData.get("grade") as string | null;
  const grade      = gradeRaw && gradeRaw.trim() ? parseFloat(gradeRaw.replace(",", ".")) : null;

  if (!subject_id || !title || !date) return;

  getDb().prepare(
    "INSERT INTO exams (subject_id, title, type, date, grade, notes) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(subject_id, title, type, date, grade, notes);

  revalidatePath("/examenes");
  revalidatePath(`/facultad/${subject_id}`);
  revalidatePath("/today");
}

export async function updateExamGrade(id: number, grade: number, notes?: string) {
  getDb().prepare(
    "UPDATE exams SET grade = ?, notes = ? WHERE id = ?"
  ).run(grade, notes ?? null, id);
  revalidatePath("/examenes");
  revalidatePath("/today");
  revalidatePath("/stats");
}

export async function updateExamWeight(id: number, weight: number) {
  const w = Math.max(0.01, weight);
  getDb().prepare("UPDATE exams SET weight = ? WHERE id = ?").run(w, id);
  revalidatePath("/stats");
  revalidatePath("/examenes");
}

export async function updateSubjectCredits(subjectId: number, credits: number) {
  const c = Math.max(1, Math.round(credits));
  getDb().prepare("UPDATE subjects SET credits = ? WHERE id = ?").run(c, subjectId);
  revalidatePath("/stats");
}

export async function logStudySession(formData: FormData) {
  const subjectId = Number(formData.get("subject_id"));
  const minutes   = Number(formData.get("minutes"));
  const date      = (formData.get("date") as string) || localDateStr();
  const notes     = (formData.get("notes") as string | null)?.trim() || "";
  if (!subjectId || !minutes || minutes < 1) return;
  getDb().prepare(
    "INSERT INTO study_sessions (subject_id, date, minutes, notes) VALUES (?, ?, ?, ?)"
  ).run(subjectId, date, minutes, notes);
  revalidatePath("/stats");
}

export async function deleteStudySession(id: number) {
  getDb().prepare("DELETE FROM study_sessions WHERE id = ?").run(id);
  revalidatePath("/stats");
}

export async function deleteExam(id: number) {
  const db  = getDb();
  const row = db.prepare("SELECT subject_id FROM exams WHERE id = ?").get(id) as
    | { subject_id: number } | undefined;
  db.prepare("DELETE FROM exams WHERE id = ?").run(id);
  if (row) {
    revalidatePath(`/facultad/${row.subject_id}`);
    revalidatePath("/examenes");
    revalidatePath("/today");
  }
}

// ── Facultad — Materials & Summaries ─────────────────────────────────────────

const SUMMARY_SYSTEM = `Sos un estudiante universitario brillante y apasionado de la carrera de finanzas. Cuando estudiás material de clase, tomás apuntes extremadamente detallados, completos y bien explicados — como si fueras a enseñarle el tema a alguien que no sabe nada. Escribís en español argentino, de manera clara, fluida y en texto corrido, sin ningún título, bullet, ni división en secciones. Tu estilo es pedagógico pero muy preciso: cubrís todos los conceptos, definiciones, fórmulas, ejemplos numéricos y relaciones entre ideas. Los apuntes tienen que poder reemplazar al libro de texto para esa clase.`;

/** Extract exercises / study tasks from the material. Returns up to 6 task titles. */
async function extractExercises(
  subjectName: string,
  textContent: string | null,
  pdfBase64: string | null,
): Promise<string[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const instruction = `Analizá este material de la materia "${subjectName}" e identificá los ejercicios, problemas o tareas que un estudiante debería resolver para dominar el tema. Respondé ÚNICAMENTE con un JSON array de strings en español, sin ningún otro texto ni markdown. Máximo 6 items, bien específicos. Si no hay ejercicios explícitos, sugerí 2-3 tareas de repaso concretas. Ejemplo de respuesta: ["Resolver ejercicios 1-5 del capítulo 3", "Demostrar el Teorema de Black-Scholes", "Analizar el caso práctico de la página 47"]`;

  const userContent: Anthropic.MessageParam["content"] = pdfBase64
    ? [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } } as Anthropic.DocumentBlockParam,
        { type: "text", text: instruction },
      ]
    : `${instruction}\n\nMATERIAL:\n${(textContent ?? "").slice(0, 4000)}`;

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      messages: [{ role: "user", content: userContent }],
    });
    const raw = (msg.content.find((b): b is Anthropic.TextBlock => b.type === "text"))?.text ?? "[]";
    // Strip any accidental markdown fences
    const clean = raw.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const arr   = JSON.parse(clean);
    return Array.isArray(arr)
      ? arr.slice(0, 6).filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

async function callClaude(
  subjectName: string,
  textContent: string | null,
  pdfBase64: string | null,
): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `Basándote en el siguiente material de la materia "${subjectName}", redactá un apunte extenso y completo — de aproximadamente 10 páginas — como si fueran tus propios apuntes de clase. Escribí todo en texto corrido, de manera clara y didáctica, sin títulos, sin bullets, sin secciones separadas. Cubrí todos los conceptos importantes, definiciones, fórmulas, ejemplos y relaciones entre ideas. El apunte tiene que ser autocontenido: alguien que lo lea tiene que poder entender el tema sin haber ido a clase.`;

  const userContent: Anthropic.MessageParam["content"] = pdfBase64
    ? [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
        } as Anthropic.DocumentBlockParam,
        { type: "text", text: prompt },
      ]
    : `${prompt}\n\n---\n\nMATERIAL:\n\n${textContent}`;

  const stream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: [
      {
        type: "text",
        text: SUMMARY_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userContent }],
  });

  const msg = await stream.finalMessage();
  const block = msg.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  return block?.text ?? "";
}

export async function uploadMaterial(formData: FormData) {
  const db        = getDb();
  const subjectId = Number(formData.get("subjectId"));
  const type      = formData.get("type") as "pdf" | "text";
  const date      = (formData.get("date") as string) || localDateStr();
  const file      = formData.get("file") as File | null;
  const text      = (formData.get("textContent") as string | null)?.trim() || null;

  let originalContent: string | null = null;
  let filename: string | null = null;
  let pdfBase64: string | null = null;

  if (type === "pdf" && file && file.size > 0) {
    filename = file.name;
    pdfBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    originalContent = pdfBase64;
  } else if (type === "text" && text) {
    originalContent = text;
  } else {
    return;
  }

  const { lastInsertRowid: materialId } = db.prepare(
    "INSERT INTO class_materials (subject_id, type, filename, original_content, date) VALUES (?, ?, ?, ?, ?)"
  ).run(subjectId, type, filename, originalContent, date);

  const subject = db.prepare("SELECT name FROM subjects WHERE id = ?").get(subjectId) as
    | { name: string } | undefined;
  if (!subject) return;

  try {
    // Run summary + exercise extraction in parallel
    const [summaryContent, exercises] = await Promise.all([
      callClaude(subject.name, text, pdfBase64),
      extractExercises(subject.name, text, pdfBase64),
    ]);

    if (summaryContent) {
      db.prepare(
        "INSERT INTO summaries (material_id, subject_id, content) VALUES (?, ?, ?)"
      ).run(materialId, subjectId, summaryContent);
    }

    // Create tasks for each extracted exercise, linked to this material
    if (exercises.length > 0) {
      const insTask = db.prepare(
        "INSERT INTO tasks (title, context, priority, subject_id, material_id) VALUES (?, 'facultad', 'media', ?, ?)"
      );
      for (const ex of exercises) {
        insTask.run(ex, subjectId, materialId);
      }
    }
  } catch (err) {
    console.error("[uploadMaterial] Claude error:", err);
  }

  revalidatePath(`/facultad/${subjectId}`);
  revalidatePath("/facultad");
  revalidatePath("/today");
}

export async function regenerateSummary(materialId: number) {
  const db = getDb();
  const mat = db.prepare(
    "SELECT cm.*, s.name as subject_name FROM class_materials cm JOIN subjects s ON s.id = cm.subject_id WHERE cm.id = ?"
  ).get(materialId) as (LocalClassMaterial & { subject_name: string }) | undefined;
  if (!mat) return;

  try {
    const pdfBase64 = mat.type === "pdf" ? mat.original_content : null;
    const text      = mat.type === "text" ? mat.original_content : null;

    const [content, exercises] = await Promise.all([
      callClaude(mat.subject_name, text, pdfBase64),
      extractExercises(mat.subject_name, text, pdfBase64),
    ]);

    if (content) {
      db.prepare("DELETE FROM summaries WHERE material_id = ?").run(materialId);
      db.prepare(
        "INSERT INTO summaries (material_id, subject_id, content) VALUES (?, ?, ?)"
      ).run(materialId, mat.subject_id, content);
    }

    // Replace extracted tasks for this material (don't touch manually-added tasks)
    db.prepare("DELETE FROM tasks WHERE material_id = ?").run(materialId);
    if (exercises.length > 0) {
      const ins = db.prepare(
        "INSERT INTO tasks (title, context, priority, subject_id, material_id) VALUES (?, 'facultad', 'media', ?, ?)"
      );
      for (const ex of exercises) ins.run(ex, mat.subject_id, materialId);
    }
  } catch (err) {
    console.error("[regenerateSummary] Claude error:", err);
  }

  revalidatePath(`/facultad/${mat.subject_id}`);
  revalidatePath("/today");
}

export async function deleteMaterial(id: number) {
  const db  = getDb();
  const mat = db.prepare("SELECT subject_id FROM class_materials WHERE id = ?").get(id) as
    | { subject_id: number } | undefined;
  db.prepare("DELETE FROM class_materials WHERE id = ?").run(id);
  if (mat) {
    revalidatePath(`/facultad/${mat.subject_id}`);
    revalidatePath("/facultad");
  }
}

type LocalClassMaterial = {
  id: number; subject_id: number; type: "pdf" | "text";
  filename: string | null; original_content: string | null;
  date: string; created_at: string;
};

// ── Glossary ───────────────────────────────────────────────────────────────

const GLOSSARY_ALLOWED = ["term", "category", "short_def", "detail", "example", "ticker"];

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
  const term      = (formData.get("term")      as string)?.trim();
  const category  = (formData.get("category")  as string)?.trim();
  const short_def = (formData.get("short_def") as string)?.trim();
  const detail    = (formData.get("detail")    as string)?.trim();
  const example   = (formData.get("example")   as string)?.trim();
  const ticker    = (formData.get("ticker")    as string)?.trim() || null;

  if (!term || !category || !short_def || !detail || !example) return null;

  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO glossary_terms (term, category, short_def, detail, example, ticker) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(term, category, short_def, detail, example, ticker);

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
