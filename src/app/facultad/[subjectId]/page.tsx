import { getDb } from "@/lib/db";
import type { Subject, ClassMaterial, Summary, Task, Exam } from "@/lib/types";
import { localDateStr } from "@/lib/utils";
import { notFound } from "next/navigation";
import Link from "next/link";
import MaterialUpload from "@/components/MaterialUpload";
import DeleteMaterialButton from "@/components/DeleteMaterialButton";
import RegenerateSummaryButton from "@/components/RegenerateSummaryButton";
import TaskItem from "@/components/TaskItem";
import AddTaskInline from "@/components/AddTaskInline";
import AddExamInline from "@/components/AddExamInline";
import DeleteExamButton from "@/components/DeleteExamButton";
import RecordGradeButton from "@/components/RecordGradeButton";

type MaterialRow = ClassMaterial & {
  summary: Summary | null;
  tasks: Task[];
};

function fmtDate(d: string) {
  const [, m, day] = d.split("-");
  const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(day)} ${months[parseInt(m) - 1]}`;
}

const EXAM_TYPE_LABEL: Record<string, string> = {
  parcial: "Parcial", final: "Final", tp: "TP", quiz: "Quiz", otro: "Otro",
};

const EXAM_TYPE_COLOR: Record<string, string> = {
  parcial: "text-violet-400 border-violet-800",
  final:   "text-red-400 border-red-800",
  tp:      "text-blue-400 border-blue-800",
  quiz:    "text-amber-400 border-amber-800",
  otro:    "text-slate-400 border-slate-700",
};

const PRIORITY_SORT = `CASE priority WHEN 'alta' THEN 1 WHEN 'media' THEN 2 WHEN 'baja' THEN 3 END`;

export default async function SubjectPage({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const { subjectId: raw } = await params;
  const db        = getDb();
  const subjectId = Number(raw);
  const today     = localDateStr();

  const subject = db.prepare("SELECT * FROM subjects WHERE id = ?").get(subjectId) as Subject | undefined;
  if (!subject) notFound();

  /* ── Materials with summaries ── */
  const materials = db
    .prepare("SELECT * FROM class_materials WHERE subject_id = ? ORDER BY date DESC, created_at DESC")
    .all(subjectId) as ClassMaterial[];

  const summaryMap = new Map<number, Summary>();
  if (materials.length > 0) {
    const ids = materials.map(m => m.id).join(",");
    const sums = db.prepare(`SELECT * FROM summaries WHERE material_id IN (${ids})`).all() as Summary[];
    for (const s of sums) summaryMap.set(s.material_id, s);
  }

  /* ── Tasks linked to each material ── */
  const allSubjectTasks = db
    .prepare(`SELECT * FROM tasks WHERE subject_id = ? ORDER BY ${PRIORITY_SORT}, due_date, created_at`)
    .all(subjectId) as Task[];

  const tasksByMaterial = new Map<number | null, Task[]>();
  for (const t of allSubjectTasks) {
    const key = t.material_id ?? null;
    if (!tasksByMaterial.has(key)) tasksByMaterial.set(key, []);
    tasksByMaterial.get(key)!.push(t);
  }

  const materialRows: MaterialRow[] = materials.map(m => ({
    ...m,
    summary: summaryMap.get(m.id) ?? null,
    tasks: tasksByMaterial.get(m.id) ?? [],
  }));

  /* Manually-added tasks (no material link) */
  const manualPending = (tasksByMaterial.get(null) ?? []).filter(t => t.status === "pendiente");
  const manualDone    = (tasksByMaterial.get(null) ?? []).filter(t => t.status === "hecha").slice(0, 3);

  const totalPending = allSubjectTasks.filter(t => t.status === "pendiente").length;

  /* ── Exams ── */
  const upcomingExams = db
    .prepare("SELECT * FROM exams WHERE subject_id = ? AND date >= ? ORDER BY date ASC")
    .all(subjectId, today) as Exam[];

  const pastExams = db
    .prepare("SELECT * FROM exams WHERE subject_id = ? AND date < ? ORDER BY date DESC")
    .all(subjectId, today) as Exam[];

  const gradedExams = pastExams.filter(e => e.grade != null);
  const avgGrade    = gradedExams.length > 0
    ? (gradedExams.reduce((s, e) => s + (e.grade ?? 0), 0) / gradedExams.length).toFixed(1)
    : null;

  const pendingSummaries = materialRows.filter(m => !m.summary).length;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">

      {/* ── Header ── */}
      <div className="mb-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">{subject.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
              <span className="text-xs text-slate-600">{materials.length} clase{materials.length !== 1 ? "s" : ""}</span>
              {totalPending > 0 && (
                <span className="text-xs text-amber-500">{totalPending} tarea{totalPending !== 1 ? "s" : ""} pendiente{totalPending !== 1 ? "s" : ""}</span>
              )}
              {avgGrade && (
                <span className="text-xs text-emerald-500">promedio {avgGrade}</span>
              )}
              {pendingSummaries > 0 && (
                <span className="text-xs text-slate-600">{pendingSummaries} sin resumir</span>
              )}
            </div>
          </div>
          {upcomingExams.length > 0 && (() => {
            const d = Math.round((new Date(upcomingExams[0].date + "T12:00:00").getTime() - new Date().getTime()) / 86_400_000);
            return (
              <div className={`shrink-0 text-right text-xs rounded-lg border px-3 py-2 ${d <= 3 ? "border-red-800 text-red-400" : d <= 7 ? "border-amber-800 text-amber-400" : "border-slate-700 text-slate-500"}`}>
                <p className="font-semibold">{EXAM_TYPE_LABEL[upcomingExams[0].type]}</p>
                <p className="opacity-70">{d === 0 ? "Hoy" : d === 1 ? "Mañana" : `en ${d}d`}</p>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ══ SECCIÓN: EXÁMENES ══ */}
      <section className="mb-10">
        <h2 className="section-title">Exámenes y TPs</h2>

        {upcomingExams.map(ex => {
          const d = Math.round((new Date(ex.date + "T12:00:00").getTime() - new Date().getTime()) / 86_400_000);
          return (
            <div key={ex.id} className="group flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 mb-2 hover:border-slate-700 transition-colors">
              <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${EXAM_TYPE_COLOR[ex.type]}`}>
                {EXAM_TYPE_LABEL[ex.type]}
              </span>
              <p className="flex-1 text-sm text-slate-200">{ex.title}</p>
              <span className={`shrink-0 text-xs font-medium tabular-nums ${d <= 0 ? "text-red-400" : d <= 3 ? "text-amber-400" : "text-slate-500"}`}>
                {d <= 0 ? "Hoy" : d === 1 ? "Mañana" : fmtDate(ex.date)}
              </span>
              <DeleteExamButton id={ex.id} />
            </div>
          );
        })}

        {pastExams.map(ex => (
          <div key={ex.id} className="group flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-slate-900 transition-colors">
            <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border opacity-50 ${EXAM_TYPE_COLOR[ex.type]}`}>
              {EXAM_TYPE_LABEL[ex.type]}
            </span>
            <p className="flex-1 text-sm text-slate-500">{ex.title}</p>
            <span className="text-xs text-slate-700 tabular-nums shrink-0">{fmtDate(ex.date)}</span>
            <RecordGradeButton examId={ex.id} currentGrade={ex.grade} />
            <DeleteExamButton id={ex.id} />
          </div>
        ))}

        <div className="mt-3">
          <AddExamInline subjects={[subject]} fixedSubjectId={subjectId} />
        </div>
      </section>

      {/* ══ SECCIÓN: TAREAS ══ */}
      <section className="mb-10">
        <h2 className="section-title">Tareas pendientes</h2>

        {totalPending === 0 && manualDone.length === 0 && (
          <p className="text-sm text-slate-600 py-1 mb-3">Sin tareas pendientes. ¡Al día!</p>
        )}

        {/* Tasks linked to specific materials */}
        {materialRows.filter(m => m.tasks.some(t => t.status === "pendiente")).map(m => (
          <div key={m.id} className="mb-4">
            <p className="text-[10px] text-slate-700 uppercase tracking-wider mb-1 pl-1">
              Clase {fmtDate(m.date)}{m.filename ? ` · ${m.filename}` : ""}
            </p>
            <div className="space-y-1">
              {m.tasks.filter(t => t.status === "pendiente").map(task => (
                <TaskItem key={task.id} task={task} showDueDate
                  isStale={task.due_date !== null && task.due_date < today && task.due_date <= localDateStr(-3)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Manually-added tasks */}
        {manualPending.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] text-slate-700 uppercase tracking-wider mb-1 pl-1">Manual</p>
            <div className="space-y-1">
              {manualPending.map(task => (
                <TaskItem key={task.id} task={task} showDueDate
                  isStale={task.due_date !== null && task.due_date < today && task.due_date <= localDateStr(-3)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Recently done */}
        {manualDone.length > 0 && (
          <div className="space-y-1 opacity-40 mb-2">
            {manualDone.map(t => <TaskItem key={t.id} task={t} />)}
          </div>
        )}

        <div className="mt-3">
          <AddTaskInline subjectId={subjectId} />
        </div>
      </section>

      {/* ══ SECCIÓN: CLASES ══ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title !mb-0">Clases</h2>
          <span className="text-xs text-slate-700">{materials.length} subida{materials.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Upload form */}
        <div className="mb-6">
          <MaterialUpload subjectId={subjectId} today={today} />
        </div>

        {materialRows.length === 0 && (
          <p className="text-sm text-slate-600">
            Todavía no subiste ninguna clase. Subí un PDF o pegá el texto de la clase — Claude generará el resumen y extraerá los ejercicios automáticamente.
          </p>
        )}

        <div className="space-y-3">
          {materialRows.map(mat => {
            const pendingCount = mat.tasks.filter(t => t.status === "pendiente").length;
            const doneCount    = mat.tasks.filter(t => t.status === "hecha").length;

            return (
              <div key={mat.id} className="group bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
                {/* Top row: date + type + filename + actions */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-slate-400 tabular-nums">{fmtDate(mat.date)}</span>
                    <span className="text-[10px] text-slate-700 border border-slate-800 rounded px-1">
                      {mat.type === "pdf" ? "PDF" : "texto"}
                    </span>
                    {mat.filename && (
                      <span className="text-[11px] text-slate-600 truncate max-w-48">{mat.filename}</span>
                    )}
                    {pendingCount > 0 && (
                      <span className="text-[10px] bg-amber-950/60 border border-amber-800 text-amber-400 rounded px-1.5 py-0.5">
                        {pendingCount} tarea{pendingCount !== 1 ? "s" : ""}
                      </span>
                    )}
                    {doneCount > 0 && pendingCount === 0 && (
                      <span className="text-[10px] text-emerald-600">✓ {doneCount} hecha{doneCount !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {mat.summary && (
                      <Link
                        href={`/facultad/${subjectId}/summary/${mat.summary.id}`}
                        className="text-xs text-slate-500 hover:text-slate-300 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        ver resumen →
                      </Link>
                    )}
                    <DeleteMaterialButton id={mat.id} />
                  </div>
                </div>

                {/* Summary or status */}
                {mat.summary ? (
                  <Link
                    href={`/facultad/${subjectId}/summary/${mat.summary.id}`}
                    className="block text-xs text-slate-500 hover:text-slate-300 transition-colors line-clamp-2 leading-relaxed"
                  >
                    {mat.summary.content.slice(0, 180)}…
                  </Link>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
                    <span className="text-xs text-slate-600">Generando resumen y ejercicios…</span>
                    <RegenerateSummaryButton materialId={mat.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
