"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SHORTCUTS = [
  { key: "1", label: "Hoy",           href: "/today"     },
  { key: "2", label: "Hábitos",        href: "/habitos"   },
  { key: "3", label: "Facultad",       href: "/facultad"  },
  { key: "4", label: "Exámenes",       href: "/examenes"  },
  { key: "5", label: "Estadísticas",   href: "/stats"     },
  { key: "6", label: "Historial",      href: "/historial" },
  { key: "?", label: "Ayuda",          href: null         },
];

export default function KeyboardShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(h => !h);
        return;
      }
      if (e.key === "Escape") {
        setHelpOpen(false);
        return;
      }

      const sc = SHORTCUTS.find(s => s.key === e.key && s.href);
      if (sc?.href) {
        e.preventDefault();
        router.push(sc.href);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  if (!helpOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm"
      onClick={() => setHelpOpen(false)}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-80 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-slate-200">Atajos de teclado</h2>
          <button onClick={() => setHelpOpen(false)} className="text-slate-600 hover:text-slate-400 text-xs">✕</button>
        </div>
        <div className="space-y-2">
          {SHORTCUTS.map(sc => (
            <div key={sc.key} className="flex items-center justify-between">
              <span className="text-sm text-slate-400">{sc.label}</span>
              <kbd className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 font-mono">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-700 mt-4 text-center">Presioná Esc para cerrar</p>
      </div>
    </div>
  );
}
