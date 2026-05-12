import { getDb } from "@/lib/db";
import type { Task, Subject } from "@/lib/types";
import Link from "next/link";

const PRIORITY_DOT: Record<string, string> = {
  alta:  "bg-red-500",
  media: "bg-amber-400",
  baja:  "bg-slate-600",
};

const PERIOD_OPTIONS = [
  { value: "7",   label: "7 días"  },
  { value: "30",  label: "30 días" },
  { value: "90",  label: "90 días" },
  { value: "all", label: "Todo"    },
];

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(d)} ${months[parseInt(m)-1]} ${y}`;
}

interface TaskWithSubject extends Task {
  subject_name: string | null;
}

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; period?: string }>;
}) {
  const sp        = await searchParams;
  const subjectId = sp.subject ? Number(sp.subject) : null;
  const period    = PERIOD_OPTIONS.some(p => p.value === sp.period) ? (sp.period ?? "30") : "30";

  const db       = getDb();
  const subjects = db.prepare("SELECT * FROM subjects ORDER BY name").all() as Subject[];

  let whereClause = `t.status = 'hecha' AND t.completed_at IS NOT NULL`;
  const params: (string | number)[] = [];

  if (subjectId) {
    whereClause += ` AND t.subject_id = ?`;
    params.push(subjectId);
  }

  if (period !== "all") {
    whereClause += ` AND date(t.completed_at, 'localtime') >= date('now', 'localtime', '-${parseInt(period) - 1} days')`;
  }

  const tasks = db
    .prepare(`
      SELECT t.*, s.name as subject_name
      FROM tasks t
      LEFT JOIN subjects s ON s.id = t.subject_id
      WHERE ${whereClause}
      ORDER BY t.completed_at DESC
    `)
    .all(...params) as TaskWithSubject[];

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-100">Historial</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {tasks.length} tarea{tasks.length !== 1 ? "s" : ""} completada{tasks.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-8">
        {/* Subject filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-600">Materia:</span>
          <div className="flex flex-wrap gap-1">
            <FilterChip href={buildUrl(sp, "subject", null)} active={!subjectId} label="Todas" />
            {subjects.map(s => (
              <FilterChip
                key={s.id}
                href={buildUrl(sp, "subject", String(s.id))}
                active={subjectId === s.id}
                label={s.name.split(" ").slice(0, 2).join(" ")}
              />
            ))}
          </div>
        </div>

        {/* Period filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-600">Período:</span>
          <div className="flex items-center gap-1">
            {PERIOD_OPTIONS.map(p => (
              <FilterChip
                key={p.value}
                href={buildUrl(sp, "period", p.value)}
                active={period === p.value}
                label={p.label}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <p className="text-sm text-slate-600 py-4">No hay tareas completadas en este período.</p>
      ) : (
        <div className="space-y-1">
          {tasks.map(task => (
            <div
              key={task.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-900 transition-colors"
            >
              <div className="shrink-0 w-4 h-4 rounded border border-slate-600 bg-slate-700 flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-slate-400" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[task.priority]}`} />
              <span className="flex-1 text-sm text-slate-500 line-through leading-snug">{task.title}</span>
              {task.subject_name && (
                <span className="shrink-0 text-[10px] text-slate-700 border border-slate-800 rounded px-1.5 py-0.5">
                  {task.subject_name.split(" ").slice(0, 2).join(" ")}
                </span>
              )}
              {task.completed_at && (
                <span className="shrink-0 text-xs text-slate-700 tabular-nums">
                  {fmtDate(task.completed_at.slice(0, 10))}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function buildUrl(
  current: { subject?: string; period?: string },
  key: "subject" | "period",
  value: string | null
) {
  const params = new URLSearchParams();
  if (key !== "subject" && current.subject) params.set("subject", current.subject);
  if (key !== "period"  && current.period)  params.set("period", current.period);
  if (key === "subject" && value) params.set("subject", value);
  if (key === "period"  && value) params.set("period", value);
  const qs = params.toString();
  return `/historial${qs ? `?${qs}` : ""}`;
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`px-2 py-0.5 rounded text-xs transition-colors ${
        active
          ? "bg-slate-700 text-slate-200"
          : "text-slate-600 hover:text-slate-400 hover:bg-slate-900"
      }`}
    >
      {label}
    </Link>
  );
}
