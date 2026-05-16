"use client";

import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useTransition,
  useCallback,
} from "react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";
import type { GlossaryTerm } from "@/lib/glossary";
import { GLOSSARY_CATEGORIES } from "@/lib/glossary";
import {
  updateGlossaryTerm,
  createGlossaryTerm,
  deleteGlossaryTerm,
} from "@/app/actions";

// ─── Category colors ──────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  "Renta Fija":      { text: "text-cyan-300",    bg: "bg-cyan-950/50",    border: "border-cyan-800/50" },
  "Renta Variable":  { text: "text-emerald-300",  bg: "bg-emerald-950/50", border: "border-emerald-800/50" },
  "Derivados":       { text: "text-purple-300",   bg: "bg-purple-950/50",  border: "border-purple-800/50" },
  "Tasas & Curvas":  { text: "text-amber-300",    bg: "bg-amber-950/50",   border: "border-amber-800/50" },
  "Instrumentos AR": { text: "text-rose-300",     bg: "bg-rose-950/50",    border: "border-rose-800/50" },
  "Macro Argentina": { text: "text-orange-300",   bg: "bg-orange-950/50",  border: "border-orange-800/50" },
};

const CAT_ACCENT: Record<string, string> = {
  "Renta Fija":      "oklch(65% 0.12 200)",
  "Renta Variable":  "oklch(65% 0.12 160)",
  "Derivados":       "oklch(65% 0.12 280)",
  "Tasas & Curvas":  "oklch(65% 0.12 60)",
  "Instrumentos AR": "oklch(65% 0.12 340)",
  "Macro Argentina": "oklch(65% 0.12 30)",
};

// ─── Price widget ─────────────────────────────────────────────────────────────

interface PriceData {
  price: number | null;
  change: number | null;
  changePct: number | null;
  currency: string;
  name: string;
}

interface HistoryPoint {
  date: string;
  close: number | null;
}

function PriceWidget({ ticker }: { ticker: string }) {
  const [price, setPrice] = useState<PriceData | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/glossary/price?ticker=${encodeURIComponent(ticker)}`).then(
        (r) => (r.ok ? r.json() : Promise.reject(r.statusText))
      ),
      fetch(`/api/glossary/history?ticker=${encodeURIComponent(ticker)}`).then(
        (r) => (r.ok ? r.json() : Promise.reject(r.statusText))
      ),
    ])
      .then(([p, h]: [PriceData, { data: HistoryPoint[] }]) => {
        if (!cancelled) {
          setPrice(p);
          setHistory(h.data ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("No se pudo cargar el precio");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ticker]);

  if (loading) {
    return (
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4 flex items-center gap-3">
        <div className="w-4 h-4 rounded-full border-2 border-slate-700 border-t-slate-400 animate-spin" />
        <span className="text-[12px] text-slate-500">Cargando precio de {ticker}…</span>
      </div>
    );
  }

  if (error || !price) {
    return (
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <p className="text-[11px] text-slate-600">{error ?? "Sin datos de precio"}</p>
      </div>
    );
  }

  const positive = (price.changePct ?? 0) >= 0;
  const changeColor = positive ? "text-emerald-400" : "text-red-400";
  const chartColor = positive ? "#34d399" : "#f87171";
  const chartData = history.map((d) => ({ date: d.date, v: d.close }));

  return (
    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-0.5">{ticker}</p>
          <p className="text-[11px] text-slate-400 truncate max-w-[220px]">{price.name}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold tabular text-slate-100">
            {price.price !== null
              ? `${price.currency === "ARS" ? "$" : "USD "}${price.price.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : "—"}
          </p>
          <p className={`text-[12px] tabular font-medium ${changeColor}`}>
            {price.changePct !== null
              ? `${positive ? "+" : ""}${price.changePct.toFixed(2)}%`
              : "—"}
          </p>
        </div>
      </div>

      {chartData.length > 1 && (
        <div className="h-16">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis domain={["auto", "auto"]} hide />
              <Tooltip
                contentStyle={{
                  background: "rgb(15,23,42)",
                  border: "1px solid rgb(30,41,59)",
                  borderRadius: "8px",
                  fontSize: "11px",
                  color: "rgb(226,232,240)",
                }}
                labelStyle={{ color: "rgb(100,116,139)", fontSize: "10px" }}
                formatter={(v) => [typeof v === "number" ? v.toFixed(2) : String(v ?? ""), "Precio"]}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke={chartColor}
                strokeWidth={1.5}
                fill={`url(#grad-${ticker})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="text-[9px] text-slate-700">Fuente: Yahoo Finance · {ticker} · última sesión</p>
    </div>
  );
}

// ─── Editable field ───────────────────────────────────────────────────────────

function EditableField({
  value,
  onSave,
  multiline = false,
  allowEmpty = false,
  placeholder = "Vacío",
  className = "",
}: {
  value: string;
  onSave: (v: string) => void;
  multiline?: boolean;
  allowEmpty?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync if parent value changes (e.g. after server roundtrip)
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = useCallback(() => {
    setEditing(false);
    const trimmed = draft.trim();
    const prev = value.trim();
    if (trimmed === prev) return;
    if (!trimmed && !allowEmpty) return; // discard clearing mandatory fields
    onSave(trimmed);
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2000);
  }, [draft, value, onSave, allowEmpty]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setDraft(value);
      setEditing(false);
    }
    if (!multiline && e.key === "Enter") {
      e.preventDefault();
      commit();
    }
    if (multiline && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
    }
  };

  if (editing) {
    const sharedClass = `w-full bg-slate-800/80 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-slate-500 transition-colors ${className}`;

    if (multiline) {
      return (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          rows={3}
          className={`${sharedClass} resize-none`}
        />
      );
    }
    return (
      <input
        autoFocus
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className={sharedClass}
      />
    );
  }

  return (
    <span
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className={`relative cursor-text rounded px-1 -mx-1 hover:bg-slate-800/40 transition-colors group inline-block w-full ${className}`}
      title="Clic para editar"
    >
      {value || (
        <span className="text-slate-600 italic text-[12px]">{placeholder}</span>
      )}
      <span className="inline-block ml-1 opacity-0 group-hover:opacity-50 text-slate-500 text-[10px] transition-opacity select-none">
        ✎
      </span>
      {saved && (
        <span className="absolute -top-5 right-0 text-[10px] text-emerald-400 font-medium whitespace-nowrap pointer-events-none">
          ✓ Guardado
        </span>
      )}
    </span>
  );
}

// ─── Add term modal ───────────────────────────────────────────────────────────

function AddTermModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (term: GlossaryTerm) => void;
}) {
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createGlossaryTerm(formData);
      if (result) {
        onAdded(result);
        onClose();
      }
    });
  };

  const inputClass =
    "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[13px] text-slate-100 placeholder-slate-600 outline-none focus:border-slate-500 transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal card */}
      <div className="relative z-10 w-full max-w-lg mx-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 rounded-t-2xl">
          <h2 className="text-[15px] font-semibold text-slate-100">
            Nuevo término
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-slate-600 mb-1.5">
                Término *
              </label>
              <input
                name="term"
                required
                placeholder="p.ej. Duration"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-slate-600 mb-1.5">
                Categoría *
              </label>
              <select
                name="category"
                required
                className={`${inputClass} cursor-pointer`}
                defaultValue={GLOSSARY_CATEGORIES[0]}
              >
                {GLOSSARY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-slate-600 mb-1.5">
              Definición corta *
            </label>
            <textarea
              name="short_def"
              required
              rows={2}
              placeholder="Una frase que explique el concepto"
              className={`${inputClass} resize-none`}
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-slate-600 mb-1.5">
              Detalle *
            </label>
            <textarea
              name="detail"
              required
              rows={3}
              placeholder="Explicación más extensa del concepto"
              className={`${inputClass} resize-none`}
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-slate-600 mb-1.5">
              Ejemplo *
            </label>
            <textarea
              name="example"
              required
              rows={2}
              placeholder="Un caso práctico"
              className={`${inputClass} resize-none`}
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-slate-600 mb-1.5">
              Ticker{" "}
              <span className="normal-case tracking-normal text-slate-700">
                (opcional)
              </span>
            </label>
            <input
              name="ticker"
              placeholder="p.ej. SPY, GD30, AAPL"
              className={`${inputClass} font-mono`}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg text-[13px] text-slate-400 border border-slate-700 hover:border-slate-600 hover:text-slate-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2 rounded-lg text-[13px] font-medium text-slate-900 bg-slate-100 hover:bg-white transition-colors disabled:opacity-50"
            >
              {isPending ? "Guardando…" : "Agregar término"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Term card ────────────────────────────────────────────────────────────────

function TermCard({
  term: initialTerm,
  onDelete,
}: {
  term: GlossaryTerm;
  onDelete: (id: number) => void;
}) {
  const [term, setTerm] = useState(initialTerm);
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, startTransition] = useTransition();

  const colors = CAT_COLORS[term.category] ?? CAT_COLORS["Renta Fija"];
  const accent = CAT_ACCENT[term.category] ?? "oklch(65% 0.10 220)";

  const save = useCallback(
    (field: string) => (value: string) => {
      // ticker: uppercase and convert empty to null; other fields: keep as-is
      const val =
        field === "ticker" ? value.toUpperCase() || null : value || null;
      setTerm((prev) => ({ ...prev, [field]: val } as GlossaryTerm));
      startTransition(async () => {
        await updateGlossaryTerm(term.id, field, val);
      });
    },
    [term.id]
  );

  return (
    <div
      className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden transition-all hover:border-slate-700"
      style={
        expanded ? { borderTopColor: accent, borderTopWidth: 2 } : undefined
      }
    >
      {/* Header — click to toggle */}
      <button
        className="w-full text-left px-5 py-4 flex items-start gap-4"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h3 className="text-[14px] font-semibold text-slate-100 leading-tight">
              {term.term}
            </h3>
            {term.ticker && (
              <span className="text-[9px] font-mono tabular text-slate-500 bg-slate-800/80 px-1.5 py-0.5 rounded">
                {term.ticker}
              </span>
            )}
          </div>
          <span
            className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-md border ${colors.text} ${colors.bg} ${colors.border} mb-2`}
          >
            {term.category}
          </span>
          <p className="text-[12px] text-slate-400 leading-relaxed line-clamp-2">
            {term.short_def}
          </p>
        </div>
        <span
          className="shrink-0 mt-1 text-slate-600 text-[11px] transition-transform duration-200"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▾
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-800/60">
          <div className="pt-4 space-y-4">
            {/* Hint */}
            <p className="text-[10px] text-slate-700 italic">
              Clic en cualquier texto para editar · Enter (o ⌘+Enter en bloques) para guardar · Esc para cancelar
            </p>

            {/* Term name */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-1.5">
                Término
              </p>
              <EditableField
                value={term.term}
                onSave={save("term")}
                className="text-[14px] font-semibold text-slate-100"
              />
            </div>

            {/* Short def */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-1.5">
                Definición corta
              </p>
              <EditableField
                value={term.short_def}
                onSave={save("short_def")}
                multiline
                className="text-[13px] text-slate-300 leading-relaxed"
              />
            </div>

            {/* Detail */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-1.5">
                Detalle
              </p>
              <EditableField
                value={term.detail}
                onSave={save("detail")}
                multiline
                className="text-[13px] text-slate-300 leading-relaxed"
              />
            </div>

            {/* Example */}
            <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-1.5">
                Ejemplo
              </p>
              <EditableField
                value={term.example}
                onSave={save("example")}
                multiline
                className="text-[12px] text-slate-300 leading-relaxed italic"
              />
            </div>

            {/* Ticker */}
            <div className="flex items-baseline gap-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-600 shrink-0">
                Ticker
              </p>
              <EditableField
                value={term.ticker ?? ""}
                onSave={save("ticker")}
                allowEmpty
                placeholder="Sin ticker — clic para agregar"
                className="text-[12px] font-mono text-slate-400"
              />
            </div>

            {/* Price widget (live) */}
            {term.ticker && <PriceWidget ticker={term.ticker} />}

            {/* Delete */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800/60">
              {confirmDelete ? (
                <>
                  <span className="text-[11px] text-slate-500">
                    ¿Eliminar &quot;{term.term}&quot;?
                  </span>
                  <button
                    onClick={() => onDelete(term.id)}
                    className="text-[11px] text-red-400 hover:text-red-300 font-medium transition-colors"
                  >
                    Sí, eliminar
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-[11px] text-slate-700 hover:text-red-400 transition-colors"
                >
                  Eliminar término
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main client ──────────────────────────────────────────────────────────────

interface Props {
  terms: GlossaryTerm[];
  categories: string[];
}

export default function GlossaryClient({ terms: initialTerms, categories }: Props) {
  const [localTerms, setLocalTerms] = useState<GlossaryTerm[]>(initialTerms);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Todas");
  const [showAddModal, setShowAddModal] = useState(false);
  const [, startTransition] = useTransition();

  const handleTermAdded = useCallback((term: GlossaryTerm) => {
    setLocalTerms((prev) => [...prev, term]);
  }, []);

  const handleTermDeleted = useCallback((id: number) => {
    setLocalTerms((prev) => prev.filter((t) => t.id !== id));
    startTransition(async () => {
      await deleteGlossaryTerm(id);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return localTerms.filter((t) => {
      const matchCat =
        activeCategory === "Todas" || t.category === activeCategory;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        t.term.toLowerCase().includes(q) ||
        t.short_def.toLowerCase().includes(q) ||
        t.detail.toLowerCase().includes(q)
      );
    });
  }, [localTerms, search, activeCategory]);

  const catCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of localTerms) {
      map[t.category] = (map[t.category] ?? 0) + 1;
    }
    return map;
  }, [localTerms]);

  const allCategories = ["Todas", ...categories];

  return (
    <div className="fade-up fade-up-2">
      {/* Top bar: search + add button */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
            ⌕
          </span>
          <input
            type="text"
            placeholder="Buscar término, definición…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-[13px] text-slate-100 placeholder-slate-600 outline-none focus:border-slate-600 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors"
        >
          <span className="text-[14px] leading-none">+</span>
          Nuevo término
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-thin">
        {allCategories.map((cat) => {
          const active = activeCategory === cat;
          const colors = cat !== "Todas" ? CAT_COLORS[cat] : null;
          const count = cat === "Todas" ? localTerms.length : catCounts[cat] ?? 0;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
                active
                  ? colors
                    ? `${colors.text} ${colors.bg} ${colors.border}`
                    : "bg-slate-800 text-slate-100 border-slate-700"
                  : "text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-700"
              }`}
            >
              {cat}
              <span
                className={`text-[10px] tabular px-1.5 py-0.5 rounded-md ${
                  active ? "bg-black/20" : "bg-slate-800"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Results count */}
      <p className="text-[11px] text-slate-600 mb-4">
        {filtered.length === localTerms.length
          ? `${localTerms.length} términos`
          : `${filtered.length} de ${localTerms.length} términos`}
        {search && ` · "${search}"`}
      </p>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-slate-500 text-sm">
            Sin resultados para{" "}
            <span className="text-slate-300">&ldquo;{search}&rdquo;</span>
          </p>
          <button
            onClick={() => {
              setSearch("");
              setActiveCategory("Todas");
            }}
            className="mt-3 text-[12px] text-slate-600 hover:text-slate-400 transition-colors"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((term) => (
            <TermCard
              key={term.id}
              term={term}
              onDelete={handleTermDeleted}
            />
          ))}
        </div>
      )}

      {/* Add term modal */}
      {showAddModal && (
        <AddTermModal
          onClose={() => setShowAddModal(false)}
          onAdded={handleTermAdded}
        />
      )}
    </div>
  );
}
