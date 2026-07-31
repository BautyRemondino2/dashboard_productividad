"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getCommandPaletteData, type CommandPaletteItem } from "@/app/actions";

type Group = { label: string; key: string; items: CommandPaletteItem[] };

function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  // Subsequence match — chars in order, but not necessarily contiguous
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

function fuzzyScore(query: string, text: string): number {
  if (!query) return 100;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t === q) return 1000;
  if (t.startsWith(q)) return 500;
  if (t.includes(q)) return 200;
  return 50;
}

const NAV_COMMANDS: CommandPaletteItem[] = [
  { type: "nav", id: -1, label: "Ir a Mercado",    subtitle: "Panel del día", href: "/mercado" },
  { type: "nav", id: -2, label: "Ir a Glosario",   subtitle: "Términos financieros", href: "/glossary" },
  { type: "nav", id: -3, label: "Ir a Efemérides", subtitle: "Feriados y fechas", href: "/efemerides" },
];

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof getCommandPaletteData>> | null>(null);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Open with ⌘K (or Ctrl+K)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen(o => !o);
        return;
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        return;
      }
      // Quick open with just `/` from anywhere
      if (e.key === "/" && !inField && !open) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);

  // Load data lazily on first open
  useEffect(() => {
    if (open && !loaded) {
      getCommandPaletteData().then(d => { setData(d); setLoaded(true); });
    }
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveIdx(0);
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, loaded]);

  // Filtered + grouped items
  const groups: Group[] = useMemo(() => {
    const filter = (items: CommandPaletteItem[]) =>
      items
        .filter(i => fuzzyMatch(query, `${i.label} ${i.subtitle ?? ""}`))
        .sort((a, b) => fuzzyScore(query, b.label) - fuzzyScore(query, a.label));

    const out: Group[] = [
      { label: "Navegación",   key: "nav",         items: filter(NAV_COMMANDS).slice(0, 8) },
      { label: "Instrumentos", key: "instrumento", items: filter(data?.instrumentos ?? []).slice(0, 12) },
      { label: "Glosario",     key: "glossary",    items: filter(data?.glossary ?? []).slice(0, 15) },
    ];
    return out.filter(g => g.items.length > 0);
  }, [data, query]);

  // Flat list (used for arrow nav)
  const flat: CommandPaletteItem[] = useMemo(() => groups.flatMap(g => g.items), [groups]);

  // Reset active idx when filtered list changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIdx(0);
  }, [query, loaded]);

  // Scroll active into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${activeIdx}"]`);
    if (el && "scrollIntoView" in el) (el as HTMLElement).scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const close = useCallback(() => setOpen(false), []);

  const activate = useCallback((item: CommandPaletteItem) => {
    if (item.type === "glossary") {
      // For glossary terms, scroll to the term on the glossary page using a hash
      router.push(`/glossary#term-${item.id}`);
      close();
      return;
    }
    if (item.href) {
      router.push(item.href);
      close();
    }
  }, [router, close]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flat[activeIdx];
      if (item) activate(item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  if (!open) return null;

  let idxCursor = -1;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={close} />
      <div className="relative z-10 w-full max-w-xl mx-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[70vh]">
        {/* Input */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-3">
          <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Buscar instrumentos, términos del glosario…"
            className="flex-1 bg-transparent text-[14px] text-slate-100 placeholder-slate-600 outline-none"
          />
          <kbd className="text-[10px] text-slate-500 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 font-mono">esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto py-1">
          {!loaded && (
            <div className="px-4 py-8 text-center text-[12px] text-slate-500">Cargando…</div>
          )}
          {loaded && flat.length === 0 && (
            <div className="px-4 py-8 text-center text-[12px] text-slate-500">
              Sin resultados para <span className="text-slate-300">&ldquo;{query}&rdquo;</span>
            </div>
          )}
          {loaded && groups.map(g => (
            <div key={g.key} className="py-1">
              <div className="px-4 pt-2 pb-1 text-[9px] font-semibold uppercase tracking-widest text-slate-600">
                {g.label}
              </div>
              {g.items.map(item => {
                idxCursor++;
                const isActive = idxCursor === activeIdx;
                const myIdx = idxCursor;
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    data-idx={myIdx}
                    onMouseEnter={() => setActiveIdx(myIdx)}
                    onClick={() => activate(item)}
                    className={`w-full text-left px-4 py-1.5 flex items-center gap-3 transition-colors ${
                      isActive ? "bg-slate-800" : "hover:bg-slate-800/60"
                    }`}
                  >
                    <ItemIcon item={item} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] truncate ${isActive ? "text-slate-100" : "text-slate-200"}`}>
                        {item.label}
                      </p>
                      {item.subtitle && (
                        <p className="text-[10px] text-slate-500 truncate">{item.subtitle}</p>
                      )}
                    </div>
                    {item.href && (
                      <svg className="w-3 h-3 text-slate-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-600">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono">↑</kbd>
              <kbd className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono">↓</kbd>
              navegar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono">↵</kbd>
              abrir
            </span>
          </div>
          <span>
            <kbd className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono">⌘K</kbd>
            {" "}para abrir
          </span>
        </div>
      </div>
    </div>
  );
}

function ItemIcon({ item }: { item: CommandPaletteItem }) {
  const ICONS: Record<CommandPaletteItem["type"], string> = {
    nav:         "◆",
    instrumento: "◈",
    glossary:    "◉",
  };
  const colors: Record<CommandPaletteItem["type"], string> = {
    nav:         "text-slate-300",
    instrumento: "text-sky-400",
    glossary:    "text-emerald-400",
  };
  return (
    <span
      className={`w-6 h-6 rounded flex items-center justify-center text-[14px] shrink-0 bg-slate-800/60 ${colors[item.type]}`}
      title={item.type}
    >
      {ICONS[item.type]}
    </span>
  );
}
