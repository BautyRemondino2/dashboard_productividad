import { getDb } from "@/lib/db";
import type { Semester, Subject } from "@/lib/types";
import { subjectColor } from "@/lib/subjectColors";
import Link from "next/link";

export const metadata = { title: "Archivo · Semestres" };

interface SemesterWithStats extends Semester {
  subject_count: number;
  class_count: number;
  exam_count: number;
  task_count: number;
}

export default function ArchivePage() {
  const db = getDb();

  const semesters = db
    .prepare(`
      SELECT
        sem.*,
        (SELECT COUNT(*) FROM subjects WHERE semester_id = sem.id) as subject_count,
        (SELECT COUNT(*) FROM classes c
          JOIN subjects sb ON sb.id = c.subject_id
          WHERE sb.semester_id = sem.id) as class_count,
        (SELECT COUNT(*) FROM exams e
          JOIN subjects sb ON sb.id = e.subject_id
          WHERE sb.semester_id = sem.id) as exam_count,
        (SELECT COUNT(*) FROM tasks t
          JOIN subjects sb ON sb.id = t.subject_id
          WHERE sb.semester_id = sem.id) as task_count
      FROM semesters sem
      WHERE sem.status = 'archived'
      ORDER BY sem.archived_at DESC, sem.id DESC
    `)
    .all() as SemesterWithStats[];

  const subjectsBySem = (semId: number) =>
    db
      .prepare("SELECT * FROM subjects WHERE semester_id = ? ORDER BY id")
      .all(semId) as Subject[];

  return (
    <div className="px-8 py-7 max-w-[1400px]">
      <div className="mb-6 fade-up fade-up-1">
        <p className="text-[11px] uppercase tracking-widest text-slate-600 mb-1">
          Archivo
        </p>
        <h1 className="text-3xl font-semibold text-slate-100 tracking-tight">
          Semestres anteriores
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {semesters.length} semestre{semesters.length !== 1 ? "s" : ""} archivado
          {semesters.length !== 1 ? "s" : ""}
        </p>
      </div>

      {semesters.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 px-8 py-16 text-center fade-up fade-up-2">
          <div className="text-4xl text-slate-700 mb-2">◇</div>
          <p className="text-[14px] text-slate-400 mb-1">Sin semestres archivados</p>
          <p className="text-[12px] text-slate-600">
            Cuando cierres un semestre desde la pantalla principal aparecerá acá.
          </p>
        </div>
      ) : (
        <div className="space-y-4 fade-up fade-up-2">
          {semesters.map((sem) => {
            const subjects = subjectsBySem(sem.id);
            return (
              <Link
                key={sem.id}
                href={`/archivo/${sem.id}`}
                className="block rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/70 px-5 py-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-100 tabular">
                      {sem.name}
                    </h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Archivado el{" "}
                      {sem.archived_at
                        ? new Date(sem.archived_at).toLocaleDateString("es-AR", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })
                        : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500 uppercase tracking-widest">
                    <span className="tabular text-slate-300">{sem.subject_count}</span> materias ·{" "}
                    <span className="tabular text-slate-300">{sem.class_count}</span> clases ·{" "}
                    <span className="tabular text-slate-300">{sem.exam_count}</span> exámenes ·{" "}
                    <span className="tabular text-slate-300">{sem.task_count}</span> tareas
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {subjects.map((s) => (
                    <span
                      key={s.id}
                      className="text-[11px] px-2 py-0.5 rounded-md border tabular"
                      style={{
                        borderColor: subjectColor(s.hue, 35),
                        color: subjectColor(s.hue, 78),
                        background: `oklch(28% 0.05 ${s.hue} / 0.2)`,
                      }}
                    >
                      {s.short}
                    </span>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
