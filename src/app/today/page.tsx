import { getDb } from "@/lib/db";
import { localDateStr } from "@/lib/utils";
import { subjectColor, subjectColorSoft } from "@/lib/subjectColors";
import type { Subject, ClassItem, Exam, Task, Semester } from "@/lib/types";
import Link from "next/link";
import FocusWeek from "@/components/FocusWeek";
import SemesterControl from "@/components/SemesterControl";

// ─── helpers ────────────────────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) /
      86400000
  );
}

function formatDayName(dateStr: string): string {
  const day = new Date(dateStr + "T12:00:00").getDay();
  return ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"][day];
}

function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const months = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return `${d.getDate()} de ${months[d.getMonth()]}`;
}

// ─── Topbar ─────────────────────────────────────────────────────────────────

function Topbar({
  today,
  doneTasks,
  pendingTasks,
  overdueCount,
  productivity,
  semester,
}: {
  today: string;
  doneTasks: number;
  pendingTasks: number;
  overdueCount: number;
  productivity: number;
  semester: Semester | null;
}) {
  const ringColor =
    productivity >= 80
      ? "rgb(52,211,153)"
      : productivity >= 40
      ? "rgb(251,191,36)"
      : "rgb(100,116,139)";
  const circ = 2 * Math.PI * 22;
  const dash = circ * (productivity / 100);

  return (
    <div className="flex items-end justify-between gap-6 mb-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <p className="text-[11px] uppercase tracking-widest text-slate-600">Dashboard</p>
          {semester && (
            <>
              <span className="text-slate-700 text-[10px]">·</span>
              <span className="text-[11px] text-slate-500 tabular">{semester.name}</span>
            </>
          )}
        </div>
        <h1 className="text-3xl font-semibold text-slate-100 tracking-tight">
          {formatDayName(today)}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">{formatDateLong(today)}</p>
      </div>

      <div className="flex items-center gap-5">
        {/* Quick stats */}
        <div className="flex items-center gap-5 text-right">
          <Stat label="hechas hoy" value={doneTasks} color="text-emerald-400" />
          <div className="w-px h-8 bg-slate-800" />
          <Stat label="pendientes" value={pendingTasks} color="text-amber-400" />
          <div className="w-px h-8 bg-slate-800" />
          <Stat label="vencidas" value={overdueCount} color="text-red-400" />
        </div>

        {/* Productivity ring */}
        <div className="relative w-12 h-12 shrink-0">
          <svg viewBox="0 0 52 52" className="w-full h-full -rotate-90">
            <circle cx="26" cy="26" r="22" stroke="rgb(30,41,59)" strokeWidth="4" fill="none" />
            <circle
              cx="26" cy="26" r="22"
              stroke={ringColor} strokeWidth="4" fill="none"
              strokeDasharray={`${dash} ${circ}`}
              strokeLinecap="round"
            />
          </svg>
          <div
            className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular"
            style={{ color: ringColor }}
          >
            {productivity}%
          </div>
        </div>

        {/* Semester control */}
        {semester && <SemesterControl semesterName={semester.name} />}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <p className={`text-2xl font-semibold tabular leading-none ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}

// ─── Subject Column ──────────────────────────────────────────────────────────

function ClassRow({
  cls,
  hue,
}: {
  cls: ClassItem;
  hue: number;
}) {
  return (
    <div className="group flex items-start gap-2.5 px-3 py-2 rounded-md hover:bg-slate-800/40 cursor-pointer transition-colors border border-transparent hover:border-slate-700/50">
      {/* week badge */}
      <div
        className="shrink-0 mt-0.5 text-[10px] font-semibold tabular w-6 h-5 rounded flex items-center justify-center"
        style={{
          background: subjectColorSoft(hue),
          color: subjectColor(hue, 80),
        }}
      >
        {cls.week}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-slate-200 leading-tight truncate group-hover:text-slate-100">
          {cls.title}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          {cls.summarized ? (
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
          {cls.tasks_total > 0 && (
            <span className="text-[10px] text-slate-500">
              · {cls.tasks_done}/{cls.tasks_total} tareas
            </span>
          )}
        </div>
      </div>

      {cls.tasks_total - cls.tasks_done > 0 && (
        <div
          className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-amber-400"
          title={`${cls.tasks_total - cls.tasks_done} pendientes`}
        />
      )}
    </div>
  );
}

function SubjectColumn({
  subject,
  classes,
  nextExam,
  today,
}: {
  subject: Subject;
  classes: ClassItem[];
  nextExam: Exam | null;
  today: string;
}) {
  const summarized = classes.filter((c) => c.summarized).length;
  const total = classes.length;
  const daysToExam = nextExam ? daysBetween(today, nextExam.date) : null;

  return (
    <Link
      href={`/facultad/${subject.id}`}
      className="flex flex-col bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors"
      style={{ borderTop: `2px solid ${subjectColor(subject.hue, 70)}` }}
    >
      {/* Header */}
      <div className="px-3.5 pt-3 pb-3 border-b border-slate-800/80">
        <h3 className="text-[13px] font-medium text-slate-100 leading-tight truncate mb-1.5">
          {subject.short}
        </h3>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${total > 0 ? (summarized / total) * 100 : 0}%`,
                background: subjectColor(subject.hue, 70),
              }}
            />
          </div>
          <span className="text-[10px] tabular text-slate-500 shrink-0">
            {summarized}/{total}
          </span>
        </div>

        {/* Exam badge */}
        {nextExam && daysToExam !== null && daysToExam <= 14 && daysToExam >= 0 && (
          <div className="mt-2 flex items-center justify-between text-[10px]">
            <span className="text-slate-500">
              {nextExam.type === "parcial"
                ? "Parcial"
                : nextExam.type === "tp"
                ? "TP"
                : nextExam.type === "final"
                ? "Final"
                : "Quiz"}
            </span>
            <span
              className={`tabular font-medium px-1.5 py-0.5 rounded ${
                daysToExam <= 3
                  ? "bg-red-950/60 text-red-300"
                  : daysToExam <= 7
                  ? "bg-amber-950/60 text-amber-300"
                  : "bg-slate-800/80 text-slate-400"
              }`}
            >
              {daysToExam === 0
                ? "hoy"
                : daysToExam === 1
                ? "mañana"
                : `${daysToExam}d`}
            </span>
          </div>
        )}
      </div>

      {/* Classes list */}
      <div className="flex-1 py-1.5 px-1">
        {classes.map((cls) => (
          <ClassRow key={cls.id} cls={cls} hue={subject.hue} />
        ))}
      </div>

      <div className="text-[11px] text-slate-600 hover:text-slate-300 hover:bg-slate-800/50 transition-colors py-2 border-t border-slate-800/80 flex items-center justify-center gap-1.5">
        <span className="text-base leading-none">+</span> nueva clase
      </div>
    </Link>
  );
}

// ─── Charts placeholder ───────────────────────────────────────────────────────

function ChartsSection({
  subjects,
  classes,
  today,
}: {
  subjects: Subject[];
  classes: ClassItem[];
  today: string;
}) {
  // Activity heatmap data (last 84 days, derived from class dates)
  const heatmapData = buildHeatmap(84, today, classes);

  // Subject load
  const subjectLoad = subjects.map((s) => {
    const sc = classes.filter((c) => c.subject_id === s.id);
    const unsummarized = sc.filter((c) => !c.summarized).length;
    const pendingTasks = sc.reduce((acc, c) => acc + (c.tasks_total - c.tasks_done), 0);
    const load = unsummarized * 2 + pendingTasks;
    return { ...s, load };
  });

  const maxLoad = Math.max(...subjectLoad.map((r) => r.load), 8);

  // Weekly task completions (last 8 weeks, approximated from classes data)
  const weeklyData = buildWeeklyData(8, today, subjects, classes);

  return (
    <div>
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3 fade-up fade-up-4">
        Productividad
      </h2>
      <div className="grid grid-cols-8 gap-4 fade-up fade-up-5">
        <ActivityHeatmap data={heatmapData} today={today} className="col-span-3" />
        <SubjectLoadChart subjects={subjectLoad} maxLoad={maxLoad} className="col-span-2" />
        <WeeklyTasksChart weeklyData={weeklyData} subjects={subjects} className="col-span-3" />
      </div>
    </div>
  );
}

// ─── Activity Heatmap ────────────────────────────────────────────────────────

function buildHeatmap(
  days: number,
  today: string,
  classes: ClassItem[]
): { date: string; count: number }[] {
  const classDates = new Set(classes.map((c) => c.date));
  const out: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today + "T12:00:00");
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    // count = 1 if class on that day, else 0 (could be extended with task completions)
    out.push({ date: dateStr, count: classDates.has(dateStr) ? 2 : 0 });
  }
  return out;
}

function heatmapColor(v: number): string {
  if (v === 0) return "rgb(30, 41, 59)";
  if (v === 1) return "oklch(38% 0.08 160)";
  if (v === 2) return "oklch(52% 0.13 160)";
  if (v === 3) return "oklch(64% 0.15 160)";
  return "oklch(76% 0.17 160)";
}

function ActivityHeatmap({
  data,
  className = "",
}: {
  data: { date: string; count: number }[];
  today: string;
  className?: string;
}) {
  const cell = 12, gap = 3;
  const weeks = 12;
  const days = 7;

  const firstDate = new Date(data[0].date + "T12:00:00");
  const startPad = firstDate.getDay();
  const grid: ({ date: string; count: number } | null)[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: ({ date: string; count: number } | null)[] = [];
    for (let d = 0; d < days; d++) {
      const idx = w * days + d - startPad;
      col.push(idx >= 0 && idx < data.length ? data[idx] : null);
    }
    grid.push(col);
  }

  const totalActivity = data.filter((d) => d.count > 0).length;
  const activeDays = data.filter((d) => d.count > 0).length;
  const width = weeks * (cell + gap);
  const height = days * (cell + gap);

  return (
    <ChartCard
      title="Actividad · últimos 84 días"
      subtitle={`${activeDays} días con actividad`}
      className={className}
    >
      <div className="flex flex-col h-full justify-between">
        <div className="flex items-start gap-2 mt-2">
          <div
            className="flex flex-col justify-between text-[9px] text-slate-600 pr-1 pt-0.5 leading-none"
            style={{ height }}
          >
            {["L","M","X","J","V","S","D"].map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>
          <svg width={width} height={height} className="overflow-visible">
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
                    fill={heatmapColor(day.count)}
                  >
                    <title>{`${day.date} · ${day.count > 0 ? "actividad" : "sin actividad"}`}</title>
                  </rect>
                ) : null
              )
            )}
          </svg>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/60">
          <div className="text-[11px] text-slate-500">
            <span className="text-slate-300 font-medium tabular">{totalActivity}</span>{" "}
            días con clases
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
            <span>menos</span>
            {[0, 1, 2, 3, 4].map((v) => (
              <span
                key={v}
                className="w-2.5 h-2.5 rounded-sm inline-block"
                style={{ background: heatmapColor(v) }}
              />
            ))}
            <span>más</span>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}

// ─── Subject Load Radial ─────────────────────────────────────────────────────

function SubjectLoadChart({
  subjects,
  maxLoad,
  className = "",
}: {
  subjects: (Subject & { load: number })[];
  maxLoad: number;
  className?: string;
}) {
  const cx = 110, cy = 110;
  const ringGap = 8;
  const innerR = 32;
  const ringW = 10;

  const totalLoad = subjects.reduce((s, r) => s + r.load, 0);

  return (
    <ChartCard
      title="Carga por materia"
      subtitle="Sin resumir + tareas pendientes"
      className={className}
    >
      <div className="flex items-center gap-4 h-full">
        <svg width="220" height="220" viewBox="0 0 220 220" className="shrink-0">
          {subjects.map((r, i) => {
            const radius = innerR + i * (ringW + ringGap);
            const circ = 2 * Math.PI * radius;
            const pct = maxLoad > 0 ? r.load / maxLoad : 0;
            return (
              <g key={r.id} transform={`rotate(-90 ${cx} ${cy})`}>
                <circle
                  cx={cx} cy={cy} r={radius}
                  fill="none"
                  stroke="rgb(30, 41, 59)"
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
            style={{ fontSize: 10, fill: "rgb(148,163,184)" }}
          >
            carga
          </text>
          <text
            x={cx} y={cy + 12}
            textAnchor="middle"
            style={{ fontSize: 20, fontWeight: 600, fill: "rgb(226,232,240)", fontVariantNumeric: "tabular-nums" }}
          >
            {totalLoad}
          </text>
        </svg>

        <div className="flex-1 space-y-1.5 min-w-0">
          {[...subjects]
            .sort((a, b) => b.load - a.load)
            .map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-[11px]">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: subjectColor(r.hue, 70) }}
                />
                <span className="text-slate-300 truncate flex-1">{r.short}</span>
                <span className="text-slate-500 tabular">{r.load}</span>
              </div>
            ))}
        </div>
      </div>
    </ChartCard>
  );
}

// ─── Weekly Stacked Bars ─────────────────────────────────────────────────────

function buildWeeklyData(
  numWeeks: number,
  today: string,
  subjects: Subject[],
  classes: ClassItem[]
): { week: string; [key: string]: number | string }[] {
  const result: { week: string; [key: string]: number | string }[] = [];
  for (let w = numWeeks - 1; w >= 0; w--) {
    const weekEnd = new Date(today + "T12:00:00");
    weekEnd.setDate(weekEnd.getDate() - w * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);
    const ws = weekStart.toISOString().slice(0, 10);
    const we = weekEnd.toISOString().slice(0, 10);

    const entry: { week: string; [key: string]: number | string } = {
      week: `S${numWeeks - w}`,
    };
    for (const s of subjects) {
      const sc = classes.filter(
        (c) =>
          c.subject_id === s.id &&
          c.date >= ws &&
          c.date <= we
      );
      entry[`s${s.id}`] = sc.reduce((acc, c) => acc + c.tasks_done, 0);
    }
    result.push(entry);
  }
  return result;
}

function WeeklyTasksChart({
  weeklyData,
  subjects,
  className = "",
}: {
  weeklyData: { week: string; [key: string]: number | string }[];
  subjects: Subject[];
  className?: string;
}) {
  const sids = subjects.map((s) => `s${s.id}`);

  const maxPerWeek = Math.max(
    ...weeklyData.map((w) =>
      sids.reduce((s, k) => s + ((w[k] as number) || 0), 0)
    ),
    4
  );

  const padding = { top: 16, right: 16, bottom: 28, left: 28 };
  const w = 560, h = 200;
  const innerW = w - padding.left - padding.right;
  const innerH = h - padding.top - padding.bottom;
  const barW = (innerW / weeklyData.length) * 0.6;
  const step = innerW / weeklyData.length;
  const yTicks = [0, Math.ceil(maxPerWeek / 2), maxPerWeek];

  const totalThisWeek = sids.reduce(
    (s, k) => s + ((weeklyData[weeklyData.length - 1][k] as number) || 0),
    0
  );
  const totalLastWeek = sids.reduce(
    (s, k) => s + ((weeklyData[weeklyData.length - 2]?.[k] as number) || 0),
    0
  );
  const delta = totalThisWeek - totalLastWeek;

  return (
    <ChartCard
      title="Tareas completadas · 8 semanas"
      subtitle="Apiladas por materia"
      className={className}
    >
      <div className="flex flex-col h-full">
        {/* Legend */}
        <div className="flex items-center gap-3 mb-3 text-[11px] flex-wrap">
          {subjects.map((s) => (
            <div key={s.id} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm inline-block"
                style={{ background: subjectColor(s.hue, 68) }}
              />
              <span className="text-slate-400">{s.short}</span>
            </div>
          ))}
        </div>

        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="xMidYMid meet">
          {yTicks.map((t) => (
            <g key={t}>
              <line
                x1={padding.left} x2={w - padding.right}
                y1={padding.top + innerH - (t / maxPerWeek) * innerH}
                y2={padding.top + innerH - (t / maxPerWeek) * innerH}
                stroke="rgb(30, 41, 59)"
                strokeDasharray="2 3"
              />
              <text
                x={padding.left - 6}
                y={padding.top + innerH - (t / maxPerWeek) * innerH + 3}
                textAnchor="end"
                style={{ fontSize: 9, fill: "rgb(71,85,105)", fontVariantNumeric: "tabular-nums" }}
              >
                {t}
              </text>
            </g>
          ))}

          {weeklyData.map((wk, i) => {
            const x = padding.left + i * step + (step - barW) / 2;
            let yCursor = padding.top + innerH;
            return (
              <g key={wk.week}>
                {sids.map((sid, j) => {
                  const v = (wk[sid] as number) || 0;
                  const segH = maxPerWeek > 0 ? (v / maxPerWeek) * innerH : 0;
                  yCursor -= segH;
                  return (
                    <rect
                      key={sid}
                      x={x}
                      y={yCursor}
                      width={barW}
                      height={segH}
                      fill={subjectColor(subjects[j].hue, 68)}
                      rx={j === sids.length - 1 ? 2 : 0}
                    >
                      <title>
                        {subjects[j].short}: {v}
                      </title>
                    </rect>
                  );
                })}
                <text
                  x={x + barW / 2}
                  y={h - 10}
                  textAnchor="middle"
                  style={{ fontSize: 10, fill: "rgb(100,116,139)" }}
                >
                  {wk.week as string}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/60 text-[11px]">
          <div className="text-slate-500">
            esta semana:{" "}
            <span className="text-slate-300 font-medium tabular">{totalThisWeek}</span>
          </div>
          <div
            className={`tabular ${
              delta > 0
                ? "text-emerald-400"
                : delta < 0
                ? "text-red-400"
                : "text-slate-500"
            }`}
          >
            {delta > 0 ? "↑" : delta < 0 ? "↓" : "·"} {Math.abs(delta)} vs sem.
            anterior
          </div>
        </div>
      </div>
    </ChartCard>
  );
}

// ─── ChartCard wrapper ───────────────────────────────────────────────────────

function ChartCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col ${className}`}
    >
      <div className="mb-4">
        <h3 className="text-[13px] font-medium text-slate-200">{title}</h3>
        {subtitle && (
          <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

// ─── Keyboard shortcuts ──────────────────────────────────────────────────────

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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TodayPage() {
  const db = getDb();
  const today = localDateStr();

  // Active semester
  const semester = db
    .prepare("SELECT * FROM semesters WHERE status = 'active' ORDER BY id DESC LIMIT 1")
    .get() as Semester | undefined;

  const subjects = semester
    ? (db
        .prepare("SELECT * FROM subjects WHERE semester_id = ? ORDER BY id")
        .all(semester.id) as Subject[])
    : [];

  const subjectIds = subjects.map((s) => s.id);
  const inList = subjectIds.length > 0 ? subjectIds.map(() => "?").join(",") : "NULL";

  const allClasses = subjectIds.length
    ? (db
        .prepare(`SELECT * FROM classes WHERE subject_id IN (${inList}) ORDER BY subject_id, week`)
        .all(...subjectIds) as ClassItem[])
    : [];

  const exams = subjectIds.length
    ? (db
        .prepare(`SELECT * FROM exams WHERE subject_id IN (${inList}) ORDER BY date`)
        .all(...subjectIds) as Exam[])
    : [];

  // Tasks stats — only tasks belonging to current semester's subjects (or unlinked tasks)
  const taskFilter = subjectIds.length
    ? `(subject_id IN (${inList}) OR subject_id IS NULL)`
    : "subject_id IS NULL";
  const taskParams = subjectIds.length ? subjectIds : [];

  const doneTasks = (
    db
      .prepare(
        `SELECT COUNT(*) as n FROM tasks WHERE status = 'hecha' AND date(completed_at) = ? AND ${taskFilter}`
      )
      .get(today, ...taskParams) as { n: number }
  ).n;

  const pendingTasks = (
    db
      .prepare(`SELECT COUNT(*) as n FROM tasks WHERE status = 'pendiente' AND ${taskFilter}`)
      .get(...taskParams) as { n: number }
  ).n;

  const overdueCount = (
    db
      .prepare(
        `SELECT COUNT(*) as n FROM tasks WHERE status = 'pendiente' AND due_date < ? AND ${taskFilter}`
      )
      .get(today, ...taskParams) as { n: number }
  ).n;

  const productivity =
    doneTasks + pendingTasks > 0
      ? Math.round((doneTasks / (doneTasks + pendingTasks)) * 100)
      : 0;

  // Focus task of the week: pending task in active semester, ordered by:
  //   1) overdue first, 2) priority, 3) earliest due
  const focusTask = db
    .prepare(
      `SELECT t.*, s.name as subject_name FROM tasks t
       LEFT JOIN subjects s ON s.id = t.subject_id
       WHERE t.status = 'pendiente' AND ${taskFilter.replace(/subject_id/g, "t.subject_id")}
       ORDER BY
         CASE WHEN t.due_date IS NOT NULL AND t.due_date < ? THEN 0 ELSE 1 END,
         CASE t.priority WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
         CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
         t.due_date ASC
       LIMIT 1`
    )
    .get(...taskParams, today) as (Task & { subject_name: string }) | undefined;

  const focusSubject = focusTask?.subject_id
    ? subjects.find((s) => s.id === focusTask.subject_id) ?? null
    : null;

  const focusNearestExam =
    focusSubject
      ? (exams.find(
          (e) => e.subject_id === focusSubject.id && e.date >= today && !e.grade
        ) ?? null)
      : null;

  // Group classes by subject
  const classesBySubject = (subjectId: number) =>
    allClasses.filter((c) => c.subject_id === subjectId);

  // Next exam per subject
  const nextExamFor = (subjectId: number): Exam | null =>
    exams.find((e) => e.subject_id === subjectId && e.date >= today && !e.grade) ??
    null;

  return (
    <div className="px-8 py-7 max-w-[1600px]">
      {/* Topbar */}
      <div className="fade-up fade-up-1">
        <Topbar
          today={today}
          doneTasks={doneTasks}
          pendingTasks={pendingTasks}
          overdueCount={overdueCount}
          productivity={productivity}
          semester={semester ?? null}
        />
      </div>

      {/* Focus block — semanal */}
      {focusTask && focusSubject ? (
        <FocusWeek
          task={focusTask}
          subject={focusSubject}
          nearestExam={focusNearestExam}
          today={today}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-slate-800 px-5 py-4 mb-6 fade-up fade-up-2">
          <p className="text-[11px] uppercase tracking-widest text-slate-600 mb-1">◎ Foco de la semana</p>
          <p className="text-[13px] text-slate-500">
            No hay tareas pendientes esta semana. Agregá una tarea desde una materia para verla acá.
          </p>
        </div>
      )}

      {/* Subject columns */}
      <div className="mb-6 fade-up fade-up-3">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            Materias · semana en curso
          </h2>
          {subjects.length > 0 && (
            <span className="text-[10px] text-slate-600 tabular">
              {subjects.length} materia{subjects.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {subjects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 px-6 py-10 text-center">
            <p className="text-[13px] text-slate-500 mb-1">No hay materias en el semestre activo</p>
            <p className="text-[11px] text-slate-600">
              Cerrá el semestre desde el botón &ldquo;Cerrar&rdquo; para crear uno nuevo, o agregalas desde la sidebar.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-3">
            {subjects.map((s) => (
              <SubjectColumn
                key={s.id}
                subject={s}
                classes={classesBySubject(s.id)}
                nextExam={nextExamFor(s.id)}
                today={today}
              />
            ))}
          </div>
        )}
      </div>

      {/* Charts */}
      <ChartsSection subjects={subjects} classes={allClasses} today={today} />

      {/* Keyboard shortcuts */}
      <div className="mt-8 pt-4 border-t border-slate-900 flex items-center justify-between text-[10px] text-slate-700 font-mono fade-up fade-up-5">
        <div className="flex gap-4">
          <Shortcut keys="N" label="nueva tarea" />
          <Shortcut keys="C" label="nueva clase" />
          <Shortcut keys="P" label="pomodoro" />
          <Shortcut keys="⌘K" label="buscar" />
        </div>
        <span>v1.0 · facultad</span>
      </div>
    </div>
  );
}
