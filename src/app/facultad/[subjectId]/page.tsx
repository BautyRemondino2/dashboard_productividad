import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { localDateStr } from "@/lib/utils";
import { subjectColor, subjectColorSoft } from "@/lib/subjectColors";
import type { Subject, ClassItem, Exam, Task, ClassMaterial } from "@/lib/types";
import Link from "next/link";
import ImportZipButton from "@/components/ImportZipButton";
import MaterialDropzone from "@/components/MaterialDropzone";
import MaterialItem from "@/components/MaterialItem";
import ClaudeProjectInput from "@/components/ClaudeProjectInput";

// ─── helpers ─────────────────────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) /
      86400000
  );
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const months = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SubjectPage({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const { subjectId } = await params;
  const db = getDb();
  const today = localDateStr();

  const subject = db
    .prepare("SELECT * FROM subjects WHERE id = ?")
    .get(Number(subjectId)) as Subject | undefined;

  if (!subject) notFound();

  const classes = db
    .prepare("SELECT * FROM classes WHERE subject_id = ? ORDER BY week ASC")
    .all(subject.id) as ClassItem[];

  const exams = db
    .prepare("SELECT * FROM exams WHERE subject_id = ? ORDER BY date ASC")
    .all(subject.id) as Exam[];

  const pendingTasks = db
    .prepare(
      `SELECT t.* FROM tasks t
       WHERE t.subject_id = ? AND t.status = 'pendiente'
       ORDER BY CASE t.priority WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END, t.due_date ASC NULLS LAST`
    )
    .all(subject.id) as Task[];

  const doneTasks = db
    .prepare(
      `SELECT t.* FROM tasks t
       WHERE t.subject_id = ? AND t.status = 'hecha'
       ORDER BY t.completed_at DESC LIMIT 10`
    )
    .all(subject.id) as Task[];

  // Materials for this subject
  const materials = db
    .prepare("SELECT * FROM class_materials WHERE subject_id = ? ORDER BY kind, filename")
    .all(subject.id) as ClassMaterial[];
  const inboxMaterials = materials.filter(m => m.class_id === null);
  const materialsByClass = (classId: number) => materials.filter(m => m.class_id === classId);

  const upcomingExams = exams.filter((e) => e.date >= today && !e.grade);
  const pastExams = exams.filter((e) => e.date < today || e.grade !== null);

  const summarizedCount = classes.filter((c) => c.summarized).length;
  const graded = pastExams.filter((e) => e.grade !== null);
  const avgGrade =
    graded.length > 0
      ? graded.reduce((s, e) => s + (e.grade ?? 0), 0) / graded.length
      : null;

  return (
    <div className="px-8 py-7 max-w-[1200px]">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors mb-6"
      >
        ← Dashboard
      </Link>

      {/* Subject header */}
      <div
        className="relative rounded-xl border border-slate-800 p-6 mb-6 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${subjectColorSoft(subject.hue)} 0%, rgba(15,23,42,0.4) 60%)`,
          borderTop: `2px solid ${subjectColor(subject.hue, 70)}`,
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-widest mb-1"
              style={{ color: subjectColor(subject.hue, 70) }}
            >
              Materia
            </p>
            <h1 className="text-2xl font-semibold text-slate-100 mb-1">
              {subject.name}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-slate-500">{subject.credits} créditos</p>
              <span className="text-slate-700">·</span>
              <div className="relative">
                <ClaudeProjectInput subjectId={subject.id} currentUrl={subject.claude_project_url} />
              </div>
            </div>
          </div>

          {/* Summary stats */}
          <div className="flex items-center gap-6 text-right">
            <SubjectStat
              label="clases"
              value={`${summarizedCount}/${classes.length}`}
              color="text-slate-200"
            />
            <div className="w-px h-8 bg-slate-800" />
            <SubjectStat
              label="pendientes"
              value={pendingTasks.length}
              color="text-amber-400"
            />
            {avgGrade !== null && (
              <>
                <div className="w-px h-8 bg-slate-800" />
                <SubjectStat
                  label="promedio"
                  value={avgGrade.toFixed(1)}
                  color={
                    avgGrade >= 7
                      ? "text-emerald-400"
                      : avgGrade >= 4
                      ? "text-amber-400"
                      : "text-red-400"
                  }
                />
              </>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${classes.length > 0 ? (summarizedCount / classes.length) * 100 : 0}%`,
                background: subjectColor(subject.hue, 70),
              }}
            />
          </div>
          <span className="text-[11px] text-slate-500 shrink-0 tabular">
            {summarizedCount}/{classes.length} resumidas
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Classes */}
        <div className="col-span-2 space-y-6">
          {/* Upcoming exams */}
          {upcomingExams.length > 0 && (
            <section>
              <SectionTitle>Próximos exámenes</SectionTitle>
              <div className="space-y-2">
                {upcomingExams.map((exam) => {
                  const daysLeft = daysBetween(today, exam.date);
                  return (
                    <div
                      key={exam.id}
                      className="flex items-center justify-between px-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl"
                    >
                      <div>
                        <p className="text-[13px] text-slate-100 font-medium">
                          {exam.title}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {formatDateShort(exam.date)} · peso {Math.round(exam.weight * 100)}%
                        </p>
                      </div>
                      <span
                        className={`text-[12px] font-semibold tabular px-2.5 py-1 rounded-lg ${
                          daysLeft <= 3
                            ? "bg-red-950/60 text-red-300 border border-red-900/50"
                            : daysLeft <= 7
                            ? "bg-amber-950/60 text-amber-300 border border-amber-900/50"
                            : "bg-slate-800 text-slate-300 border border-slate-700"
                        }`}
                      >
                        {daysLeft === 0
                          ? "hoy"
                          : daysLeft === 1
                          ? "mañana"
                          : `${daysLeft}d`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Classes list */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <SectionTitle>Clases · materiales</SectionTitle>
              <ImportZipButton subjectId={subject.id} />
            </div>
            <p className="text-[10px] text-slate-600 mb-3">
              Subí un .zip con las clases ordenadas en carpetas, o arrastrá archivos sueltos sobre cada clase.
            </p>
            <div className="space-y-2">
              {classes.map((cls) => (
                <ClassCard
                  key={cls.id}
                  cls={cls}
                  hue={subject.hue}
                  subjectId={subject.id}
                  subjectName={subject.name}
                  claudeProjectUrl={subject.claude_project_url}
                  materials={materialsByClass(cls.id)}
                  allClasses={classes}
                />
              ))}
              {classes.length === 0 && (
                <p className="text-[13px] text-slate-600 py-4 text-center">
                  No hay clases todavía. Subí un .zip o creá una clase manualmente.
                </p>
              )}
            </div>
          </section>

          {/* Inbox: unassigned materials */}
          {inboxMaterials.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <SectionTitle>📥 Inbox · sin asignar</SectionTitle>
                <span className="text-[10px] text-slate-600 tabular">
                  {inboxMaterials.length} archivo{inboxMaterials.length !== 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-[10px] text-slate-600 mb-2">
                Archivos del zip que no pudieron asignarse automáticamente. Click en &ldquo;Mover&rdquo; para asignar a una clase.
              </p>
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl px-3 py-2 space-y-0.5">
                {inboxMaterials.map(m => (
                  <MaterialItem
                    key={m.id}
                    material={m}
                    classes={classes}
                    subjectName={subject.name}
                    claudeProjectUrl={subject.claude_project_url}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Past exams with grades */}
          {pastExams.length > 0 && (
            <section>
              <SectionTitle>Historial de evaluaciones</SectionTitle>
              <div className="space-y-2">
                {pastExams.map((exam) => (
                  <div
                    key={exam.id}
                    className="flex items-center justify-between px-4 py-3 bg-slate-900/40 border border-slate-800/60 rounded-xl"
                  >
                    <div>
                      <p className="text-[13px] text-slate-300">{exam.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {formatDateShort(exam.date)} · peso{" "}
                        {Math.round(exam.weight * 100)}%
                      </p>
                    </div>
                    {exam.grade !== null ? (
                      <span
                        className="text-[14px] font-semibold tabular px-2.5 py-1 rounded-lg"
                        style={{
                          color:
                            exam.grade >= 7
                              ? "rgb(52,211,153)"
                              : exam.grade >= 4
                              ? "rgb(251,191,36)"
                              : "rgb(248,113,113)",
                          background: "rgb(15,23,42)",
                        }}
                      >
                        {exam.grade.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-600">sin nota</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right: Tasks */}
        <div className="space-y-6">
          <section>
            <SectionTitle>Tareas pendientes</SectionTitle>
            {pendingTasks.length === 0 ? (
              <p className="text-[13px] text-slate-600 py-4 text-center">
                Sin tareas pendientes 🎉
              </p>
            ) : (
              <div className="space-y-2">
                {pendingTasks.map((task) => (
                  <TaskCard key={task.id} task={task} hue={subject.hue} today={today} />
                ))}
              </div>
            )}
          </section>

          {doneTasks.length > 0 && (
            <section>
              <SectionTitle>Completadas recientemente</SectionTitle>
              <div className="space-y-2 opacity-60">
                {doneTasks.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-2.5 px-3 py-2 text-[12px] text-slate-500 line-through"
                  >
                    <span className="mt-0.5 shrink-0">✓</span>
                    <span className="leading-tight">{task.title}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SubjectStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div>
      <p className={`text-xl font-semibold tabular leading-none ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
      {children}
    </h2>
  );
}

function ClassCard({
  cls,
  hue,
  subjectId,
  subjectName,
  claudeProjectUrl,
  materials,
  allClasses,
}: {
  cls: ClassItem;
  hue: number;
  subjectId: number;
  subjectName: string;
  claudeProjectUrl: string | null;
  materials: ClassMaterial[];
  allClasses: ClassItem[];
}) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700/80 transition-colors">
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Week badge */}
        <div
          className="shrink-0 mt-0.5 text-[10px] font-semibold tabular w-7 h-6 rounded flex items-center justify-center"
          style={{
            background: subjectColorSoft(hue),
            color: subjectColor(hue, 80),
          }}
        >
          {cls.week}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-slate-100 leading-tight font-medium truncate">
              {cls.title}
            </p>
            <MaterialDropzone subjectId={subjectId} classId={cls.id} compact />
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">{formatDateShort(cls.date)}</p>
          <div className="flex items-center gap-2 mt-1.5">
            {materials.length > 0 && (
              <span className="text-[10px] text-slate-500">
                <span className="tabular text-slate-300">{materials.length}</span> archivo{materials.length !== 1 ? "s" : ""}
              </span>
            )}
            {cls.tasks_total > 0 && (
              <span className="text-[10px] text-slate-500">
                · {cls.tasks_done}/{cls.tasks_total} tareas
              </span>
            )}
          </div>
          {cls.summary && (
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed line-clamp-2">
              {cls.summary}
            </p>
          )}
        </div>
      </div>

      {/* Materials list */}
      {materials.length > 0 && (
        <div className="border-t border-slate-800/70 px-3 py-2 space-y-0.5 bg-slate-950/40">
          {materials.map(m => (
            <MaterialItem
              key={m.id}
              material={m}
              classes={allClasses}
              subjectName={subjectName}
              claudeProjectUrl={claudeProjectUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  hue,
  today,
}: {
  task: Task;
  hue: number;
  today: string;
}) {
  const isOverdue = task.due_date && task.due_date < today;
  const daysLeft = task.due_date ? daysBetween(today, task.due_date) : null;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 hover:border-slate-700 transition-colors">
      <div className="flex items-start gap-2.5">
        <div
          className="shrink-0 mt-0.5 w-3.5 h-3.5 rounded-sm border flex items-center justify-center"
          style={{ borderColor: subjectColor(hue, 50) }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-slate-100 leading-tight">{task.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-[10px] font-medium ${
                task.priority === "alta"
                  ? "text-red-400"
                  : task.priority === "media"
                  ? "text-amber-400"
                  : "text-slate-500"
              }`}
            >
              {task.priority}
            </span>
            {task.due_date && (
              <span
                className={`text-[10px] tabular ${
                  isOverdue
                    ? "text-red-400"
                    : daysLeft !== null && daysLeft <= 2
                    ? "text-amber-400"
                    : "text-slate-500"
                }`}
              >
                {isOverdue
                  ? `vencida hace ${Math.abs(daysLeft!)}d`
                  : daysLeft === 0
                  ? "hoy"
                  : daysLeft === 1
                  ? "mañana"
                  : `en ${daysLeft}d`}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
