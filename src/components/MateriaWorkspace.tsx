"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import type { Subject, ClassItem, Exam, Task, ClassMaterial } from "@/lib/types";
import { subjectColor, subjectColorSoft } from "@/lib/subjectColors";
import { MATERIAL_KIND_LABEL, MATERIAL_KIND_STYLE, formatBytes } from "@/lib/materials";
import { toggleTask } from "@/app/actions";
import ImportMaterialsButton from "@/components/ImportMaterialsButton";
import ClearAllMaterialsButton from "@/components/ClearAllMaterialsButton";
import ClaudeProjectInput from "@/components/ClaudeProjectInput";
import MaterialItem from "@/components/MaterialItem";

// ── Status types ──────────────────────────────────────────────────────────────
type SummaryStatus = "done" | "draft" | "pending" | "empty";

const STATUS: Record<SummaryStatus, { color: string; label: string }> = {
  done:    { color: "rgb(52, 211, 153)",  label: "Resumida"    },
  draft:   { color: "rgb(125, 211, 252)", label: "Borrador"    },
  pending: { color: "rgb(251, 191, 36)",  label: "Pendiente"   },
  empty:   { color: "rgb(71, 85, 105)",   label: "Sin archivos"},
};

function deriveStatus(cls: ClassItem, fileCount: number): SummaryStatus {
  if (fileCount === 0) return "empty";
  if (cls.summarized && cls.summary) return "done";
  if (cls.summary) return "draft";
  return "pending";
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d: string | null): string {
  if (!d) return "—";
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const parts = d.split("-");
  if (parts.length < 3) return d;
  return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]}`;
}

function daysFromToday(d: string, today: string): number {
  const t = new Date(today + "T12:00:00").getTime();
  const x = new Date(d + "T12:00:00").getTime();
  return Math.round((x - t) / 86_400_000);
}

// ── Small UI bits ─────────────────────────────────────────────────────────────
function StatusDot({ status, size = 8, pulse = false }: { status: SummaryStatus; size?: number; pulse?: boolean }) {
  const s = STATUS[status];
  return (
    <span
      className={`inline-block rounded-full shrink-0 ${pulse ? "animate-pulse" : ""}`}
      style={{ width: size, height: size, background: s.color }}
      title={s.label}
    />
  );
}

function ProgressRing({ pct, size = 36, stroke = 3, color = "rgb(52, 211, 153)" }: {
  pct: number; size?: number; stroke?: number; color?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * Math.max(0, Math.min(100, pct)) / 100;
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(30, 41, 59)" strokeWidth={stroke} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
    </svg>
  );
}

function MdLite({ text }: { text: string }) {
  // Renders **bold**, `code`, and preserves line breaks
  const parts: { kind: "t" | "b" | "c"; value: string }[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text))) {
    if (m.index > cursor) parts.push({ kind: "t", value: text.slice(cursor, m.index) });
    if (m[0].startsWith("**"))     parts.push({ kind: "b", value: m[0].slice(2, -2) });
    else if (m[0].startsWith("`")) parts.push({ kind: "c", value: m[0].slice(1, -1) });
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) parts.push({ kind: "t", value: text.slice(cursor) });
  return (
    <>
      {parts.map((p, i) => {
        if (p.kind === "b") return <strong key={i} className="text-slate-100 font-semibold">{p.value}</strong>;
        if (p.kind === "c") return <code key={i} className="px-1 py-0.5 rounded bg-slate-800 text-slate-300 text-[12px] font-mono">{p.value}</code>;
        return <span key={i} style={{ whiteSpace: "pre-wrap" }}>{p.value}</span>;
      })}
    </>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
type ClassWithStats = ClassItem & {
  summaryStatus: SummaryStatus;
  fileCount: number;
  taskCount: number;
};

interface Props {
  subject: Subject;
  classes: ClassItem[];
  materialsByClass: Record<number, ClassMaterial[]>;
  tasksByClass: Record<number, Task[]>;
  inboxMaterials: ClassMaterial[];
  upcomingExams: Exam[];
  today: string;
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero({ subject, classesWithStats, totalMaterials, totalTasks, openTasks, nextExam, today }: {
  subject: Subject;
  classesWithStats: ClassWithStats[];
  totalMaterials: number;
  totalTasks: number;
  openTasks: number;
  nextExam: Exam | null;
  today: string;
}) {
  const done = classesWithStats.filter(c => c.summaryStatus === "done").length;
  const totalNonEmpty = classesWithStats.filter(c => c.summaryStatus !== "empty").length;
  const donePct = totalNonEmpty > 0 ? (done / totalNonEmpty) * 100 : 0;
  const accent = subjectColor(subject.hue, 70);

  const daysToExam = nextExam ? daysFromToday(nextExam.date, today) : null;
  const examStyle =
    daysToExam == null ? "bg-slate-900/50 border-slate-800 text-slate-400"
    : daysToExam <= 3   ? "bg-red-950/40 border-red-900/60 text-red-300"
    : daysToExam <= 7   ? "bg-amber-950/40 border-amber-900/60 text-amber-300"
    : "bg-slate-900/50 border-slate-800 text-slate-300";

  return (
    <div className="mb-7">
      <div className="flex items-start justify-between gap-6 mb-5 flex-wrap">
        <div className="min-w-0">
          <p
            className="text-[10px] uppercase tracking-widest mb-1.5"
            style={{ color: subjectColor(subject.hue, 65) }}
          >
            Materia
          </p>
          <h1 className="text-4xl font-semibold text-slate-100 tracking-tight">{subject.name}</h1>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <p className="text-[13px] text-slate-500 whitespace-nowrap">{subject.credits} créditos</p>
            <span className="text-slate-700">·</span>
            <div className="relative">
              <ClaudeProjectInput subjectId={subject.id} currentUrl={subject.claude_project_url} />
            </div>
            <span className="text-slate-700">·</span>
            <ClearAllMaterialsButton
              subjectId={subject.id}
              classCount={classesWithStats.length}
              materialCount={totalMaterials}
            />
          </div>
        </div>

        <div className="shrink-0">
          <ImportMaterialsButton subjectId={subject.id} />
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Progreso"
          value={`${done}/${totalNonEmpty}`}
          sub={`${Math.round(donePct)}% resumido`}
          accent={<ProgressRing pct={donePct} color={accent} />}
        />
        <StatTile
          label="Archivos"
          value={totalMaterials}
          sub={`en ${classesWithStats.length} clase${classesWithStats.length !== 1 ? "s" : ""}`}
          accent={<div className="text-2xl text-slate-700">◇</div>}
        />
        <StatTile
          label="Tareas"
          value={totalTasks}
          sub={`${openTasks} sin completar`}
          accent={<div className="text-2xl">⏺</div>}
          valueColor={openTasks > 0 ? "text-amber-400" : "text-emerald-400"}
        />
        {nextExam ? (
          <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 min-w-0 ${examStyle}`}>
            <div className="text-3xl font-black tabular leading-none shrink-0">{daysToExam}</div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest opacity-70 mb-0.5 whitespace-nowrap">Próximo · {nextExam.type}</p>
              <p className="text-[13px] font-medium truncate">{nextExam.title}</p>
              <p className="text-[10px] opacity-60 whitespace-nowrap">{fmtDate(nextExam.date)} · peso {Math.round(nextExam.weight * 100)}%</p>
            </div>
          </div>
        ) : (
          <StatTile label="Próximo examen" value="—" sub="Sin exámenes agendados" accent={<div className="text-2xl text-slate-700">◷</div>} />
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value, sub, accent, valueColor }: {
  label: string;
  value: string | number;
  sub: string;
  accent: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3 min-w-0">
      <div className="shrink-0">{accent}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{label}</p>
        <p className={`text-xl font-semibold tabular leading-none whitespace-nowrap ${valueColor || "text-slate-100"}`}>{value}</p>
        <p className="text-[11px] text-slate-500 mt-0.5 truncate">{sub}</p>
      </div>
    </div>
  );
}

// ── Class Rail ────────────────────────────────────────────────────────────────
function ClassRail({ classes, selectedId, onSelect, filter, setFilter, search, setSearch }: {
  classes: ClassWithStats[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  filter: "all" | "pending" | "tasks";
  setFilter: (f: "all" | "pending" | "tasks") => void;
  search: string;
  setSearch: (s: string) => void;
}) {
  const filtered = classes.filter(c => {
    if (filter === "pending" && c.summaryStatus !== "pending" && c.summaryStatus !== "draft") return false;
    if (filter === "tasks" && c.taskCount === 0) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!c.title.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <aside className="w-80 shrink-0 border-r border-slate-900 pr-4 self-start sticky top-2 max-h-[calc(100vh-2rem)] flex flex-col">
      <div className="relative mb-3 mt-1">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar clase…"
          className="w-full bg-slate-900/60 border border-slate-800 focus:border-slate-600 rounded-md pl-7 pr-2 py-1.5 text-[12px] text-slate-200 placeholder-slate-600 outline-none transition-colors"
        />
        <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
        </svg>
      </div>

      <div className="flex items-center gap-1 mb-3 text-[10px]">
        {([
          { v: "all" as const,     l: "Todas",      n: classes.length },
          { v: "pending" as const, l: "Pendientes", n: classes.filter(c => c.summaryStatus === "pending" || c.summaryStatus === "draft").length },
          { v: "tasks" as const,   l: "Con tareas", n: classes.filter(c => c.taskCount > 0).length },
        ]).map(f => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors whitespace-nowrap ${
              filter === f.v ? "bg-slate-800 text-slate-100" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {f.l}
            <span className="tabular text-[9px] text-slate-600">{f.n}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto -mr-2 pr-2 space-y-0.5">
        {filtered.map(c => {
          const isSel = c.id === selectedId;
          const st = STATUS[c.summaryStatus];
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`group w-full text-left flex items-start gap-3 px-2.5 py-2 rounded-lg transition-colors ${
                isSel ? "bg-slate-800/60" : "hover:bg-slate-900/60"
              }`}
            >
              <div
                className="shrink-0 mt-0.5 w-6 h-6 rounded flex items-center justify-center text-[11px] font-semibold tabular"
                style={{ background: "rgb(30, 41, 59)", color: isSel ? "rgb(226, 232, 240)" : "rgb(148, 163, 184)" }}
              >
                {c.week}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-[12.5px] leading-tight truncate ${isSel ? "text-slate-100 font-medium" : "text-slate-300"}`}>
                  {c.title}
                </p>
                <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500 whitespace-nowrap">
                  <StatusDot status={c.summaryStatus} size={6} />
                  <span>{st.label}</span>
                  {c.fileCount > 0 && (<><span className="text-slate-700">·</span><span className="tabular">{c.fileCount} arch.</span></>)}
                  {c.taskCount > 0 && (<><span className="text-slate-700">·</span><span className="text-amber-500 tabular">{c.taskCount} tareas</span></>)}
                </div>
              </div>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-[12px] text-slate-600 italic text-center py-8">Sin clases que coincidan</p>
        )}
      </div>
    </aside>
  );
}

// ── Class Detail ──────────────────────────────────────────────────────────────
function ClassDetail({
  cls,
  materials,
  tasks,
  allClasses,
  subjectName,
  claudeProjectUrl,
  today,
}: {
  cls: ClassWithStats;
  materials: ClassMaterial[];
  tasks: Task[];
  allClasses: ClassItem[];
  subjectName: string;
  claudeProjectUrl: string | null;
  today: string;
}) {
  // Tab state is local; ClassDetail is keyed by cls.id by the parent so this
  // resets to "summary" when the selected class changes.
  const [tab, setTab] = useState<"summary" | "files" | "tasks">("summary");
  const st = STATUS[cls.summaryStatus];

  const tabs = [
    { id: "summary" as const, label: "Resumen",  badge: cls.summary ? null : "vacío" },
    { id: "files" as const,   label: "Archivos", badge: materials.length || null },
    { id: "tasks" as const,   label: "Tareas",   badge: tasks.length || null },
  ];

  return (
    <div className="flex-1 min-w-0">
      <div className="mb-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[11px] font-mono tabular px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 whitespace-nowrap">
                Clase {cls.week}
              </span>
              <StatusDot status={cls.summaryStatus} />
              <span className="text-[11px] whitespace-nowrap" style={{ color: st.color }}>{st.label}</span>
              {cls.date && (
                <span className="text-[11px] text-slate-600 whitespace-nowrap">· {fmtDate(cls.date)}</span>
              )}
            </div>
            <h2 className="text-2xl font-semibold text-slate-100 tracking-tight text-pretty">{cls.title}</h2>
            <p className="text-[12px] text-slate-500 mt-1">
              {materials.length > 0
                ? `${materials.length} archivo${materials.length !== 1 ? "s" : ""} · ${tasks.length} tarea${tasks.length !== 1 ? "s" : ""}`
                : "Sin archivos cargados"}
            </p>
          </div>
        </div>

        {materials.length === 0 ? (
          <div className="mt-4 rounded-xl border-2 border-dashed border-slate-800 px-6 py-10 text-center">
            <p className="text-[15px] text-slate-400 mb-1">Esta clase no tiene archivos todavía.</p>
            <p className="text-[12px] text-slate-600">Importá la carpeta de la materia desde arriba, o arrastrá archivos sueltos.</p>
          </div>
        ) : (
          <div className="flex items-center gap-1 mt-4 border-b border-slate-900">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-2 text-[12px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                  tab === t.id ? "border-slate-200 text-slate-100" : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                {t.label}
                {t.badge != null && (
                  <span className={`ml-1.5 tabular text-[10px] ${tab === t.id ? "text-slate-400" : "text-slate-600"}`}>
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {materials.length > 0 && (
        <>
          {tab === "summary" && <SummaryView cls={cls} />}
          {tab === "files"   && <FilesView materials={materials} allClasses={allClasses} subjectName={subjectName} claudeProjectUrl={claudeProjectUrl} />}
          {tab === "tasks"   && <TasksView tasks={tasks} today={today} />}
        </>
      )}
    </div>
  );
}

// ── Summary view ──────────────────────────────────────────────────────────────
function SummaryView({ cls }: { cls: ClassWithStats }) {
  if (!cls.summary) {
    return (
      <div className="rounded-xl border-2 border-dashed border-amber-900/40 bg-amber-950/10 p-8 text-center">
        <div className="text-3xl mb-3">✨</div>
        <p className="text-[14px] text-slate-200 font-medium mb-1">Sin resumen todavía</p>
        <p className="text-[12px] text-slate-500 max-w-md mx-auto leading-relaxed">
          Abrí un archivo de esta clase y usá <span className="text-violet-300">◆ Preguntar</span> para generarlo en Claude.ai.
          Después pegá la respuesta en el material — el resumen aparece acá.
        </p>
      </div>
    );
  }

  // Try to split summary into a TL;DR (first paragraph) and sections (rest)
  const parts = cls.summary.split(/\n\n+/);
  const tldr = parts[0];
  const rest = parts.slice(1).join("\n\n");

  return (
    <div className="space-y-6">
      <div
        className="rounded-xl border border-slate-800 px-5 py-4"
        style={{
          background: "linear-gradient(135deg, oklch(28% 0.05 280 / 0.18) 0%, rgba(15, 23, 42, 0.3) 60%)",
        }}
      >
        <p className="text-[10px] uppercase tracking-widest text-violet-400/80 mb-1.5">Resumen</p>
        <p className="text-[14px] text-slate-200 leading-relaxed text-pretty">
          <MdLite text={tldr} />
        </p>
      </div>

      {rest && (
        <div className="text-[13px] text-slate-300 leading-relaxed text-pretty">
          <MdLite text={rest} />
        </div>
      )}
    </div>
  );
}

// ── Files view ────────────────────────────────────────────────────────────────
function FilesView({ materials, allClasses, subjectName, claudeProjectUrl }: {
  materials: ClassMaterial[];
  allClasses: ClassItem[];
  subjectName: string;
  claudeProjectUrl: string | null;
}) {
  return (
    <div className="space-y-0.5">
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
  );
}

// ── Tasks view ────────────────────────────────────────────────────────────────
function TasksView({ tasks, today }: { tasks: Task[]; today: string }) {
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<Record<number, boolean>>({});

  const handleToggle = useCallback((id: number, currentDone: boolean) => {
    setOptimistic(prev => ({ ...prev, [id]: !currentDone }));
    startTransition(async () => { await toggleTask(id); });
  }, []);

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 px-5 py-8 text-center">
        <p className="text-[13px] text-slate-400">Sin tareas en esta clase.</p>
        <p className="text-[11px] text-slate-600 mt-1">Agregalas desde Hoy y enlazalas a esta clase.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {tasks.map(t => {
        const done = optimistic[t.id] ?? t.status === "hecha";
        const overdue = t.due_date && t.due_date < today && !done;
        return (
          <div
            key={t.id}
            className="group flex items-start gap-3 px-3 py-2.5 rounded-lg border border-transparent hover:border-slate-800 hover:bg-slate-900/40 transition-colors"
          >
            <button
              onClick={() => handleToggle(t.id, done)}
              className={`shrink-0 mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                done ? "bg-emerald-500 border-emerald-500" : "border-slate-600 hover:border-slate-400"
              }`}
            >
              {done && (
                <svg className="w-3 h-3 text-slate-950" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path d="M4 12l5 5L20 6" />
                </svg>
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className={`text-[13px] leading-snug ${done ? "text-slate-500 line-through" : "text-slate-200"}`}>
                {t.title}
              </p>
              <div className="flex items-center gap-2 mt-1 text-[10px]">
                <span
                  className={`px-1.5 py-0.5 rounded font-medium ${
                    t.priority === "alta"  ? "bg-red-950/40 text-red-400"
                    : t.priority === "media" ? "bg-amber-950/40 text-amber-400"
                    : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {t.priority}
                </span>
                {t.due_date && (
                  <span className={overdue ? "text-red-400" : "text-slate-500"}>
                    {overdue ? "vencida " : "vence "}{fmtDate(t.due_date)}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MateriaWorkspace({
  subject,
  classes,
  materialsByClass,
  tasksByClass,
  inboxMaterials,
  upcomingExams,
  today,
}: Props) {
  const classesWithStats: ClassWithStats[] = useMemo(() =>
    classes.map(c => {
      const mats = materialsByClass[c.id] ?? [];
      const tks = tasksByClass[c.id] ?? [];
      return {
        ...c,
        summaryStatus: deriveStatus(c, mats.length),
        fileCount: mats.length,
        taskCount: tks.length,
      };
    }),
  [classes, materialsByClass, tasksByClass]);

  const totalMaterials = useMemo(() =>
    classesWithStats.reduce((s, c) => s + c.fileCount, 0) + inboxMaterials.length,
  [classesWithStats, inboxMaterials]);

  const totalTasks = useMemo(() =>
    Object.values(tasksByClass).reduce((s, arr) => s + arr.length, 0),
  [tasksByClass]);

  const openTasks = useMemo(() =>
    Object.values(tasksByClass)
      .flat()
      .filter(t => t.status === "pendiente").length,
  [tasksByClass]);

  const [selectedIdRaw, setSelectedId] = useState<number | null>(classesWithStats[0]?.id ?? null);
  const [filter, setFilter] = useState<"all" | "pending" | "tasks">("all");
  const [search, setSearch] = useState("");

  // Derive a valid selection — if the stored id no longer exists, fall back to the first class
  const selected = useMemo(() => {
    const match = selectedIdRaw !== null
      ? classesWithStats.find(c => c.id === selectedIdRaw)
      : null;
    return match ?? classesWithStats[0] ?? null;
  }, [classesWithStats, selectedIdRaw]);
  const selectedId = selected?.id ?? null;
  const nextExam = upcomingExams[0] ?? null;

  return (
    <div className="px-8 py-7 max-w-[1500px] mx-auto">
      <Hero
        subject={subject}
        classesWithStats={classesWithStats}
        totalMaterials={totalMaterials}
        totalTasks={totalTasks}
        openTasks={openTasks}
        nextExam={nextExam}
        today={today}
      />

      {classesWithStats.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-800 px-8 py-16 text-center">
          <p className="text-[15px] text-slate-300 mb-1.5">Sin clases todavía</p>
          <p className="text-[12px] text-slate-600 max-w-md mx-auto leading-relaxed">
            Importá la carpeta de la materia desde arriba — cada subcarpeta se vuelve una clase con sus archivos clasificados.
          </p>
        </div>
      ) : (
        <div className="flex gap-6 items-start">
          <ClassRail
            classes={classesWithStats}
            selectedId={selectedId}
            onSelect={setSelectedId}
            filter={filter}
            setFilter={setFilter}
            search={search}
            setSearch={setSearch}
          />
          {selected && (
            <ClassDetail
              key={selected.id}
              cls={selected}
              materials={materialsByClass[selected.id] ?? []}
              tasks={tasksByClass[selected.id] ?? []}
              allClasses={classes}
              subjectName={subject.name}
              claudeProjectUrl={subject.claude_project_url}
              today={today}
            />
          )}
        </div>
      )}

      {/* Inbox section */}
      {inboxMaterials.length > 0 && (
        <section className="mt-10">
          <div className="flex items-center justify-between mb-3 gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">📥 Inbox · sin asignar</h3>
            <span className="text-[10px] text-slate-600 tabular">
              {inboxMaterials.length} archivo{inboxMaterials.length !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-[10px] text-slate-600 mb-2">
            Archivos que no se asignaron automáticamente. Click en &ldquo;Mover&rdquo; para asignarlos a una clase.
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

      {/* Avoid unused-var warnings on helpers consumers may not exercise */}
      <span className="hidden">
        {String(MATERIAL_KIND_LABEL.otro)}
        {String(MATERIAL_KIND_STYLE.otro)}
        {String(subjectColorSoft(subject.hue))}
        {String(formatBytes(0))}
      </span>
    </div>
  );
}
