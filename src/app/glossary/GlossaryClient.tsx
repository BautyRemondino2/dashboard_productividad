"use client";

import {
  useState, useMemo, useEffect, useRef, useTransition, useCallback,
} from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { GlossaryTerm, TermType } from "@/lib/glossary";
import { GLOSSARY_CATEGORIES } from "@/lib/glossary";
import { updateGlossaryTerm, createGlossaryTerm, deleteGlossaryTerm } from "@/app/actions";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface LocalTerm extends GlossaryTerm { fav: boolean; }
interface PriceInfo { value: number; delta: number; currency: string; history: number[]; }

const TYPE_LABEL: Record<TermType, string> = {
  instrumento: "Instrumento",
  metrica:     "Métrica",
  concepto:    "Concepto",
};

// ─── Category config ───────────────────────────────────────────────────────────
const CATS: Record<string, { hue: number }> = {
  "Renta Fija":      { hue: 200 },
  "Renta Variable":  { hue: 160 },
  "Derivados":       { hue: 280 },
  "Tasas & Curvas":  { hue: 230 },
  "Instrumentos AR": { hue: 0   },
  "Macro Argentina": { hue: 30  },
  "General":         { hue: 220 },
};
const catHue   = (cat: string) => CATS[cat]?.hue ?? 220;
const catColor = (cat: string, l = 65) => `oklch(${l}% 0.11 ${catHue(cat)})`;
const catSoft  = (cat: string, a = 0.4) => `oklch(28% 0.05 ${catHue(cat)} / ${a})`;

// ─── SVG Icons ─────────────────────────────────────────────────────────────────
function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="w-4 h-4" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.5l2.5 5.1 5.6.8-4.05 3.95.95 5.55-5-2.63-5 2.63.95-5.55L3.4 9.4l5.6-.8 2.48-5.1z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6M14 11v6M5 7l1 12.5a2 2 0 002 1.5h8a2 2 0 002-1.5L19 7M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M6 6l12 12M6 18L18 6" />
    </svg>
  );
}
function CompareIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" d="M7 4v16M17 4v16M3 8h8M13 16h8" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12l5 5L20 6" />
    </svg>
  );
}
function GridIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H7v-3a2 2 0 01.586-1.414z" />
    </svg>
  );
}

// ─── CategorySelect ────────────────────────────────────────────────────────────
function CategorySelect({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap flex items-center gap-1 hover:opacity-90 transition-opacity"
        style={{ background: catSoft(value, 0.45), color: catColor(value, 82) }}
        title="Cambiar categoría"
      >
        {value}
        <svg className="w-2.5 h-2.5 opacity-60" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-[60] bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 min-w-[160px]">
          {GLOSSARY_CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => { onChange(c); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-2 transition-colors ${
                c === value ? "text-slate-100 bg-slate-800" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: catColor(c, 70) }} />
              <span className="flex-1">{c}</span>
              {c === value && <CheckIcon />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TypeSelect ────────────────────────────────────────────────────────────────
function TypeSelect({ value, onChange }: { value: TermType; onChange: (t: TermType) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const TYPES: TermType[] = ["concepto", "instrumento", "metrica"];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition-colors flex items-center gap-1"
        title="Cambiar tipo"
      >
        {TYPE_LABEL[value ?? "concepto"]}
        <svg className="w-2.5 h-2.5 opacity-60" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-[60] bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 min-w-[130px]">
          {TYPES.map(t => (
            <button
              key={t}
              onClick={() => { onChange(t); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-2 transition-colors ${
                t === value ? "text-slate-100 bg-slate-800" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <span className="flex-1">{TYPE_LABEL[t]}</span>
              {t === value && <CheckIcon />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data, color = "currentColor", width = 84, height = 26 }: {
  data: number[]; color?: string; width?: number; height?: number;
}) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const pts = data.map((v, i) => [
    (i * stepX).toFixed(1),
    (height - 2 - ((v - min) / range) * (height - 4)).toFixed(1),
  ] as [string, string]);
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const [lx, ly] = pts[pts.length - 1]!;
  const gid = `sg${data.length}${Math.round(data[0] ?? 0)}`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${lx},${height} L0,${height} Z`} fill={`url(#${gid})`} />
      <path d={d} stroke={color} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2" fill={color} />
    </svg>
  );
}

// ─── TermText — auto-links glossary term mentions ──────────────────────────────
function TermText({ text, terms, currentId, onOpenTerm }: {
  text: string; terms: LocalTerm[]; currentId: number; onOpenTerm: (id: number) => void;
}) {
  if (!text) return null;
  const others = terms.filter(t => t.id !== currentId);
  if (others.length === 0) return <>{text}</>;
  const escaped = [...others]
    .sort((a, b) => b.term.length - a.term.length)
    .map(t => t.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  let regex: RegExp;
  try { regex = new RegExp(`(${escaped.join("|")})`, "gi"); }
  catch { return <>{text}</>; }
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) => {
        const hit = others.find(t => t.term.toLowerCase() === part.toLowerCase());
        return hit
          ? <button key={i} data-link-term="1" onClick={e => { e.stopPropagation(); onOpenTerm(hit.id); }}
              className="text-slate-100 underline decoration-dotted decoration-slate-600 underline-offset-2 hover:decoration-slate-300 hover:text-white transition-colors">{part}</button>
          : <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ─── EditableField ─────────────────────────────────────────────────────────────
function EditableField({ value, onSave, multiline = false, placeholder = "—",
  className = "", allowEmpty = false, renderView }: {
  value: string; onSave: (v: string) => void; multiline?: boolean;
  placeholder?: string; className?: string; allowEmpty?: boolean;
  renderView?: (v: string) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  const commit = useCallback(() => {
    setEditing(false);
    const t = draft.trim();
    if (t === value.trim()) return;
    if (!t && !allowEmpty) return;
    onSave(t);
  }, [draft, value, allowEmpty, onSave]);

  const cancel = () => { setDraft(value); setEditing(false); };
  const base = `${className} w-full bg-slate-900 border border-slate-700 focus:border-slate-500 outline-none rounded-md px-2.5 py-2 leading-relaxed`;

  if (editing) {
    return multiline ? (
      <textarea autoFocus value={draft || ""} onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === "Escape") { e.preventDefault(); cancel(); }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
        }}
        rows={Math.max(3, (draft || "").split("\n").length + 1)}
        className={`${base} resize-y`} />
    ) : (
      <input autoFocus type="text" value={draft || ""} onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === "Escape") { e.preventDefault(); cancel(); }
          if (e.key === "Enter") { e.preventDefault(); commit(); }
        }}
        className={base} />
    );
  }

  return (
    <div role="button" tabIndex={0}
      onClick={e => { if ((e.target as HTMLElement).closest("[data-link-term]")) return; setEditing(true); }}
      onKeyDown={e => { if (e.key === "Enter" && e.target === e.currentTarget) setEditing(true); }}
      className={`${className} cursor-text rounded-md -mx-1.5 px-1.5 py-0.5 hover:bg-slate-900/60 transition-colors`}
      title="Clic para editar">
      {value
        ? (renderView ? renderView(value) : value)
        : <span className="text-slate-600 italic">{placeholder}</span>}
    </div>
  );
}

// ─── PriceBlock ────────────────────────────────────────────────────────────────
function PriceBlock({ ticker, hue }: { ticker: string; hue: number }) {
  const [info, setInfo] = useState<PriceInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/glossary/price?ticker=${encodeURIComponent(ticker)}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/glossary/history?ticker=${encodeURIComponent(ticker)}`).then(r => r.ok ? r.json() : null),
    ]).then(([p, h]: [{ price: number; changePct: number; currency: string } | null, { data?: { close: number | null }[] } | null]) => {
      if (cancelled) return;
      if (!p) { setLoading(false); return; }
      setInfo({
        value: p.price ?? 0,
        delta: p.changePct ?? 0,
        currency: p.currency ?? "USD",
        history: (h?.data ?? []).map(d => d.close ?? 0).filter(v => v > 0),
      });
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker]);

  const boxStyle = { background: `oklch(28% 0.05 ${hue} / 0.18)`, borderColor: `oklch(28% 0.05 ${hue} / 0.4)` };

  if (loading) {
    return (
      <div className="rounded-lg px-3 py-2.5 border flex items-center gap-2" style={boxStyle}>
        <div className="w-3 h-3 rounded-full border border-slate-700 border-t-slate-400 animate-spin shrink-0" />
        <span className="text-[11px] text-slate-600">Cargando {ticker}…</span>
      </div>
    );
  }
  if (!info) return null;

  const up = info.delta >= 0;
  const fmtVal = info.currency === "ARS"
    ? `$${info.value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
    : `US$${info.value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="rounded-lg px-3 py-2.5 border flex items-stretch justify-between gap-4" style={boxStyle}>
      <div className="min-w-0">
        <div className="text-[9px] uppercase tracking-widest text-slate-500 mb-0.5">precio · yahoo · {ticker}</div>
        <div className="text-xl font-semibold text-slate-100 tabular-nums leading-tight">{fmtVal}</div>
        <div className={`text-[11px] tabular-nums font-medium mt-0.5 ${up ? "text-emerald-400" : "text-red-400"}`}>
          {up ? "▲" : "▼"} {Math.abs(info.delta).toFixed(2)}% · 24h
        </div>
      </div>
      {info.history.length >= 2 && (
        <div className="flex flex-col items-end justify-between shrink-0">
          <div className="text-[9px] uppercase tracking-widest text-slate-600">historial</div>
          <Sparkline data={info.history} color={up ? "rgb(52,211,153)" : "rgb(248,113,113)"} width={92} height={28} />
        </div>
      )}
    </div>
  );
}

// ─── FormulaBlock ──────────────────────────────────────────────────────────────
function FormulaBlock({ latex, hue }: { latex: string; hue: number }) {
  const html = useMemo(() => {
    try { return katex.renderToString(latex, { throwOnError: false, displayMode: true }); }
    catch { return null; }
  }, [latex]);

  if (!html) return null;
  return (
    <div
      className="rounded-lg px-4 py-3 border overflow-x-auto"
      style={{ background: `oklch(18% 0.04 ${hue} / 0.6)`, borderColor: `oklch(28% 0.06 ${hue} / 0.5)` }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ─── IconButton ────────────────────────────────────────────────────────────────
function IconButton({ children, onClick, title, active = false, danger = false }: {
  children: React.ReactNode; onClick: () => void; title: string;
  active?: boolean; danger?: boolean;
}) {
  const cls = danger
    ? "text-red-500/80 hover:text-red-400 hover:bg-red-950/40"
    : active
    ? "text-amber-400 bg-amber-950/30"
    : "text-slate-500 hover:text-slate-200 hover:bg-slate-900";
  return (
    <button onClick={onClick} title={title}
      className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${cls}`}>
      {children}
    </button>
  );
}

// ─── Segmented control ─────────────────────────────────────────────────────────
function Segmented({ value, options, onChange }: {
  value: string; options: { value: string; label: string }[]; onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex items-center bg-slate-900/60 border border-slate-800 rounded-md p-0.5 gap-0.5">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`px-2 py-0.5 rounded text-[11px] transition-colors whitespace-nowrap ${
            value === o.value ? "bg-slate-700/60 text-slate-100" : "text-slate-500 hover:text-slate-300"
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── TermCard (grid) ───────────────────────────────────────────────────────────
function TermCard({ term, onClick, onToggleFav, onToggleCompare, isSelected, isCompared }: {
  term: LocalTerm; onClick: () => void; onToggleFav: (id: number) => void;
  onToggleCompare: (id: number) => void; isSelected: boolean; isCompared: boolean;
}) {
  const accent = catColor(term.category, 70);
  return (
    <div onClick={onClick}
      className={`group relative cursor-pointer rounded-xl border bg-slate-900/40 hover:bg-slate-900/70 hover:border-slate-700 transition-all overflow-hidden ${
        isSelected  ? "border-slate-600 ring-1 ring-slate-700"
        : isCompared ? "border-slate-600"
        : "border-slate-800/80"
      }`}>
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: accent }} />
      {isCompared && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-slate-100"
          style={{ background: accent }}>
          <CheckIcon />
        </div>
      )}
      <div className="pl-4 pr-4 py-3.5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3 className="text-[14px] font-semibold text-slate-100 leading-tight">{term.term}</h3>
              {term.ticker && (
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/50 whitespace-nowrap">
                  {term.ticker}
                </span>
              )}
            </div>
          </div>
          {!isCompared && (
            <div className="shrink-0 -mr-1 -mt-1 flex items-center gap-0.5">
              <button onClick={e => { e.stopPropagation(); onClick(); }}
                className="w-7 h-7 rounded-md flex items-center justify-center text-slate-700 opacity-0 group-hover:opacity-100 hover:bg-slate-800 hover:text-slate-300 transition-all"
                title="Editar"><PencilIcon /></button>
              <button onClick={e => { e.stopPropagation(); onToggleCompare(term.id); }}
                className="w-7 h-7 rounded-md flex items-center justify-center text-slate-700 opacity-0 group-hover:opacity-100 hover:bg-slate-800 hover:text-slate-300 transition-all"
                title="Comparar"><CompareIcon /></button>
              <button onClick={e => { e.stopPropagation(); onToggleFav(term.id); }}
                className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
                  term.fav ? "text-amber-400" : "text-slate-700 opacity-0 group-hover:opacity-100 hover:bg-slate-800 hover:text-slate-300"
                }`} title={term.fav ? "Quitar favorito" : "Favorito"}>
                <StarIcon filled={term.fav} />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap"
            style={{ background: catSoft(term.category, 0.35), color: catColor(term.category, 80) }}>
            {term.category}
          </span>
        </div>
        <p className="text-[12.5px] text-slate-400 leading-relaxed line-clamp-2">{term.short_def}</p>
      </div>
    </div>
  );
}

// ─── AddCard ───────────────────────────────────────────────────────────────────
function AddCard({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="group rounded-xl border border-dashed border-slate-800 hover:border-slate-600 bg-slate-900/10 hover:bg-slate-900/40 px-4 py-5 flex flex-col items-center justify-center gap-2 text-slate-600 hover:text-slate-300 transition-all min-h-[140px]">
      <div className="w-9 h-9 rounded-full border border-slate-800 group-hover:border-slate-500 flex items-center justify-center text-xl leading-none">+</div>
      <div className="text-[12px] font-medium whitespace-nowrap">Nuevo término</div>
      <kbd className="text-[9px] text-slate-700 font-mono">⌘N</kbd>
    </button>
  );
}

// ─── ListView ──────────────────────────────────────────────────────────────────
function ListView({ terms, onOpen, onToggleFav, onToggleCompare, selectedId, compareIds }: {
  terms: LocalTerm[]; onOpen: (id: number) => void; onToggleFav: (id: number) => void;
  onToggleCompare: (id: number) => void; selectedId: number | null; compareIds: number[];
}) {
  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/20">
      <div className="grid items-center gap-x-4 px-4 py-2 bg-slate-900/60 border-b border-slate-800 text-[10px] uppercase tracking-widest text-slate-500"
        style={{ gridTemplateColumns: "20px 1.5fr 140px 2.2fr 56px" }}>
        <div /><div>Término</div><div>Categoría</div><div>Definición</div><div />
      </div>
      <div className="divide-y divide-slate-900">
        {terms.map(t => {
          const accent = catColor(t.category, 70);
          const inCompare = compareIds.includes(t.id);
          return (
            <div key={t.id} onClick={() => onOpen(t.id)}
              className={`group grid items-center gap-x-4 px-4 py-2.5 cursor-pointer transition-colors relative ${
                selectedId === t.id ? "bg-slate-800/40" : inCompare ? "bg-slate-900/50" : "hover:bg-slate-900/40"
              }`}
              style={{ gridTemplateColumns: "20px 1.5fr 140px 2.2fr 56px" }}>
              <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: accent }} />
              <button onClick={e => { e.stopPropagation(); onToggleFav(t.id); }}
                className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
                  t.fav ? "text-amber-400" : "text-slate-800 opacity-0 group-hover:opacity-100 hover:text-slate-400"
                }`}>
                <StarIcon filled={t.fav} />
              </button>
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-[13px] font-medium text-slate-100 truncate">{t.term}</span>
                {t.ticker && (
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-500 border border-slate-700/50 whitespace-nowrap">
                    {t.ticker}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap"
                style={{ background: catSoft(t.category, 0.35), color: catColor(t.category, 80) }}>
                {t.category}
              </span>
              <p className="text-[12px] text-slate-500 leading-snug truncate">{t.short_def}</p>
              <div className="flex items-center gap-0.5">
                <button onClick={e => { e.stopPropagation(); onOpen(t.id); }}
                  className="w-6 h-6 rounded flex items-center justify-center text-slate-700 opacity-0 group-hover:opacity-100 hover:bg-slate-800 hover:text-slate-300 transition-all"
                  title="Editar">
                  <PencilIcon />
                </button>
                <button onClick={e => { e.stopPropagation(); onToggleCompare(t.id); }}
                  className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                    inCompare ? "text-slate-100" : "text-slate-700 opacity-0 group-hover:opacity-100 hover:bg-slate-800 hover:text-slate-300"
                  }`}
                  style={inCompare ? { background: accent } : undefined}>
                  {inCompare ? <CheckIcon /> : <CompareIcon />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SectionHeader ─────────────────────────────────────────────────────────────
function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-baseline gap-3 mb-3 sticky top-10 py-2 bg-slate-950/85 backdrop-blur z-10">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{label}</h3>
      <span className="text-[10px] text-slate-700 tabular-nums">{count}</span>
      <div className="flex-1 h-px bg-slate-900" />
    </div>
  );
}

// ─── AlphaRail ─────────────────────────────────────────────────────────────────
function AlphaRail({ available, onJump }: { available: Set<string>; onJump: (l: string) => void }) {
  const letters = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");
  return (
    <div className="hidden xl:flex sticky top-20 flex-col items-center gap-0 text-[10px] font-mono shrink-0 w-6 self-start">
      {letters.map(l => {
        const has = available.has(l);
        return (
          <button key={l} disabled={!has} onClick={() => onJump(l)}
            className={`w-6 h-5 flex items-center justify-center rounded transition-colors ${
              has ? "text-slate-400 hover:text-slate-100 hover:bg-slate-800" : "text-slate-800 cursor-default"
            }`}>
            {l}
          </button>
        );
      })}
    </div>
  );
}

// ─── CategoryChips ─────────────────────────────────────────────────────────────
function CategoryChips({ active, setActive, counts, total }: {
  active: string; setActive: (c: string) => void;
  counts: Record<string, number>; total: number;
}) {
  const all = ["all", ...Object.keys(CATS)];
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {all.map(c => {
        const isActive = active === c;
        const label = c === "all" ? "Todas" : c;
        const n = c === "all" ? total : (counts[c] ?? 0);
        const accent = c === "all" ? "rgb(148,163,184)" : catColor(c, 70);
        return (
          <button key={c} onClick={() => setActive(c)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] border transition-all whitespace-nowrap ${
              isActive
                ? "bg-slate-800/80 border-slate-700 text-slate-100"
                : "bg-slate-900/40 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}>
            {c !== "all" && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent }} />}
            <span>{label}</span>
            <span className={`tabular-nums text-[10px] px-1 rounded ${
              isActive ? "bg-slate-700/70 text-slate-300" : "bg-slate-800/80 text-slate-500"
            }`}>{n}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Toolbar ───────────────────────────────────────────────────────────────────
function Toolbar({ sort, setSort, group, setGroup, count, density, setDensity, view, setView }: {
  sort: string; setSort: (s: string) => void;
  group: boolean; setGroup: (g: boolean) => void;
  count: number; density: string; setDensity: (d: string) => void;
  view: string; setView: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-y border-slate-900/80 mb-4 flex-wrap">
      <div className="text-[11px] text-slate-500">
        <span className="text-slate-300 font-medium tabular-nums">{count}</span> términos
      </div>
      <div className="flex items-center gap-3 text-[11px] flex-wrap">
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-slate-600">ordenar</span>
          <Segmented value={sort}
            options={[{ value: "alpha", label: "A-Z" }, { value: "category", label: "Categoría" }, { value: "recent", label: "Recientes" }]}
            onChange={setSort} />
        </div>
        <div className="w-px h-4 bg-slate-800" />
        <button onClick={() => setGroup(!group)}
          className={`px-2 py-1 rounded text-[11px] transition-colors whitespace-nowrap ${
            group ? "bg-slate-800 text-slate-200" : "text-slate-500 hover:text-slate-300"
          }`}>
          {group ? "☑" : "☐"} agrupar
        </button>
        <div className="w-px h-4 bg-slate-800" />
        <Segmented value={density}
          options={[{ value: "comfy", label: "Cómoda" }, { value: "compact", label: "Compacta" }]}
          onChange={setDensity} />
        <div className="w-px h-4 bg-slate-800" />
        <div className="inline-flex items-center bg-slate-900/60 border border-slate-800 rounded-md p-0.5 gap-0.5">
          <button onClick={() => setView("grid")} title="Grilla"
            className={`p-1 rounded transition-colors ${view === "grid" ? "bg-slate-700/60 text-slate-100" : "text-slate-500 hover:text-slate-300"}`}>
            <GridIcon />
          </button>
          <button onClick={() => setView("list")} title="Lista"
            className={`p-1 rounded transition-colors ${view === "list" ? "bg-slate-700/60 text-slate-100" : "text-slate-500 hover:text-slate-300"}`}>
            <ListIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DrawerSection ─────────────────────────────────────────────────────────────
function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">{title}</h4>
      {children}
    </div>
  );
}

// ─── Drawer ────────────────────────────────────────────────────────────────────
function Drawer({ term, allTerms, onClose, onToggleFav, onDelete, onUpdate, onOpenTerm, onAddToCompare, isInCompare }: {
  term: LocalTerm | null; allTerms: LocalTerm[]; onClose: () => void;
  onToggleFav: (id: number) => void; onDelete: (id: number) => void;
  onUpdate: (id: number, patch: Partial<LocalTerm>) => void;
  onOpenTerm: (id: number) => void; onAddToCompare: (id: number) => void;
  isInCompare: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [, startTransition] = useTransition();
  const termId = term?.id;

  useEffect(() => {
    if (termId !== undefined) requestAnimationFrame(() => setMounted(true));
    else { setMounted(false); setConfirmDel(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termId]);

  useEffect(() => {
    if (!term) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmDel) { setConfirmDel(false); return; }
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [term, onClose, confirmDel]);

  const save = useCallback((field: string) => (value: string) => {
    if (!term) return;
    const val: string | null = field === "ticker" ? (value.toUpperCase() || null) : (value || null);
    onUpdate(term.id, { [field]: val } as Partial<LocalTerm>);
    startTransition(async () => {
      await updateGlossaryTerm(term.id, field, val);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term?.id, onUpdate]);

  const saveCategory = useCallback((cat: string) => {
    if (!term) return;
    onUpdate(term.id, { category: cat });
    startTransition(async () => {
      await updateGlossaryTerm(term.id, "category", cat);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term?.id, onUpdate]);

  const saveType = useCallback((t: TermType) => {
    if (!term) return;
    onUpdate(term.id, { term_type: t });
    startTransition(async () => {
      await updateGlossaryTerm(term.id, "term_type", t);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term?.id, onUpdate]);

  if (!term) return null;
  const hue    = catHue(term.category);
  const accent = catColor(term.category, 70);
  const related = allTerms.filter(t => t.category === term.category && t.id !== term.id).slice(0, 6);

  const linked = (txt: string) => (
    <TermText text={txt} terms={allTerms} currentId={term.id} onOpenTerm={onOpenTerm} />
  );

  return (
    <>
      <div onClick={onClose}
        className={`fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200 ${mounted ? "opacity-100" : "opacity-0"}`} />
      <aside className={`fixed right-0 top-0 bottom-0 z-50 w-[460px] max-w-[92vw] bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col transition-transform duration-200 ease-out ${mounted ? "translate-x-0" : "translate-x-full"}`}>
        {/* Header */}
        <div className="relative px-6 pt-5 pb-4 border-b border-slate-900">
          <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accent }} />
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <CategorySelect value={term.category} onChange={saveCategory} />
                <TypeSelect value={term.term_type ?? "concepto"} onChange={saveType} />
                <EditableField
                  value={term.ticker ?? ""}
                  onSave={save("ticker")}
                  allowEmpty
                  placeholder="+ ticker"
                  className="font-mono text-[10px] text-slate-400"
                  renderView={v => (
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/50">
                      {v}
                    </span>
                  )}
                />
              </div>
              <EditableField value={term.term} onSave={save("term")} placeholder="Nombre del término"
                className="text-2xl font-semibold text-slate-100 tracking-tight" />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <IconButton onClick={() => onToggleFav(term.id)} title={term.fav ? "Quitar favorito" : "Favorito"} active={term.fav}>
                <StarIcon filled={term.fav} />
              </IconButton>
              <IconButton onClick={() => setConfirmDel(true)} title="Eliminar" danger>
                <TrashIcon />
              </IconButton>
              <IconButton onClick={onClose} title="Cerrar (Esc)">
                <CloseIcon />
              </IconButton>
            </div>
          </div>

          {confirmDel && (
            <div className="mb-3 rounded-lg border border-red-900/70 bg-red-950/30 px-3 py-2 flex items-center justify-between gap-2">
              <p className="text-[12px] text-red-300">¿Eliminar <span className="font-semibold">{term.term}</span>? No se puede deshacer.</p>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => setConfirmDel(false)}
                  className="text-[11px] px-2 py-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors">
                  Cancelar
                </button>
                <button onClick={() => { onDelete(term.id); onClose(); }}
                  className="text-[11px] font-medium px-2 py-1 rounded bg-red-600/80 hover:bg-red-600 text-white transition-colors">
                  Sí, eliminar
                </button>
              </div>
            </div>
          )}

          {/* instrumento: price block in header */}
          {term.term_type === "instrumento" && term.ticker && (
            <PriceBlock ticker={term.ticker} hue={hue} />
          )}
          {/* metrica: formula block in header */}
          {term.term_type === "metrica" && term.formula && (
            <FormulaBlock latex={term.formula} hue={hue} />
          )}
          {/* concepto with ticker: show price too */}
          {term.term_type === "concepto" && term.ticker && (
            <PriceBlock ticker={term.ticker} hue={hue} />
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* instrumento layout */}
          {term.term_type === "instrumento" && (<>
            <DrawerSection title="Descripción">
              <EditableField value={term.short_def} onSave={save("short_def")} multiline
                placeholder="Descripción del instrumento…"
                className="text-[14px] text-slate-200 leading-relaxed block"
                renderView={v => <>{linked(v)}</>} />
            </DrawerSection>
            <DrawerSection title="Características">
              <EditableField value={term.detail} onSave={save("detail")} multiline
                placeholder="Características del instrumento…"
                className="text-[13px] text-slate-400 leading-relaxed block"
                renderView={v => <>{linked(v)}</>} />
            </DrawerSection>
            {term.example && (
              <DrawerSection title="Ejemplo operativo">
                <div className="rounded-lg px-4 py-3 border-l-2"
                  style={{ background: catSoft(term.category, 0.15), borderColor: catColor(term.category, 60) }}>
                  <EditableField value={term.example} onSave={save("example")} multiline
                    placeholder="Ejemplo operativo…"
                    className="text-[13px] text-slate-300 leading-relaxed italic block"
                    renderView={v => <>{linked(v)}</>} />
                </div>
              </DrawerSection>
            )}
          </>)}

          {/* metrica layout */}
          {term.term_type === "metrica" && (<>
            {/* formula edit (shows only if formula exists OR always editable) */}
            <DrawerSection title="Fórmula (LaTeX)">
              <EditableField value={term.formula ?? ""} onSave={save("formula")} allowEmpty
                placeholder="Escribir fórmula en LaTeX…"
                className="font-mono text-[11px] text-slate-400 block"
                renderView={v => term.formula ? <FormulaBlock latex={v} hue={hue} /> : <span className="text-slate-600 italic text-[12px]">Sin fórmula — clic para agregar</span>}
              />
            </DrawerSection>
            <DrawerSection title="Definición">
              <EditableField value={term.short_def} onSave={save("short_def")} multiline
                placeholder="Definición de la métrica…"
                className="text-[14px] text-slate-200 leading-relaxed block"
                renderView={v => <>{linked(v)}</>} />
            </DrawerSection>
            <DrawerSection title="Interpretación">
              <EditableField value={term.detail} onSave={save("detail")} multiline
                placeholder="Cómo interpretar esta métrica…"
                className="text-[13px] text-slate-400 leading-relaxed block"
                renderView={v => <>{linked(v)}</>} />
            </DrawerSection>
            <DrawerSection title="Ejemplo numérico">
              <div className="rounded-lg px-4 py-3 border-l-2"
                style={{ background: catSoft(term.category, 0.15), borderColor: catColor(term.category, 60) }}>
                <EditableField value={term.example} onSave={save("example")} multiline
                  placeholder="Ejemplo con números concretos…"
                  className="text-[13px] text-slate-300 leading-relaxed italic block"
                  renderView={v => <>{linked(v)}</>} />
              </div>
            </DrawerSection>
          </>)}

          {/* concepto layout */}
          {(!term.term_type || term.term_type === "concepto") && (<>
            <DrawerSection title="Definición">
              <EditableField value={term.short_def} onSave={save("short_def")} multiline
                placeholder="Definición corta…"
                className="text-[14px] text-slate-200 leading-relaxed block"
                renderView={v => <>{linked(v)}</>} />
            </DrawerSection>
            <DrawerSection title="Detalle">
              <EditableField value={term.detail} onSave={save("detail")} multiline
                placeholder="Detalle conceptual…"
                className="text-[13px] text-slate-400 leading-relaxed block"
                renderView={v => <>{linked(v)}</>} />
            </DrawerSection>
            <DrawerSection title="Ejemplo">
              <div className="rounded-lg px-4 py-3 border-l-2"
                style={{ background: catSoft(term.category, 0.15), borderColor: catColor(term.category, 60) }}>
                <EditableField value={term.example} onSave={save("example")} multiline
                  placeholder="Ejemplo concreto…"
                  className="text-[13px] text-slate-300 leading-relaxed italic block"
                  renderView={v => <>{linked(v)}</>} />
              </div>
            </DrawerSection>
          </>)}

          {related.length > 0 && (
            <DrawerSection title="Relacionados">
              <div className="flex flex-wrap gap-1.5">
                {related.map(r => (
                  <button key={r.id} onClick={() => onOpenTerm(r.id)}
                    className="text-[11px] px-2 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 cursor-pointer transition-colors whitespace-nowrap">
                    {r.term}
                  </button>
                ))}
              </div>
            </DrawerSection>
          )}

          <p className="text-[10px] text-slate-700 pt-2 border-t border-slate-900">
            Tip · clic en cualquier texto para editar · ⌘+↵ para guardar bloques · Esc para cancelar
          </p>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-900 px-6 py-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-600 whitespace-nowrap">{related.length} relacionados en {term.category}</p>
          <button onClick={() => onAddToCompare(term.id)} disabled={isInCompare}
            className="text-[12px] font-medium px-3 py-1.5 rounded-lg text-slate-100 transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            style={{ background: catSoft(term.category, 0.5), border: `1px solid ${catColor(term.category, 50)}` }}>
            <CompareIcon />
            {isInCompare ? "En comparación" : "Comparar"}
          </button>
        </div>
      </aside>
    </>
  );
}

// ─── CompareBar ────────────────────────────────────────────────────────────────
function CompareBar({ terms, onRemove, onClear, onOpen, max = 3 }: {
  terms: LocalTerm[]; onRemove: (id: number) => void; onClear: () => void;
  onOpen: () => void; max?: number;
}) {
  if (terms.length === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl px-3 py-2.5 flex items-center gap-3 max-w-[min(720px,92vw)]">
      <div className="text-[10px] uppercase tracking-widest text-slate-500 shrink-0 whitespace-nowrap">
        Comparar · <span className="tabular-nums text-slate-300">{terms.length}/{max}</span>
      </div>
      <div className="w-px h-6 bg-slate-800 shrink-0" />
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        {terms.map(t => (
          <div key={t.id} className="inline-flex items-center gap-1.5 rounded-md bg-slate-800/80 border border-slate-700 pl-2 pr-1 py-1 text-[11px] text-slate-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: catColor(t.category, 70) }} />
            {t.term}
            <button onClick={() => onRemove(t.id)}
              className="w-4 h-4 rounded flex items-center justify-center text-slate-500 hover:text-slate-100 hover:bg-slate-700 transition-colors">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        <button onClick={onClear} className="text-[11px] px-2 py-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors">
          Limpiar
        </button>
        <button onClick={onOpen} disabled={terms.length < 2}
          className="text-[12px] font-medium px-3 py-1.5 rounded-lg bg-slate-100 text-slate-900 hover:bg-white disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5">
          <CompareIcon />
          Comparar {terms.length >= 2 ? `(${terms.length})` : ""}
        </button>
      </div>
    </div>
  );
}

// ─── CompareView ───────────────────────────────────────────────────────────────
function CompareView({ terms, onClose, onRemove, onOpenTerm }: {
  terms: LocalTerm[]; onClose: () => void;
  onRemove: (id: number) => void; onOpenTerm: (id: number) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (terms.length === 0) return null;
  const n = terms.length;
  const pad = "px-5 py-4";

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between px-8 py-4 border-b border-slate-900 shrink-0">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-600">Comparar términos</p>
          <h2 className="text-xl font-semibold text-slate-100">{terms.map(t => t.term).join("  ·  ")}</h2>
        </div>
        <button onClick={onClose}
          className="text-[12px] flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-100 transition-colors">
          <CloseIcon /> <span>Cerrar (Esc)</span>
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="grid gap-px bg-slate-900 min-h-full"
          style={{ gridTemplateColumns: `repeat(${n}, minmax(0,1fr))` }}>
          {terms.map(t => (
            <div key={`h-${t.id}`} className="bg-slate-950 relative">
              <div className="absolute top-0 left-0 right-0 h-1" style={{ background: catColor(t.category, 70) }} />
              <div className={`${pad} pt-6`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{ background: catSoft(t.category, 0.45), color: catColor(t.category, 82) }}>
                        {t.category}
                      </span>
                      {t.ticker && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/50">
                          {t.ticker}
                        </span>
                      )}
                    </div>
                    <button onClick={() => { onClose(); onOpenTerm(t.id); }}
                      className="text-xl font-semibold text-slate-100 hover:underline decoration-dotted text-left">
                      {t.term}
                    </button>
                  </div>
                  <button onClick={() => onRemove(t.id)}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-950/30 transition-colors shrink-0">
                    <CloseIcon />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {(["Definición", "Detalle", "Ejemplo"] as const).map(section => (
            <>
              <div key={`lbl-${section}`} className="bg-slate-900/80 px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500"
                style={{ gridColumn: `span ${n}` }}>{section}</div>
              {terms.map(t => {
                const content =
                  section === "Definición" ? t.short_def
                  : section === "Detalle" ? t.detail
                  : t.example;
                return (
                  <div key={`${section}-${t.id}`} className={`bg-slate-950 ${pad}`}>
                    {content
                      ? section === "Ejemplo"
                        ? <div className="rounded-lg px-3 py-2 border-l-2 text-[13px] text-slate-300 leading-relaxed italic"
                            style={{ background: catSoft(t.category, 0.15), borderColor: catColor(t.category, 60) }}>
                            {content}
                          </div>
                        : <p className={`leading-relaxed ${section === "Definición" ? "text-[14px] text-slate-200" : "text-[13px] text-slate-400"}`}>{content}</p>
                      : <span className="text-[12px] text-slate-700 italic">—</span>}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── AddTermModal ──────────────────────────────────────────────────────────────
function AddTermModal({ onClose, onAdded }: {
  onClose: () => void; onAdded: (term: LocalTerm) => void;
}) {
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const [termType, setTermType] = useState<TermType>("concepto");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("term_type", termType);
    startTransition(async () => {
      const result = await createGlossaryTerm(formData);
      if (result) { onAdded({ ...result, fav: false }); onClose(); }
    });
  };

  const inp = "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[13px] text-slate-100 placeholder-slate-600 outline-none focus:border-slate-500 transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg mx-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 rounded-t-2xl">
          <h2 className="text-[15px] font-semibold text-slate-100">Nuevo término</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors"><CloseIcon /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-slate-600 mb-1.5">Término *</label>
              <input name="term" required placeholder="p.ej. Duration" className={inp} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-slate-600 mb-1.5">Categoría *</label>
              <select name="category" required className={`${inp} cursor-pointer`} defaultValue={GLOSSARY_CATEGORIES[0]}>
                {GLOSSARY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-slate-600 mb-1.5">Tipo</label>
            <div className="flex gap-2">
              {(["concepto", "instrumento", "metrica"] as TermType[]).map(t => (
                <button key={t} type="button" onClick={() => setTermType(t)}
                  className={`flex-1 py-1.5 rounded-md text-[11px] font-medium border transition-colors ${
                    termType === t ? "bg-slate-700 border-slate-600 text-slate-100" : "border-slate-800 text-slate-500 hover:text-slate-300"
                  }`}>
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-slate-600 mb-1.5">Definición corta *</label>
            <textarea name="short_def" required rows={2} placeholder="Una frase que explique el concepto" className={`${inp} resize-none`} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-slate-600 mb-1.5">Detalle *</label>
            <textarea name="detail" required rows={3} placeholder="Explicación más extensa" className={`${inp} resize-none`} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-slate-600 mb-1.5">Ejemplo *</label>
            <textarea name="example" required rows={2} placeholder="Un caso práctico" className={`${inp} resize-none`} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-slate-600 mb-1.5">
              Ticker <span className="normal-case tracking-normal text-slate-700">(opcional)</span>
            </label>
            <input name="ticker" placeholder="p.ej. SPY, GD30, AAPL" className={`${inp} font-mono`} />
          </div>
          {termType === "metrica" && (
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-slate-600 mb-1.5">
                Fórmula LaTeX <span className="normal-case tracking-normal text-slate-700">(opcional)</span>
              </label>
              <input name="formula" placeholder='\beta = \frac{Cov(r_i, r_m)}{Var(r_m)}' className={`${inp} font-mono text-[12px]`} />
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg text-[13px] text-slate-400 border border-slate-700 hover:border-slate-600 hover:text-slate-300 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 px-4 py-2 rounded-lg text-[13px] font-medium text-slate-900 bg-slate-100 hover:bg-white transition-colors disabled:opacity-50">
              {isPending ? "Guardando…" : "Agregar término"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── GlossaryClient ────────────────────────────────────────────────────────────
interface Props { terms: GlossaryTerm[]; categories: string[]; }

export default function GlossaryClient({ terms: initialTerms }: Props) {
  const [localTerms, setLocalTerms] = useState<LocalTerm[]>(() =>
    initialTerms.map(t => ({ ...t, fav: false }))
  );

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("glossary-favs") ?? "[]") as number[];
      if (stored.length > 0)
        setLocalTerms(prev => prev.map(t => ({ ...t, fav: stored.includes(t.id) })));
    } catch { /* ignore */ }
  }, []);

  const [query,       setQuery]       = useState("");
  const [activeCat,   setActiveCat]   = useState("all");
  const [sort,        setSort]        = useState("alpha");
  const [group,       setGroup]       = useState(true);
  const [density,     setDensity]     = useState("comfy");
  const [view,        setView]        = useState("grid");
  const [selectedId,  setSelectedId]  = useState<number | null>(null);
  const [compareIds,  setCompareIds]  = useState<number[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [showAdd,     setShowAdd]     = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();
  const COMPARE_MAX = 3;

  const saveFavs = useCallback((terms: LocalTerm[]) => {
    try { localStorage.setItem("glossary-favs", JSON.stringify(terms.filter(t => t.fav).map(t => t.id))); }
    catch { /* ignore */ }
  }, []);

  const toggleFav = useCallback((id: number) => {
    setLocalTerms(prev => { const next = prev.map(t => t.id === id ? { ...t, fav: !t.fav } : t); saveFavs(next); return next; });
  }, [saveFavs]);

  const updateTerm = useCallback((id: number, patch: Partial<LocalTerm>) => {
    setLocalTerms(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }, []);

  const deleteTerm = useCallback((id: number) => {
    setLocalTerms(prev => prev.filter(t => t.id !== id));
    setCompareIds(prev => prev.filter(x => x !== id));
    startTransition(async () => { await deleteGlossaryTerm(id); });
  }, []);

  const handleTermAdded = useCallback((term: LocalTerm) => {
    setLocalTerms(prev => [term, ...prev]);
    setSelectedId(term.id);
  }, []);

  const toggleCompare = useCallback((id: number) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= COMPARE_MAX) return prev;
      return [...prev, id];
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField = ["INPUT", "TEXTAREA"].includes((document.activeElement as HTMLElement)?.tagName ?? "");
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); return;
      }
      if (e.key === "/" && !inField) { e.preventDefault(); searchRef.current?.focus(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "n") { e.preventDefault(); setShowAdd(true); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Derived
  const catCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of localTerms) m[t.category] = (m[t.category] ?? 0) + 1;
    return m;
  }, [localTerms]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = localTerms.filter(t => activeCat === "all" || t.category === activeCat);
    if (q) list = list.filter(t =>
      t.term.toLowerCase().includes(q) ||
      t.short_def.toLowerCase().includes(q) ||
      t.detail.toLowerCase().includes(q) ||
      (t.ticker?.toLowerCase().includes(q) ?? false)
    );
    if (sort === "alpha")    list = [...list].sort((a, b) => a.term.localeCompare(b.term, "es"));
    if (sort === "category") list = [...list].sort((a, b) => a.category.localeCompare(b.category) || a.term.localeCompare(b.term));
    if (sort === "recent")   list = [...list].sort((a, b) => b.id - a.id);
    return list;
  }, [localTerms, query, activeCat, sort]);

  const favorites = useMemo(() => localTerms.filter(t => t.fav), [localTerms]);

  const grouped = useMemo(() => {
    if (!group || view === "list" || activeCat !== "all" || sort === "recent") return null;
    if (sort === "alpha") {
      const map = new Map<string, LocalTerm[]>();
      for (const t of filtered) {
        const k = (t.term[0] ?? "").toUpperCase();
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(t);
      }
      return Array.from(map.entries()).map(([k, items]) => ({ key: k, label: k, items }));
    }
    return Object.keys(CATS)
      .map(k => ({ key: k, label: k, items: filtered.filter(t => t.category === k) }))
      .filter(g => g.items.length > 0);
  }, [filtered, group, activeCat, sort, view]);

  const availableLetters = useMemo(() =>
    new Set(filtered.map(t => (t.term[0] ?? "").toUpperCase())), [filtered]);

  const selected      = localTerms.find(t => t.id === selectedId) ?? null;
  const comparedTerms = useMemo(() =>
    compareIds.map(id => localTerms.find(t => t.id === id)).filter((t): t is LocalTerm => t !== undefined),
    [compareIds, localTerms]);

  const gap       = density === "compact" ? "gap-2" : "gap-3";
  const gridClass = `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 ${gap}`;
  const showFavStrip = favorites.length > 0 && query === "" && activeCat === "all";

  const renderItems = (items: LocalTerm[]) => view === "list"
    ? <ListView terms={items} onOpen={setSelectedId} onToggleFav={toggleFav}
        onToggleCompare={toggleCompare} selectedId={selectedId} compareIds={compareIds} />
    : (
      <div className={gridClass}>
        {items.map(t => (
          <TermCard key={t.id} term={t} onClick={() => setSelectedId(t.id)}
            onToggleFav={toggleFav} onToggleCompare={toggleCompare}
            isSelected={selectedId === t.id} isCompared={compareIds.includes(t.id)} />
        ))}
      </div>
    );

  return (
    <>
    <div className="fade-up fade-up-2">
      {/* Search + new */}
      <div className="flex items-center gap-4 mb-5">
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"><SearchIcon /></div>
          <input ref={searchRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar término, definición o ticker…"
            className="w-full bg-slate-900/60 border border-slate-800 focus:border-slate-600 rounded-lg pl-9 pr-12 py-1.5 text-[13px] text-slate-200 placeholder-slate-600 outline-none transition-colors" />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 bg-slate-800/80 border border-slate-700 rounded px-1 py-0.5 font-mono">⌘K</kbd>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-[12px] font-medium text-slate-200 transition-colors whitespace-nowrap">
          <PlusIcon /> Nuevo término
        </button>
      </div>

      {/* Category chips */}
      <div className="mb-5">
        <CategoryChips active={activeCat} setActive={setActiveCat} counts={catCounts} total={localTerms.length} />
      </div>

      {/* Favorites strip */}
      {showFavStrip && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2.5">
            <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.48 3.5l2.5 5.1 5.6.8-4.05 3.95.95 5.55-5-2.63-5 2.63.95-5.55L3.4 9.4l5.6-.8 2.48-5.1z" />
            </svg>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-amber-400/90">Favoritos</h2>
            <div className="flex-1 h-px bg-slate-900" />
          </div>
          <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 ${gap}`}>
            {favorites.slice(0, 3).map(t => (
              <TermCard key={t.id} term={t} onClick={() => setSelectedId(t.id)}
                onToggleFav={toggleFav} onToggleCompare={toggleCompare}
                isSelected={selectedId === t.id} isCompared={compareIds.includes(t.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <Toolbar sort={sort} setSort={setSort} group={group} setGroup={setGroup}
        count={filtered.length} density={density} setDensity={setDensity} view={view} setView={setView} />

      {/* Main grid + rail */}
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          {grouped ? (
            <>
              {grouped.map(g => (
                <div key={g.key} data-section-key={g.key} className="mb-7 scroll-mt-20">
                  <SectionHeader label={g.label} count={g.items.length} />
                  {renderItems(g.items)}
                </div>
              ))}
              {view === "grid" && <div className={gridClass}><AddCard onClick={() => setShowAdd(true)} /></div>}
            </>
          ) : (
            <>
              {renderItems(filtered)}
              {view === "grid" && <div className={`${gridClass} mt-3`}><AddCard onClick={() => setShowAdd(true)} /></div>}
            </>
          )}

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <p className="text-slate-500 text-sm">Sin resultados para &ldquo;{query}&rdquo;</p>
              <button onClick={() => { setQuery(""); setActiveCat("all"); }}
                className="text-[12px] text-slate-400 hover:text-slate-200 mt-2 block mx-auto">
                Limpiar filtros
              </button>
            </div>
          )}

        </div>

        <AlphaRail available={availableLetters} onJump={l => {
          const el = document.querySelector(`[data-section-key="${l}"]`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }} />
      </div>

      <div className="mt-10 pt-4 border-t border-slate-900 flex items-center gap-4 text-[10px] text-slate-700 font-mono flex-wrap">
        {([["⌘K", "buscar"], ["⌘N", "nuevo"], ["Esc", "cerrar"]] as [string, string][]).map(([k, l]) => (
          <span key={k} className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-slate-400 text-[9px]">{k}</kbd>
            <span>{l}</span>
          </span>
        ))}
      </div>
    </div>

    {/* fixed portals — outside the fade-up div to avoid transform containing-block bug */}
    <Drawer term={selected} allTerms={localTerms} onClose={() => setSelectedId(null)}
      onToggleFav={toggleFav} onDelete={deleteTerm} onUpdate={updateTerm}
      onOpenTerm={setSelectedId} onAddToCompare={toggleCompare}
      isInCompare={selected ? compareIds.includes(selected.id) : false} />

    {showCompare && comparedTerms.length >= 2 && (
      <CompareView terms={comparedTerms} onClose={() => setShowCompare(false)}
        onRemove={id => {
          const next = compareIds.filter(x => x !== id);
          setCompareIds(next);
          if (next.length < 2) setShowCompare(false);
        }}
        onOpenTerm={id => { setShowCompare(false); setSelectedId(id); }} />
    )}

    <CompareBar terms={comparedTerms}
      onRemove={id => setCompareIds(prev => prev.filter(x => x !== id))}
      onClear={() => setCompareIds([])}
      onOpen={() => setShowCompare(true)}
      max={COMPARE_MAX} />

    {showAdd && <AddTermModal onClose={() => setShowAdd(false)} onAdded={handleTermAdded} />}
    </>
  );
}
