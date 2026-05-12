import { getDb } from "@/lib/db";
import type { Task, Exam, Subject } from "@/lib/types";
import { localDateStr } from "@/lib/utils";
import TaskItem from "@/components/TaskItem";
import AddTaskInline from "@/components/AddTaskInline";
import FocusBlock from "@/components/today/FocusBlock";
import Link from "next/link";

const PRIORITY_SORT = `CASE t.priority WHEN 'alta' THEN 1 WHEN 'media' THEN 2 WHEN 'baja' THEN 3 END`;

function formatDate(dateStr: string): string {
  const months = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const [, m, d] = dateStr.split("-");
  return `${parseInt(d)} de ${months[parseInt(m)-1]}`;
}

const DAY_NAMES = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

const EXAM_TYPE_LABEL: Record<string, string> = {
  parcial: "Parcial", final: "Final", tp: "TP", quiz: "Quiz", otro: "Otro",
};

interface TaskWithSubject extends Task {
  subject_name: string | null;
}

interface ExamWithSubject extends Exam {
  subject_name: string;
}

function scoreFocusTask(task: TaskWithSubject, today: string, urgentSubjectId: number | null): number {
  const p  = task.priority === "alta" ? 30 : task.priority === "media" ? 20 : 10;
  let   u  = 0;
  if (task.due_date) {
    if (task.due_date < today)        u = 50;
    else if (task.due_date === today) u = 30;
    else if (task.due_date <= localDateStr(1)) u = 10;
  }
  const bonus = urgentSubjectId !== null && task.subject_id === urgentSubjectId ? 20 : 0;
  return p + u + bonus;
}

// SVG productivity ring — server-renderable
function ProductivityRing({ score, done, total }: { score: number; done: number; total: number }) {
  const R    = 26;
  const circ = 2 * Math.PI * R;
  const dash = circ * Math.max(0, Math.min(score, 100)) / 100;
  const color = score >= 80 ? "#10b981" : score >= 40 ? "#f59e0b" : score > 0 ? "#64748b" : "#334155";
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-14 h-14 shrink-0">
        <svg className="-rotate-90 w-full h-full" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={R} strokeWidth="5" stroke="#1e293b" fill="none" />
          <circle cx="32" cy="32" r={R} strokeWidth="5" stroke={color} fill="none"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold tabular-nums" style={{ color }}>{score}%</span>
        </div>
      </div>
      <div className="text-xs text-slate-500 leading-5">
        <p><span className="text-slate-300 font-medium">{done}</span> hechas</p>
        <p><span className="text-slate-300 font-medium">{total}</span> totales hoy</p>
      </div>
    </div>
  );
}

export default function TodayPage() {
  const db    = getDb();
  const today = localDateStr();
  const in7   = localDateStr(7);
  const stale = localDateStr(-3);
  const dayName = DAY_NAMES[new Date().getDay()];

  /* ── Tasks ── */
  const overdue = db.prepare(`
    SELECT t.*, s.name as subject_name
    FROM tasks t LEFT JOIN subjects s ON s.id = t.subject_id
    WHERE t.context = 'facultad' AND t.due_date < ? AND t.status = 'pendiente'
    ORDER BY ${PRIORITY_SORT}, t.created_at
  `).all(today) as TaskWithSubject[];

  const todayTasks = db.prepare(`
    SELECT t.*, s.name as subject_name
    FROM tasks t LEFT JOIN subjects s ON s.id = t.subject_id
    WHERE t.context = 'facultad' AND t.due_date = ?
    ORDER BY t.status, ${PRIORITY_SORT}, t.created_at
  `).all(today) as TaskWithSubject[];

  const allPending = db.prepare(`
    SELECT t.*, s.name as subject_name
    FROM tasks t LEFT JOIN subjects s ON s.id = t.subject_id
    WHERE t.context = 'facultad' AND t.status = 'pendiente'
    ORDER BY ${PRIORITY_SORT}, t.due_date
  `).all() as TaskWithSubject[];

  const pendingToday = todayTasks.filter(t => t.status === "pendiente").length;
  const doneToday    = todayTasks.filter(t => t.status === "hecha").length;
  const totalToday   = pendingToday + doneToday;
  const prodScore    = totalToday > 0 ? Math.round((doneToday / totalToday) * 100) : 0;

  /* ── Upcoming exams ── */
  const upcomingExams = db.prepare(`
    SELECT e.*, s.name as subject_name
    FROM exams e JOIN subjects s ON s.id = e.subject_id
    WHERE e.date >= ? AND e.date <= ? ORDER BY e.date ASC
  `).all(today, in7) as ExamWithSubject[];

  const nearestExam      = upcomingExams[0] ?? null;
  const nearestExamDays  = nearestExam
    ? Math.round((new Date(nearestExam.date + "T12:00:00").getTime() - new Date().getTime()) / 86_400_000)
    : null;

  /* ── Focus task ── */
  const focusTask = allPending.length > 0
    ? allPending.reduce((best, t) =>
        scoreFocusTask(t, today, nearestExam?.subject_id ?? null) >
        scoreFocusTask(best, today, nearestExam?.subject_id ?? null) ? t : best
      )
    : null;

  /* ── Subjects for add-task form ── */
  const subjects = db.prepare("SELECT id, name FROM subjects ORDER BY name").all() as Subject[];

  /* ── Exam urgency style ── */
  const examStyle =
    nearestExamDays === 0 ? "border-red-700 bg-red-950/40 text-red-300"
    : nearestExamDays !== null && nearestExamDays <= 2 ? "border-amber-700 bg-amber-950/30 text-amber-300"
    : nearestExamDays !== null && nearestExamDays <= 5 ? "border-violet-800 bg-violet-950/30 text-violet-300"
    : "border-slate-700 bg-slate-900/50 text-slate-400";

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">

      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">{dayName}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{formatDate(today)}</p>
        </div>
        <ProductivityRing score={prodScore} done={doneToday} total={totalToday} />
      </div>

      {/* ── Nearest exam countdown ── */}
      {nearestExam !== null && nearestExamDays !== null && nearestExamDays <= 7 && (
        <div className={`mb-6 rounded-xl border px-5 py-4 ${examStyle}`}>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest opacity-60 mb-1">
                {nearestExamDays === 0 ? "⚡ Hoy"
                  : nearestExamDays === 1 ? "⚠ Mañana"
                  : `📅 En ${nearestExamDays} días`}
                {" · "}{EXAM_TYPE_LABEL[nearestExam.type]}
              </p>
              <p className="text-base font-semibold truncate">{nearestExam.title}</p>
              <p className="text-xs opacity-60 mt-0.5">{nearestExam.subject_name}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-4xl font-black tabular-nums leading-none">{nearestExamDays}</p>
              <p className="text-xs opacity-50 mt-0.5">{nearestExamDays === 1 ? "día" : "días"}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick stats ── */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatCard label="Para hoy"  value={pendingToday} />
        <StatCard label="Vencidas"  value={overdue.length}  color={overdue.length > 0 ? "red" : undefined} />
        <StatCard label="Hechas"    value={doneToday}        color={doneToday > 0 ? "emerald" : undefined} />
      </div>

      {/* ── Focus block ── */}
      {focusTask && (
        <FocusBlock
          task={focusTask}
          today={today}
          subjectName={focusTask.subject_name}
          hasNearbyExam={
            nearestExam?.subject_id === focusTask.subject_id &&
            nearestExamDays !== null && nearestExamDays <= 5
          }
        />
      )}

      {/* ── Overdue ── */}
      {overdue.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-red-400 mb-3">
            Vencidas — {overdue.length}
          </h2>
          <div className="space-y-1">
            {overdue.map(task => (
              <TaskItem key={task.id} task={task} showDueDate
                isStale={task.due_date !== null && task.due_date <= stale} />
            ))}
          </div>
        </section>
      )}

      {/* ── Today ── */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
          Para hoy
        </h2>
        {todayTasks.length === 0 && (
          <p className="text-sm text-slate-600 py-1">Nada asignado para hoy.</p>
        )}
        <div className="space-y-1 mb-5">
          {todayTasks.map(task => <TaskItem key={task.id} task={task} />)}
        </div>
        <AddTaskInline defaultDueDate={today} subjects={subjects} />
      </section>

      {/* ── Backlog without date ── */}
      {allPending.filter(t => !t.due_date).length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-700 mb-3">
            Sin fecha
          </h2>
          <div className="space-y-1">
            {allPending.filter(t => !t.due_date).slice(0, 8).map(task => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
          {allPending.filter(t => !t.due_date).length > 8 && (
            <p className="text-xs text-slate-700 mt-2 pl-3">
              +{allPending.filter(t => !t.due_date).length - 8} más · revisá cada materia
            </p>
          )}
        </section>
      )}

      {/* ── Subject quick links ── */}
      {subjects.length > 0 && (
        <div className="mt-12 pt-6 border-t border-slate-800">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-700 mb-3">Materias</p>
          <div className="flex flex-wrap gap-2">
            {subjects.map(s => {
              const pending = allPending.filter(t => t.subject_id === s.id).length;
              return (
                <Link
                  key={s.id}
                  href={`/facultad/${s.id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {s.name.split(" ").slice(0, 2).join(" ")}
                  {pending > 0 && (
                    <span className="bg-amber-500 text-slate-950 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {pending}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: {
  label: string; value: number; color?: "red" | "emerald";
}) {
  const c = color === "red" ? "text-red-400" : color === "emerald" ? "text-emerald-400" : "text-slate-100";
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
      <p className="text-[11px] text-slate-500 mb-0.5">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${c}`}>{value}</p>
    </div>
  );
}
