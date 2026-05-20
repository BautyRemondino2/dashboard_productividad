"use client";

import { useState, useMemo, useCallback, useTransition, useEffect, useRef } from "react";
import type { Subject, ClassItem, Exam, Task, ClassMaterial } from "@/lib/types";
import { subjectColor, subjectColorSoft } from "@/lib/subjectColors";
import { MATERIAL_KIND_LABEL, MATERIAL_KIND_STYLE, formatBytes } from "@/lib/materials";
import {
  toggleTask,
  updateClass,
  deleteClass,
  createTaskForClass,
} from "@/app/actions";
import ImportMaterialsButton from "@/components/ImportMaterialsButton";
import ClearAllMaterialsButton from "@/components/ClearAllMaterialsButton";
import ClaudeProjectInput from "@/components/ClaudeProjectInput";
import MaterialItem from "@/components/MaterialItem";
import ClassClaudeButton from "@/components/ClassClaudeButton";
import RichSummary from "@/components/RichSummary";

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

// (MdLite removed — RichSummary now owns all summary rendering.)

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
function ClassRail({ classes, selectedId, onSelect, filter, setFilter, search, setSearch, searchInputRef }: {
  classes: ClassWithStats[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  filter: "all" | "pending" | "tasks";
  setFilter: (f: "all" | "pending" | "tasks") => void;
  search: string;
  setSearch: (s: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
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
          ref={searchInputRef}
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); setSearch(""); (e.target as HTMLInputElement).blur(); } }}
          placeholder="Buscar clase… (/)"
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
type DetailTab = "summary" | "files" | "tasks";

function ClassDetail({
  cls,
  materials,
  tasks,
  allClasses,
  subjectName,
  claudeProjectUrl,
  today,
  tab,
  setTab,
  previousClassTitle,
  triggerTitleEdit,
}: {
  cls: ClassWithStats;
  materials: ClassMaterial[];
  tasks: Task[];
  allClasses: ClassItem[];
  subjectName: string;
  claudeProjectUrl: string | null;
  today: string;
  tab: DetailTab;
  setTab: (t: DetailTab) => void;
  previousClassTitle: string | null;
  triggerTitleEdit: number;
}) {
  const st = STATUS[cls.summaryStatus];

  const tabs: { id: DetailTab; label: string; badge: string | number | null }[] = [
    { id: "summary", label: "Resumen",  badge: cls.summary ? null : "vacío" },
    { id: "files",   label: "Archivos", badge: materials.length || null },
    { id: "tasks",   label: "Tareas",   badge: tasks.length || null },
  ];

  return (
    <div className="flex-1 min-w-0">
      <div className="mb-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <EditableWeek classId={cls.id} week={cls.week} />
              <StatusDot status={cls.summaryStatus} />
              <span className="text-[11px] whitespace-nowrap" style={{ color: st.color }}>{st.label}</span>
              {cls.date && (
                <span className="text-[11px] text-slate-600 whitespace-nowrap">· {fmtDate(cls.date)}</span>
              )}
            </div>
            <EditableTitle classId={cls.id} title={cls.title} triggerEdit={triggerTitleEdit} />
            <p className="text-[12px] text-slate-500 mt-1">
              {materials.length > 0
                ? `${materials.length} archivo${materials.length !== 1 ? "s" : ""} · ${tasks.length} tarea${tasks.length !== 1 ? "s" : ""}`
                : "Sin archivos cargados"}
            </p>
          </div>

          <DeleteClassButton classId={cls.id} classTitle={cls.title} materialCount={materials.length} />
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
          {tab === "summary" && (
            <SummaryView
              cls={cls}
              materials={materials}
              subjectName={subjectName}
              claudeProjectUrl={claudeProjectUrl}
              previousClassTitle={previousClassTitle}
            />
          )}
          {tab === "files"   && <FilesView materials={materials} allClasses={allClasses} subjectName={subjectName} claudeProjectUrl={claudeProjectUrl} />}
          {tab === "tasks"   && <TasksView classId={cls.id} tasks={tasks} today={today} />}
        </>
      )}
    </div>
  );
}

// ── Inline editable title (h2 click-to-edit) ──────────────────────────────────
function EditableTitle({ classId, title, triggerEdit }: { classId: number; title: string; triggerEdit: number }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset draft when title changes externally (server revalidation)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(title);
  }, [title]);

  // External trigger (e.g. keyboard shortcut `e`)
  useEffect(() => {
    if (triggerEdit > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditing(true);
    }
  }, [triggerEdit]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const t = draft.trim();
    setEditing(false);
    if (t && t !== title) {
      startTransition(async () => { await updateClass(classId, { title: t }); });
    } else {
      setDraft(title);
    }
  };

  const cancel = () => {
    setDraft(title);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.preventDefault(); cancel(); }
        }}
        className="w-full text-2xl font-semibold text-slate-100 tracking-tight bg-slate-950 border border-slate-700 rounded-md px-2 py-1 outline-none focus:border-slate-500"
      />
    );
  }

  return (
    <h2
      onClick={() => setEditing(true)}
      title="Click para editar (o pulsá ‘e’)"
      className="text-2xl font-semibold text-slate-100 tracking-tight text-pretty cursor-text rounded-md -mx-2 px-2 py-1 hover:bg-slate-900/60 transition-colors"
    >
      {title}
    </h2>
  );
}

// ── Inline editable week badge ────────────────────────────────────────────────
function EditableWeek({ classId, week }: { classId: number; week: number }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(week));
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(String(week));
  }, [week]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = () => {
    const n = parseInt(draft, 10);
    setEditing(false);
    if (Number.isFinite(n) && n > 0 && n !== week) {
      startTransition(async () => { await updateClass(classId, { week: n }); });
    } else {
      setDraft(String(week));
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={1}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.preventDefault(); setEditing(false); setDraft(String(week)); }
        }}
        className="text-[11px] font-mono tabular w-16 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-100 outline-none focus:border-slate-500"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Cambiar número de semana"
      className="text-[11px] font-mono tabular px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors whitespace-nowrap"
    >
      Clase {week}
    </button>
  );
}

// ── Delete class ──────────────────────────────────────────────────────────────
function DeleteClassButton({ classId, classTitle, materialCount }: { classId: number; classTitle: string; materialCount: number }) {
  const [confirming, setConfirming] = useState(false);
  const [, startTransition] = useTransition();

  if (confirming) {
    return (
      <div className="shrink-0 inline-flex items-center gap-2 rounded-md bg-red-950/40 border border-red-900/60 px-2.5 py-1">
        <span className="text-[10px] text-red-300">
          ¿Borrar clase? {materialCount > 0 ? `${materialCount} archivos van al Inbox.` : "No tiene archivos."}
        </span>
        <button
          onClick={() => startTransition(async () => { await deleteClass(classId); setConfirming(false); })}
          className="text-[10px] font-medium text-red-300 hover:text-red-200 underline decoration-dotted"
        >
          Sí
        </button>
        <button onClick={() => setConfirming(false)} className="text-[10px] text-slate-500 hover:text-slate-300">no</button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      title={`Borrar "${classTitle}"`}
      className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-950/30 transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6M14 11v6M5 7l1 12.5a2 2 0 002 1.5h8a2 2 0 002-1.5L19 7M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
      </svg>
    </button>
  );
}

// ── Summary view ──────────────────────────────────────────────────────────────
function SummaryView({ cls, materials, subjectName, claudeProjectUrl, previousClassTitle }: {
  cls: ClassWithStats;
  materials: ClassMaterial[];
  subjectName: string;
  claudeProjectUrl: string | null;
  previousClassTitle: string | null;
}) {
  if (!cls.summary) {
    return (
      <div className="rounded-xl border-2 border-dashed border-amber-900/40 bg-amber-950/10 p-8 text-center">
        <div className="text-3xl mb-3">✨</div>
        <p className="text-[14px] text-slate-200 font-medium mb-1">Sin resumen todavía</p>
        <p className="text-[12px] text-slate-500 max-w-2xl mx-auto leading-relaxed mb-5">
          Genero un <span className="text-slate-300 font-medium">resumen académico estilo UdeSA</span> con cajas de definición /
          nota / ejemplo / advertencia, fórmulas LaTeX, tablas, código y un repaso final.
          Click → abre los {materials.length} archivos en pestañas + claude.ai con el prompt cargado, pegás la respuesta y se renderea acá.
        </p>
        <ClassClaudeButton
          classItem={cls}
          materials={materials}
          subjectName={subjectName}
          claudeProjectUrl={claudeProjectUrl}
          previousClassTitle={previousClassTitle}
        />
      </div>
    );
  }

  const printTitle = `${subjectName} · Clase ${cls.week}: ${cls.title}`;
  const printMeta = cls.date ? `Resumen · ${cls.date}` : `Resumen`;

  return (
    <div>
      <RichSummary
        markdown={cls.summary}
        title={printTitle}
        meta={printMeta}
        onPrint={() => window.print()}
      />

      <div className="mt-6 pt-4 border-t border-slate-900 flex items-center justify-between gap-3 text-[11px] print:hidden">
        <p className="text-slate-600">
          {cls.summarized ? "Marcada como resumida" : "Borrador"} · {materials.length} archivo{materials.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-1.5">
          <ClassClaudeButton
            classItem={cls}
            materials={materials}
            subjectName={subjectName}
            claudeProjectUrl={claudeProjectUrl}
            previousClassTitle={previousClassTitle}
            variant="ghost"
            label="Editar"
            initialTab="save"
          />
          <ClassClaudeButton
            classItem={cls}
            materials={materials}
            subjectName={subjectName}
            claudeProjectUrl={claudeProjectUrl}
            previousClassTitle={previousClassTitle}
            variant="ghost"
            label="Regenerar"
            initialTab="ask"
          />
        </div>
      </div>
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
function TasksView({ classId, tasks, today }: { classId: number; tasks: Task[]; today: string }) {
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<Record<number, boolean>>({});
  const [draft, setDraft] = useState("");
  const [priority, setPriority] = useState<"alta" | "media" | "baja">("media");

  const handleToggle = useCallback((id: number, currentDone: boolean) => {
    setOptimistic(prev => ({ ...prev, [id]: !currentDone }));
    startTransition(async () => { await toggleTask(id); });
  }, []);

  const handleAdd = () => {
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    startTransition(async () => { await createTaskForClass(classId, t, priority, null); });
  };

  return (
    <div className="space-y-1">
      {tasks.length === 0 && (
        <div className="rounded-xl border border-slate-800 px-5 py-6 text-center mb-2">
          <p className="text-[13px] text-slate-400">Sin tareas en esta clase.</p>
          <p className="text-[11px] text-slate-600 mt-1">Agregá una abajo o desde Hoy.</p>
        </div>
      )}

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

      {/* Quick-add task */}
      <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-800 hover:border-slate-700 transition-colors">
        <span className="text-slate-700 text-base leading-none">+</span>
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          placeholder="Agregar tarea a esta clase…"
          className="flex-1 bg-transparent text-[13px] text-slate-200 placeholder-slate-600 outline-none"
        />
        <select
          value={priority}
          onChange={e => setPriority(e.target.value as "alta" | "media" | "baja")}
          className="bg-slate-950 border border-slate-800 rounded text-[10px] text-slate-400 px-1.5 py-0.5 outline-none focus:border-slate-600"
        >
          <option value="alta">alta</option>
          <option value="media">media</option>
          <option value="baja">baja</option>
        </select>
        <button
          onClick={handleAdd}
          disabled={!draft.trim()}
          className="text-[11px] text-slate-400 hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed px-2 py-1 rounded hover:bg-slate-800 transition-colors"
        >
          ↵
        </button>
      </div>
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
  const [tab, setTab] = useState<DetailTab>("summary");
  const [triggerTitleEdit, setTriggerTitleEdit] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Derive a valid selection — if the stored id no longer exists, fall back to the first class
  const selected = useMemo(() => {
    const match = selectedIdRaw !== null
      ? classesWithStats.find(c => c.id === selectedIdRaw)
      : null;
    return match ?? classesWithStats[0] ?? null;
  }, [classesWithStats, selectedIdRaw]);
  const selectedId = selected?.id ?? null;

  // Previous class (for the "Comparar con anterior" template)
  const previousClass = useMemo(() => {
    if (!selected) return null;
    const idx = classesWithStats.findIndex(c => c.id === selected.id);
    return idx > 0 ? classesWithStats[idx - 1] : null;
  }, [classesWithStats, selected]);

  // Keyboard shortcuts: j/k for class nav, 1/2/3 for tabs, / for search, e to edit title
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (e.key === "/" && !inField) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      if (inField) return;

      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const idx = classesWithStats.findIndex(c => c.id === selectedId);
      if (e.key === "j" && idx >= 0 && idx < classesWithStats.length - 1) {
        e.preventDefault();
        setSelectedId(classesWithStats[idx + 1].id);
        return;
      }
      if (e.key === "k" && idx > 0) {
        e.preventDefault();
        setSelectedId(classesWithStats[idx - 1].id);
        return;
      }
      if (e.key === "1") { e.preventDefault(); setTab("summary"); return; }
      if (e.key === "2") { e.preventDefault(); setTab("files"); return; }
      if (e.key === "3") { e.preventDefault(); setTab("tasks"); return; }
      if (e.key === "e") { e.preventDefault(); setTriggerTitleEdit(n => n + 1); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [classesWithStats, selectedId]);
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
        <>
          <div className="flex gap-6 items-start">
            <ClassRail
              classes={classesWithStats}
              selectedId={selectedId}
              onSelect={setSelectedId}
              filter={filter}
              setFilter={setFilter}
              search={search}
              setSearch={setSearch}
              searchInputRef={searchInputRef}
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
                tab={tab}
                setTab={setTab}
                previousClassTitle={previousClass?.title ?? null}
                triggerTitleEdit={triggerTitleEdit}
              />
            )}
          </div>

          {/* Keyboard shortcuts hint */}
          <div className="mt-6 pt-3 border-t border-slate-900 flex items-center gap-4 text-[10px] text-slate-700 font-mono flex-wrap">
            {([
              ["j/k", "siguiente/anterior clase"],
              ["1/2/3", "Resumen / Archivos / Tareas"],
              ["/", "buscar"],
              ["e", "editar título"],
            ] as [string, string][]).map(([k, l]) => (
              <span key={k} className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-slate-400 text-[9px]">{k}</kbd>
                <span>{l}</span>
              </span>
            ))}
          </div>
        </>
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
