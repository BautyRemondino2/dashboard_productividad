import { getDb } from "@/lib/db";
import type { Task, Subject } from "@/lib/types";
import { localDateStr } from "@/lib/utils";
import TaskItem from "@/components/TaskItem";
import AddTaskInline from "@/components/AddTaskInline";
import Link from "next/link";
import { subjectColor, subjectColorSoft } from "@/lib/subjectColors";

// ────────────────────────────── Types ──────────────────────────────

interface SubjectRow {
  id: number;
  name: string;
  short: string;
  hue: number;
  credits: number;
}

interface ExamRow {
  id: number;
  subject_id: number;
  title: string;
  type: string;
  date: string;
  grade: number | null;
  weight: number;
}

interface MaterialRow {
  id: number;
  subject_id: number;
  filename: string | null;
  type: string;
  date: string;
  summarized: number;
  pending_tasks: number;
  total_tasks: number;
  week_num: number;
}

interface TaskWithSubject extends Task {
  subject_name: string | null;
}

// ────────────────────────────── Constants ──────────────────────────

const PRIORITY_SORT = `CASE t.priority WHEN 'alta' THEN 1 WHEN 'media' THEN 2 WHEN 'baja' THEN 3 END`;

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const EXAM_TYPE_LABEL: Record<string, string> = {
  parcial: "Parcial", final: "Final", tp: "TP", quiz: "Quiz", otro: "Otro",
};

function formatDate(dateStr: string): string {
  const months = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const [, m, d] = dateStr.split("-");
  return `${parseInt(d)} de ${months[parseInt(m) - 1]}`;
}

function scoreFocusTask(
  task: TaskWithSubject,
  today: string,
  urgentSubjectId: number | null,
): number {
  const p = task.priority === "alta" ? 30 : task.priority === "media" ? 20 : 10;
  let u = 0;
  if (task.due_date) {
    if (task.due_date < today)              u = 50;
    else if (task.due_date === today)       u = 30;
    else if (task.due_date <= localDateStr(1)) u = 10;
  }
  const bonus =
    urgentSubjectId !== null && task.subject_id === urgentSubjectId ? 20 : 0;
  return p + u + bonus;
}

// ────────────────────────────── Sub-components ─────────────────────

function Topbar({
  dayName,
  dateLabel,
  doneToday,
  pendingToday,
  overdueCount,
  prodScore,
}: {
  dayName: string;
  dateLabel: string;
  doneToday: number;
  pendingToday: number;
  overdueCount: number;
  prodScore: number;
}) {
  const R = 22;
  const circ = 2 * Math.PI * R;
  const dash = circ * Math.max(0, Math.min(prodScore, 100)) / 100;
  const ringColor =
    prodScore >= 80 ? "rgb(52,211,153)"
    : prodScore >= 40 ? "rgb(251,191,36)"
    : "rgb(100,116,139)";

  return (
    <div className="flex items-end justify-between gap-6 mb-6 fade-up fade-up-1">
      <div>
        <p className="text-[11px] uppercase tracking-widest text-slate-600 mb-1">Hoy</p>
        <h1 className="text-3xl font-semibold text-slate-100 tracking-tight">{dayName}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{dateLabel}</p>
      </div>

      <div className="flex items-center gap-6">
        {/* Quick stats with dividers */}
        <div className="flex items-center gap-5 text-right">
          <div>
            <p className="text-2xl font-semibold tabular-nums leading-none text-emerald-400">{doneToday}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">hechas hoy</p>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div>
            <p className="text-2xl font-semibold tabular-nums leading-none text-amber-400">{pendingToday}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">pendientes</p>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div>
            <p className={`text-2xl font-semibold tabular-nums leading-none ${overdueCount > 0 ? "text-red-400" : "text-slate-500"}`}>
              {overdueCount}
            </p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">vencidas</p>
          </div>
        </div>

        {/* Productivity ring */}
        <div className="relative w-12 h-12 shrink-0">
          <svg viewBox="0 0 52 52" className="-rotate-90 w-full h-full">
            <circle cx="26" cy="26" r={R} stroke="rgb(30,41,59)" strokeWidth="4" fill="none" />
            <circle
              cx="26" cy="26" r={R}
              stroke={ringColor}
              strokeWidth="4"
              fill="none"
              strokeDasharray={`${dash} ${circ}`}
              strokeLinecap="round"
            />
          </svg>
          <div
            className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums"
            style={{ color: ringColor }}
          >
            {prodScore}%
          </div>
        </div>
      </div>
    </div>
  );
}

function FocusSection({
  task,
  subject,
  today,
  nearestExam,
}: {
  task: TaskWithSubject;
  subject: SubjectRow | undefined;
  today: string;
  nearestExam: ExamRow | null;
}) {
  if (!subject) return null;
  const { hue } = subject;

  const dueDate = task.due_date;
  let daysInfo = "";
  if (dueDate) {
    const diff = Math.round(
      (new Date(dueDate + "T12:00:00").getTime() - new Date(today + "T12:00:00").getTime()) /
      86_400_000,
    );
    if (diff < 0)      daysInfo = `venció hace ${Math.abs(diff)} día${Math.abs(diff) !== 1 ? "s" : ""}`;
    else if (diff === 0) daysInfo = "vence hoy";
    else               daysInfo = `vence en ${diff} día${diff !== 1 ? "s" : ""}`;
  }

  const examDays =
    nearestExam && nearestExam.subject_id === subject.id
      ? Math.round(
          (new Date(nearestExam.date + "T12:00:00").getTime() -
            new Date(today + "T12:00:00").getTime()) /
            86_400_000,
        )
      : null;

  const priorityColor =
    task.priority === "alta" ? "#f87171"
    : task.priority === "media" ? "#fbbf24"
    : "#94a3b8";

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-slate-800 p-5 mb-6 fade-up fade-up-2"
      style={{
        background: `linear-gradient(135deg, ${subjectColorSoft(hue)} 0%, rgba(15,23,42,0.4) 60%)`,
      }}
    >
      {/* left accent line */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ background: subjectColor(hue, 70) }}
      />

      <div className="flex items-start gap-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: subjectColor(hue, 78) }}
            >
              ◎ Foco del día
            </span>
            <span className="text-[10px] text-slate-500">
              · sugerido por prioridad + cercanía de examen
            </span>
          </div>
          <h2 className="text-lg font-medium text-slate-100 leading-snug mb-2 text-pretty">
            {task.title}
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span className="px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300">
              {subject.short}
            </span>
            <span className="font-medium" style={{ color: priorityColor }}>
              ● {task.priority}
            </span>
            {daysInfo && <span className="text-slate-500">{daysInfo}</span>}
            {examDays !== null && nearestExam && (
              <span className="text-slate-500">
                · {nearestExam.title} en {examDays} día{examDays !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0">
          <Link
            href={`/facultad/${subject.id}`}
            className="px-4 py-2 rounded-lg text-[12px] font-medium text-slate-100 transition-colors block text-center"
            style={{
              background: subjectColor(hue, 35),
              border: `1px solid ${subjectColor(hue, 55)}`,
            }}
          >
            Ver materia →
          </Link>
        </div>
      </div>
    </div>
  );
}

function ClassRow({ mat, hue }: { mat: MaterialRow; hue: number }) {
  const rawName = mat.filename ?? `Material ${mat.week_num}`;
  const title = rawName.replace(/\.[^/.]+$/, "");
  const done = mat.total_tasks - mat.pending_tasks;

  return (
    <div className="group flex items-start gap-2.5 px-3 py-2 rounded-md hover:bg-slate-800/40 transition-colors border border-transparent hover:border-slate-700/50">
      {/* Week chip */}
      <div
        className="shrink-0 mt-0.5 text-[10px] font-semibold tabular-nums w-6 h-5 rounded flex items-center justify-center"
        style={{
          background: subjectColorSoft(hue),
          color: subjectColor(hue, 80),
        }}
      >
        {mat.week_num}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-slate-200 leading-tight truncate group-hover:text-slate-100">
          {title}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          {mat.summarized ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400/80">
              <span className="w-1 h-1 rounded-full bg-emerald-400" />
              resumen
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-400/80">
              <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
              sin resumir
            </span>
          )}
          {mat.total_tasks > 0 && (
            <span className="text-[10px] text-slate-500">
              · {done}/{mat.total_tasks} tareas
            </span>
          )}
        </div>
      </div>

      {mat.pending_tasks > 0 && (
        <div
          className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-amber-400"
          title={`${mat.pending_tasks} pendientes`}
        />
      )}
    </div>
  );
}

function SubjectColumn({
  subject,
  materials,
  exams,
  today,
}: {
  subject: SubjectRow;
  materials: MaterialRow[];
  exams: ExamRow[];
  today: string;
}) {
  const { hue } = subject;
  const summarized = materials.filter(m => m.summarized).length;
  const total = materials.length;

  const nextExam = exams
    .filter(e => e.subject_id === subject.id && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;

  const daysToExam = nextExam
    ? Math.round(
        (new Date(nextExam.date + "T12:00:00").getTime() -
          new Date(today + "T12:00:00").getTime()) /
          86_400_000,
      )
    : null;

  const examBadgeClass =
    daysToExam !== null && daysToExam <= 3
      ? "bg-red-950/60 text-red-300"
      : daysToExam !== null && daysToExam <= 7
      ? "bg-amber-950/60 text-amber-300"
      : "bg-slate-800/80 text-slate-400";

  const examLabel =
    daysToExam === 0 ? "hoy"
    : daysToExam === 1 ? "mañana"
    : daysToExam !== null ? `${daysToExam}d`
    : "";

  return (
    <div
      className="flex flex-col bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors"
      style={{ borderTop: `2px solid ${subjectColor(hue, 70)}` }}
    >
      {/* Header */}
      <div className="px-3.5 pt-3 pb-3 border-b border-slate-800/80">
        <h3 className="text-[13px] font-medium text-slate-100 leading-tight truncate mb-1.5">
          {subject.short}
        </h3>

        {/* Progress strip */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: total > 0 ? `${(summarized / total) * 100}%` : "0%",
                background: subjectColor(hue, 70),
              }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-slate-500 shrink-0">
            {summarized}/{total}
          </span>
        </div>

        {/* Exam badge */}
        {nextExam && daysToExam !== null && daysToExam <= 14 && (
          <div className="mt-2 flex items-center justify-between text-[10px]">
            <span className="text-slate-500">
              {EXAM_TYPE_LABEL[nextExam.type] ?? nextExam.type}
            </span>
            <span className={`tabular-nums font-medium px-1.5 py-0.5 rounded ${examBadgeClass}`}>
              {examLabel}
            </span>
          </div>
        )}
      </div>

      {/* Materials list */}
      <div className="flex-1 py-1.5 px-1">
        {materials.length === 0 ? (
          <p className="text-[11px] text-slate-600 px-3 py-2">Sin materiales cargados.</p>
        ) : (
          materials.map(m => <ClassRow key={m.id} mat={m} hue={hue} />)
        )}
      </div>

      {/* Footer link */}
      <Link
        href={`/facultad/${subject.id}`}
        className="text-[11px] text-slate-600 hover:text-slate-300 hover:bg-slate-800/50 transition-colors py-2 border-t border-slate-800/80 flex items-center justify-center gap-1.5"
      >
        <span className="text-base leading-none">+</span> subir material
      </Link>
    </div>
  );
}

function ActivityHeatmap({
  heatmap,
}: {
  heatmap: { date: string; count: number }[];
}) {
  const cell = 12;
  const gap = 3;
  const weeks = 12;
  const days = 7;

  const colorForCount = (v: number | null): string => {
    if (v === null) return "transparent";
    if (v === 0)    return "rgb(30,41,59)";
    if (v === 1)    return "oklch(38% 0.08 160)";
    if (v <= 2)     return "oklch(52% 0.13 160)";
    if (v <= 4)     return "oklch(64% 0.15 160)";
    return "oklch(76% 0.17 160)";
  };

  // Build a date → count map
  const countMap: Record<string, number> = {};
  for (const d of heatmap) countMap[d.date] = d.count;

  // Build grid: 12 cols × 7 rows starting from (today - 83 days)
  const grid: ({ date: string; count: number } | null)[][] = [];
  // Find the first date in heatmap or compute it
  const totalActivity = heatmap.reduce((s, d) => s + d.count, 0);
  const activeDays = heatmap.filter(d => d.count > 0).length;
  let streak = 0;
  let maxStreak = 0;
  for (const d of heatmap) {
    if (d.count > 0) { streak++; maxStreak = Math.max(maxStreak, streak); }
    else streak = 0;
  }

  // Compute first date (84 days ago)
  const firstDateObj = new Date();
  firstDateObj.setDate(firstDateObj.getDate() - 83);
  const startDow = firstDateObj.getDay(); // 0=Sun

  for (let w = 0; w < weeks; w++) {
    const col: ({ date: string; count: number } | null)[] = [];
    for (let d = 0; d < days; d++) {
      const idx = w * days + d - startDow;
      if (idx < 0 || idx >= 84) {
        col.push(null);
      } else {
        const dateObj = new Date(firstDateObj);
        dateObj.setDate(firstDateObj.getDate() + idx);
        const dateStr = dateObj.toISOString().slice(0, 10);
        col.push({ date: dateStr, count: countMap[dateStr] ?? 0 });
      }
    }
    grid.push(col);
  }

  const svgWidth = weeks * (cell + gap);
  const svgHeight = days * (cell + gap);

  return (
    <div className="col-span-3 bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col">
      <div className="mb-4">
        <h3 className="text-[13px] font-medium text-slate-200">Actividad · últimos 84 días</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {activeDays} días activos · racha máx {maxStreak} días
        </p>
      </div>
      <div className="flex-1 flex flex-col justify-between">
        <div className="flex items-start gap-2 mt-2">
          <div
            className="flex flex-col justify-between text-[9px] text-slate-600 pr-1 pt-0.5 leading-none"
            style={{ height: svgHeight }}
          >
            <span>D</span>
            <span>L</span>
            <span>M</span>
            <span>X</span>
            <span>J</span>
            <span>V</span>
            <span>S</span>
          </div>
          <svg width={svgWidth} height={svgHeight} className="overflow-visible">
            {grid.map((col, w) =>
              col.map((day, d) =>
                day ? (
                  <rect
                    key={`${w}-${d}`}
                    x={w * (cell + gap)}
                    y={d * (cell + gap)}
                    width={cell}
                    height={cell}
                    rx={2}
                    fill={colorForCount(day.count)}
                  >
                    <title>{day.date} · {day.count} actividades</title>
                  </rect>
                ) : null,
              ),
            )}
          </svg>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/60">
          <div className="text-[11px] text-slate-500">
            <span className="text-slate-300 font-medium tabular-nums">{totalActivity}</span> tareas completadas
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
            <span>menos</span>
            {([0, 1, 2, 3, 5] as const).map((v, i) => (
              <span
                key={i}
                className="w-2.5 h-2.5 rounded-sm"
                style={{ background: colorForCount(v) }}
              />
            ))}
            <span>más</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubjectLoad({
  loadData,
}: {
  loadData: {
    id: number;
    short: string;
    hue: number;
    load: number;
    avgGrade: number | null;
  }[];
}) {
  const maxLoad = Math.max(...loadData.map(r => r.load), 8);
  const cx = 110;
  const cy = 110;
  const ringGap = 8;
  const innerR = 32;
  const ringW = 10;
  const totalLoad = loadData.reduce((s, r) => s + r.load, 0);
  const sorted = [...loadData].sort((a, b) => b.load - a.load);

  return (
    <div className="col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col">
      <div className="mb-4">
        <h3 className="text-[13px] font-medium text-slate-200">Carga por materia</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">Resúmenes pendientes + tareas + exámenes</p>
      </div>
      <div className="flex items-center gap-4 flex-1">
        <svg width="220" height="220" viewBox="0 0 220 220" className="shrink-0">
          {loadData.map((r, i) => {
            const radius = innerR + i * (ringW + ringGap);
            const circ = 2 * Math.PI * radius;
            const pct = maxLoad > 0 ? r.load / maxLoad : 0;
            return (
              <g key={r.id} transform={`rotate(-90 ${cx} ${cy})`}>
                <circle
                  cx={cx} cy={cy} r={radius}
                  fill="none"
                  stroke="rgb(30,41,59)"
                  strokeWidth={ringW}
                />
                <circle
                  cx={cx} cy={cy} r={radius}
                  fill="none"
                  stroke={subjectColor(r.hue, 70)}
                  strokeWidth={ringW}
                  strokeLinecap="round"
                  strokeDasharray={`${circ * pct} ${circ}`}
                />
              </g>
            );
          })}
          <text
            x={cx} y={cy - 6}
            textAnchor="middle"
            fill="rgb(148,163,184)"
            style={{ fontSize: 10 }}
          >
            carga
          </text>
          <text
            x={cx} y={cy + 12}
            textAnchor="middle"
            fill="rgb(241,245,249)"
            fontWeight="600"
            style={{ fontSize: 20 }}
          >
            {totalLoad}
          </text>
        </svg>
        <div className="flex-1 space-y-1.5 min-w-0">
          {sorted.map(r => (
            <div key={r.id} className="flex items-center gap-2 text-[11px]">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: subjectColor(r.hue, 70) }}
              />
              <span className="text-slate-300 truncate flex-1">{r.short}</span>
              <span className="text-slate-500 tabular-nums">{r.load}</span>
              {r.avgGrade !== null && (
                <span
                  className="tabular-nums text-[10px] px-1 py-0.5 rounded font-medium"
                  style={{
                    color:
                      r.avgGrade >= 7 ? "rgb(52,211,153)"
                      : r.avgGrade >= 4 ? "rgb(251,191,36)"
                      : "rgb(248,113,113)",
                    background: "rgb(15,23,42)",
                  }}
                >
                  {r.avgGrade.toFixed(1)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WeeklyTasksChart({
  weeklyData,
  subjects,
}: {
  weeklyData: { wkLabel: string; counts: number[] }[];
  subjects: SubjectRow[];
}) {
  const maxPerWeek = Math.max(
    ...weeklyData.map(wk => wk.counts.reduce((s, v) => s + v, 0)),
    1,
  );
  const padding = { top: 16, right: 16, bottom: 28, left: 28 };
  const w = 560;
  const h = 220;
  const innerW = w - padding.left - padding.right;
  const innerH = h - padding.top - padding.bottom;
  const step = innerW / weeklyData.length;
  const barW = step * 0.6;

  const yTicks = [0, Math.ceil(maxPerWeek / 2), maxPerWeek];

  const totalThisWeek =
    weeklyData.length > 0
      ? weeklyData[weeklyData.length - 1].counts.reduce((s, v) => s + v, 0)
      : 0;
  const totalLastWeek =
    weeklyData.length > 1
      ? weeklyData[weeklyData.length - 2].counts.reduce((s, v) => s + v, 0)
      : 0;
  const delta = totalThisWeek - totalLastWeek;

  return (
    <div className="col-span-3 bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col">
      <div className="mb-4">
        <h3 className="text-[13px] font-medium text-slate-200">Tareas completadas · 8 semanas</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">Apiladas por materia</p>
      </div>
      <div className="flex flex-col flex-1">
        <div className="flex items-center gap-3 mb-3 text-[11px] flex-wrap">
          {subjects.map(s => (
            <div key={s.id} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ background: subjectColor(s.hue, 70) }}
              />
              <span className="text-slate-400">{s.short}</span>
            </div>
          ))}
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="xMidYMid meet">
          {yTicks.map(t => (
            <g key={t}>
              <line
                x1={padding.left}
                x2={w - padding.right}
                y1={padding.top + innerH - (t / maxPerWeek) * innerH}
                y2={padding.top + innerH - (t / maxPerWeek) * innerH}
                stroke="rgb(30,41,59)"
                strokeDasharray="2 3"
              />
              <text
                x={padding.left - 6}
                y={padding.top + innerH - (t / maxPerWeek) * innerH + 3}
                textAnchor="end"
                style={{ fontSize: 9 }}
                fill="rgb(71,85,105)"
              >
                {t}
              </text>
            </g>
          ))}

          {weeklyData.map((wk, i) => {
            const x = padding.left + i * step + (step - barW) / 2;
            let yCursor = padding.top + innerH;
            return (
              <g key={wk.wkLabel}>
                {wk.counts.map((v, j) => {
                  const segH = maxPerWeek > 0 ? (v / maxPerWeek) * innerH : 0;
                  yCursor -= segH;
                  return (
                    <rect
                      key={j}
                      x={x}
                      y={yCursor}
                      width={barW}
                      height={segH}
                      fill={subjectColor(subjects[j]?.hue ?? 220, 68)}
                      rx={j === wk.counts.length - 1 ? 2 : 0}
                    >
                      <title>
                        {subjects[j]?.short ?? `#${j + 1}`}: {v}
                      </title>
                    </rect>
                  );
                })}
                <text
                  x={x + barW / 2}
                  y={h - 10}
                  textAnchor="middle"
                  style={{ fontSize: 10 }}
                  fill="rgb(71,85,105)"
                >
                  {wk.wkLabel}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/60 text-[11px]">
          <div className="text-slate-500">
            esta semana:{" "}
            <span className="text-slate-300 font-medium tabular-nums">{totalThisWeek}</span>
          </div>
          <div
            className={`tabular-nums ${
              delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-slate-500"
            }`}
          >
            {delta > 0 ? "↑" : delta < 0 ? "↓" : "·"} {Math.abs(delta)} vs sem. anterior
          </div>
        </div>
      </div>
    </div>
  );
}

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-slate-400 text-[9px]">
        {keys}
      </kbd>
      <span>{label}</span>
    </span>
  );
}

// ────────────────────────────── Page ───────────────────────────────

export default function TodayPage() {
  const db = getDb();
  const today = localDateStr();
  const todayDate = new Date(today + "T12:00:00");
  const stale = localDateStr(-3);
  const dayName = DAY_NAMES[new Date().getDay()];

  /* ── Subjects ── */
  const subjects = db
    .prepare("SELECT id, name, short, hue, credits FROM subjects ORDER BY name")
    .all() as SubjectRow[];

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
  const allUpcomingExams = db
    .prepare("SELECT e.* FROM exams e WHERE e.date >= ? ORDER BY e.date ASC")
    .all(today) as ExamRow[];

  const nearestExam = allUpcomingExams[0] ?? null;
  const nearestExamDays = nearestExam
    ? Math.round(
        (new Date(nearestExam.date + "T12:00:00").getTime() - new Date().getTime()) /
          86_400_000,
      )
    : null;

  /* ── Focus task ── */
  const focusTask =
    allPending.length > 0
      ? allPending.reduce((best, t) =>
          scoreFocusTask(t, today, nearestExam?.subject_id ?? null) >
          scoreFocusTask(best, today, nearestExam?.subject_id ?? null)
            ? t
            : best,
        )
      : null;
  const focusSubject = focusTask
    ? subjects.find(s => s.id === focusTask.subject_id)
    : undefined;

  /* ── Class materials ── */
  const materials = db.prepare(`
    SELECT
      cm.id, cm.subject_id, cm.filename, cm.type, cm.date,
      CASE WHEN s2.id IS NOT NULL THEN 1 ELSE 0 END as summarized,
      COALESCE(SUM(CASE WHEN t.status = 'pendiente' THEN 1 ELSE 0 END), 0) as pending_tasks,
      COALESCE(COUNT(t.id), 0) as total_tasks,
      ROW_NUMBER() OVER (PARTITION BY cm.subject_id ORDER BY cm.date, cm.id) as week_num
    FROM class_materials cm
    LEFT JOIN summaries s2 ON s2.material_id = cm.id
    LEFT JOIN tasks t ON t.material_id = cm.id
    GROUP BY cm.id
    ORDER BY cm.subject_id, cm.date, cm.id
  `).all() as MaterialRow[];

  /* ── Activity heatmap ── */
  const heatmapStart = new Date(todayDate);
  heatmapStart.setDate(heatmapStart.getDate() - 83);
  const heatmapRaw = db.prepare(`
    SELECT substr(completed_at, 1, 10) as date, COUNT(*) as count
    FROM tasks
    WHERE completed_at IS NOT NULL AND context = 'facultad'
      AND substr(completed_at, 1, 10) >= ?
    GROUP BY substr(completed_at, 1, 10)
  `).all(heatmapStart.toISOString().slice(0, 10)) as { date: string; count: number }[];

  /* ── Weekly tasks ── */
  const weekStart = new Date(todayDate);
  const isoDow = (weekStart.getDay() + 6) % 7; // 0=Mon
  weekStart.setDate(weekStart.getDate() - isoDow - 7 * 7);
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const weeklyRaw = db.prepare(`
    SELECT subject_id,
      CAST((julianday(substr(completed_at,1,10)) - julianday(?)) AS INTEGER) / 7 as wk_idx,
      COUNT(*) as count
    FROM tasks
    WHERE completed_at IS NOT NULL AND context = 'facultad'
      AND subject_id IS NOT NULL
      AND substr(completed_at,1,10) >= ?
    GROUP BY subject_id, wk_idx
    HAVING wk_idx BETWEEN 0 AND 7
  `).all(weekStartStr, weekStartStr) as { subject_id: number; wk_idx: number; count: number }[];

  // Build weekly data: 8 weeks × subjects
  const weeklyData: { wkLabel: string; counts: number[] }[] = [];
  for (let w = 0; w < 8; w++) {
    const wkDate = new Date(weekStart);
    wkDate.setDate(weekStart.getDate() + w * 7);
    const wkLabel = `${wkDate.getMonth() + 1}/${wkDate.getDate()}`;
    const counts = subjects.map(s => {
      const row = weeklyRaw.find(r => r.subject_id === s.id && r.wk_idx === w);
      return row?.count ?? 0;
    });
    weeklyData.push({ wkLabel, counts });
  }

  /* ── Subject load data for radial chart ── */
  const graded = db
    .prepare("SELECT subject_id, grade FROM exams WHERE grade IS NOT NULL")
    .all() as { subject_id: number; grade: number }[];

  const loadData = subjects.map(s => {
    const mats = materials.filter(m => m.subject_id === s.id);
    const unsummarized = mats.filter(m => !m.summarized).length;
    const pendingTasks = mats.reduce((acc, m) => acc + m.pending_tasks, 0);
    const upcomingExams = allUpcomingExams.filter(e => e.subject_id === s.id).length;
    const load = unsummarized * 2 + pendingTasks + upcomingExams * 3;
    const gradedForSubj = graded.filter(g => g.subject_id === s.id);
    const avgGrade =
      gradedForSubj.length > 0
        ? gradedForSubj.reduce((a, g) => a + g.grade, 0) / gradedForSubj.length
        : null;
    return { id: s.id, short: s.short, hue: s.hue, load, avgGrade };
  });

  /* ── Subjects for add-task form ── */
  const subjectsForForm = subjects as unknown as Subject[];

  return (
    <div className="px-8 py-7 max-w-[1600px]">

      {/* Topbar */}
      <Topbar
        dayName={dayName}
        dateLabel={formatDate(today)}
        doneToday={doneToday}
        pendingToday={pendingToday}
        overdueCount={overdue.length}
        prodScore={prodScore}
      />

      {/* Focus section */}
      {focusTask && (
        <FocusSection
          task={focusTask}
          subject={focusSubject}
          today={today}
          nearestExam={
            nearestExam?.subject_id === focusTask.subject_id &&
            nearestExamDays !== null &&
            nearestExamDays <= 5
              ? nearestExam
              : null
          }
        />
      )}

      {/* Subject columns */}
      <div className="mb-6 fade-up fade-up-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
          Materias · materiales cargados
        </h2>
        <div className="grid grid-cols-5 gap-3 xl:grid-cols-6">
          {subjects.map(s => (
            <SubjectColumn
              key={s.id}
              subject={s}
              materials={materials.filter(m => m.subject_id === s.id)}
              exams={allUpcomingExams}
              today={today}
            />
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="mb-8 fade-up fade-up-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
          Productividad
        </h2>
        <div className="grid grid-cols-8 gap-4">
          <ActivityHeatmap heatmap={heatmapRaw} />
          <SubjectLoad loadData={loadData} />
          <WeeklyTasksChart weeklyData={weeklyData} subjects={subjects} />
        </div>
      </div>

      {/* Tasks section */}
      <div className="mb-8 fade-up fade-up-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
          Tareas
        </h2>
        <div className="max-w-xl space-y-6">
          {/* Overdue */}
          {overdue.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-red-400 mb-3">
                Vencidas — {overdue.length}
              </h3>
              <div className="space-y-1">
                {overdue.map(task => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    showDueDate
                    isStale={task.due_date !== null && task.due_date <= stale}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Today */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
              Para hoy
            </h3>
            {todayTasks.length === 0 && (
              <p className="text-sm text-slate-600 py-1">Nada asignado para hoy.</p>
            )}
            <div className="space-y-1 mb-5">
              {todayTasks.map(task => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
            <AddTaskInline defaultDueDate={today} subjects={subjectsForForm} />
          </section>
        </div>
      </div>

      {/* Shortcuts footer */}
      <div className="pt-4 border-t border-slate-900 flex items-center justify-between text-[10px] text-slate-700 font-mono">
        <div className="flex gap-4">
          <Shortcut keys="N" label="nueva tarea" />
          <Shortcut keys="P" label="pomodoro" />
        </div>
        <span>
          {subjects.length} materias · {materials.length} materiales
        </span>
      </div>

    </div>
  );
}
