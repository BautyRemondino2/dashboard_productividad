import { getDb } from "@/lib/db";
import type { Semester, Subject, ClassItem, Exam, Task } from "@/lib/types";
import { subjectColor, subjectColorSoft } from "@/lib/subjectColors";
import Link from "next/link";
import { notFound } from "next/navigation";

export const metadata = { title: "Archivo · Semestre" };

export default async function ArchivedSemesterPage({
  params,
}: {
  params: Promise<{ semesterId: string }>;
}) {
  const { semesterId: rawId } = await params;
  const semesterId = Number(rawId);
  if (!Number.isFinite(semesterId)) notFound();

  const db = getDb();

  const semester = db
    .prepare("SELECT * FROM semesters WHERE id = ?")
    .get(semesterId) as Semester | undefined;

  if (!semester) notFound();

  const subjects = db
    .prepare("SELECT * FROM subjects WHERE semester_id = ? ORDER BY id")
    .all(semesterId) as Subject[];

  const subjectIds = subjects.map((s) => s.id);
  const inList = subjectIds.length ? subjectIds.map(() => "?").join(",") : "NULL";

  const classes = subjectIds.length
    ? (db
        .prepare(`SELECT * FROM classes WHERE subject_id IN (${inList}) ORDER BY subject_id, week`)
        .all(...subjectIds) as ClassItem[])
    : [];

  const exams = subjectIds.length
    ? (db
        .prepare(`SELECT * FROM exams WHERE subject_id IN (${inList}) ORDER BY date`)
        .all(...subjectIds) as Exam[])
    : [];

  const tasks = subjectIds.length
    ? (db
        .prepare(`SELECT * FROM tasks WHERE subject_id IN (${inList}) ORDER BY status, due_date`)
        .all(...subjectIds) as Task[])
    : [];

  const classesBySubject = (id: number) => classes.filter((c) => c.subject_id === id);
  const examsBySubject = (id: number) => exams.filter((e) => e.subject_id === id);
  const tasksBySubject = (id: number) => tasks.filter((t) => t.subject_id === id);

  return (
    <div className="px-8 py-7 max-w-[1400px]">
      <div className="mb-6 fade-up fade-up-1">
        <Link
          href="/archivo"
          className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center gap-1 mb-2"
        >
          ← Volver al archivo
        </Link>
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-slate-600 mb-1">
              Semestre archivado
            </p>
            <h1 className="text-3xl font-semibold text-slate-100 tracking-tight tabular">
              {semester.name}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Archivado el{" "}
              {semester.archived_at
                ? new Date(semester.archived_at).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })
                : "—"}
              {" · "}solo lectura
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-500">
            <Stat label="materias" value={subjects.length} />
            <Stat label="clases" value={classes.length} />
            <Stat label="exámenes" value={exams.length} />
            <Stat label="tareas" value={tasks.length} />
          </div>
        </div>
      </div>

      {subjects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 px-8 py-16 text-center">
          <p className="text-[14px] text-slate-400">Sin materias en este semestre</p>
        </div>
      ) : (
        <div className="space-y-5 fade-up fade-up-2">
          {subjects.map((s) => (
            <SubjectArchiveCard
              key={s.id}
              subject={s}
              classes={classesBySubject(s.id)}
              exams={examsBySubject(s.id)}
              tasks={tasksBySubject(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-lg font-semibold text-slate-200 tabular leading-none">{value}</p>
      <p className="text-[9px] uppercase tracking-widest text-slate-600 mt-1">{label}</p>
    </div>
  );
}

function SubjectArchiveCard({
  subject,
  classes,
  exams,
  tasks,
}: {
  subject: Subject;
  classes: ClassItem[];
  exams: Exam[];
  tasks: Task[];
}) {
  const summarized = classes.filter((c) => c.summarized).length;
  const completedTasks = tasks.filter((t) => t.status === "hecha").length;
  const examsWithGrade = exams.filter((e) => e.grade !== null);
  const avgGrade =
    examsWithGrade.length > 0
      ? examsWithGrade.reduce((acc, e) => acc + (e.grade ?? 0), 0) / examsWithGrade.length
      : null;

  return (
    <div
      className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden"
      style={{ borderTop: `2px solid ${subjectColor(subject.hue, 70)}` }}
    >
      <div
        className="px-5 py-4 border-b border-slate-800/80"
        style={{ background: `linear-gradient(90deg, ${subjectColorSoft(subject.hue)} 0%, transparent 60%)` }}
      >
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-semibold text-slate-100">{subject.name}</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {subject.credits} créditos
              {" · "}
              {classes.length > 0 ? `${summarized}/${classes.length} clases resumidas` : "sin clases"}
              {avgGrade !== null && (
                <>
                  {" · "}
                  <span className="text-slate-300">promedio {avgGrade.toFixed(1)}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span><span className="tabular text-slate-300">{completedTasks}</span>/{tasks.length} tareas</span>
            <span><span className="tabular text-slate-300">{examsWithGrade.length}</span>/{exams.length} exámenes corregidos</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5">
        {/* Clases con resúmenes */}
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Clases</h3>
          {classes.length === 0 ? (
            <p className="text-[12px] text-slate-600 italic">—</p>
          ) : (
            <ul className="space-y-1.5">
              {classes.map((c) => (
                <li key={c.id} className="text-[12px] text-slate-300 leading-tight">
                  <span className="text-slate-500 tabular mr-2">S{c.week}</span>
                  {c.title}
                  {c.summary && (
                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5 ml-6 line-clamp-2">
                      {c.summary}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Exámenes */}
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Exámenes</h3>
          {exams.length === 0 ? (
            <p className="text-[12px] text-slate-600 italic">—</p>
          ) : (
            <ul className="space-y-1.5">
              {exams.map((e) => (
                <li key={e.id} className="text-[12px] text-slate-300 flex items-baseline justify-between gap-2">
                  <span className="truncate">{e.title}</span>
                  {e.grade !== null ? (
                    <span
                      className={`tabular shrink-0 font-medium ${
                        e.grade >= 7 ? "text-emerald-400" : e.grade >= 4 ? "text-amber-400" : "text-red-400"
                      }`}
                    >
                      {e.grade.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-slate-600 shrink-0 italic text-[11px]">sin nota</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Tareas */}
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Tareas</h3>
          {tasks.length === 0 ? (
            <p className="text-[12px] text-slate-600 italic">—</p>
          ) : (
            <ul className="space-y-1.5">
              {tasks.map((t) => (
                <li key={t.id} className="text-[12px] flex items-start gap-2 leading-tight">
                  <span
                    className={`mt-0.5 shrink-0 w-3 h-3 rounded-sm border flex items-center justify-center text-[8px] ${
                      t.status === "hecha"
                        ? "bg-emerald-700/40 border-emerald-600 text-emerald-200"
                        : "border-slate-700 text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <span className={t.status === "hecha" ? "text-slate-500 line-through" : "text-slate-300"}>
                    {t.title}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
