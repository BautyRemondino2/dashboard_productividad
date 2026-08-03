"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { hrefGlosario, type InstrumentoDef } from "@/lib/glosario-instrumentos";

const ANCHO = 300;

/**
 * "?" al lado del ticker: abre la definición corta del glosario sin sacar al
 * usuario del panel, con el link al término completo. La tarjeta que lo contiene
 * es clickeable (abre el gráfico), así que todos los eventos se cortan acá.
 */
export default function DefinicionPopover({ def, nombre }: { def: InstrumentoDef; nombre: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Posición fija calculada del botón: el popover vive fuera del flujo de la tarjeta
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.left - ANCHO / 2 + r.width / 2), window.innerWidth - ANCHO - 8);
    const abajo = r.bottom + 8;
    // Si no entra abajo, se abre para arriba
    const top = abajo + 190 > window.innerHeight ? Math.max(8, r.top - 8 - 190) : abajo;
    setPos({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const cerrar = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      if (btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    window.addEventListener("mousedown", cerrar);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", () => setOpen(false), { once: true, capture: true });
    return () => {
      window.removeEventListener("mousedown", cerrar);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        onKeyDown={(e) => e.stopPropagation()}
        title={`Qué es ${nombre}`}
        aria-label={`Definición de ${nombre}`}
        aria-expanded={open}
        className={`shrink-0 w-4 h-4 rounded-full border text-[9px] leading-none flex items-center justify-center transition-colors ${
          open
            ? "border-slate-500 text-slate-200 bg-slate-800"
            : "border-slate-700 text-slate-600 hover:border-slate-500 hover:text-slate-300"
        }`}
      >
        ?
      </button>

      {open && pos && (
        <div
          ref={popRef}
          onClick={(e) => e.stopPropagation()}
          style={{ top: pos.top, left: pos.left, width: ANCHO }}
          className="fixed z-[80] rounded-xl border border-slate-700 bg-slate-900 shadow-2xl px-4 py-3"
        >
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <h4 className="text-[13px] font-semibold text-slate-100">{def.term}</h4>
            <span className="text-[9px] uppercase tracking-widest text-slate-600 whitespace-nowrap">
              {def.categoria}
            </span>
          </div>
          <p className="text-[12px] text-slate-300 leading-relaxed text-pretty">{def.short}</p>
          <Link
            href={hrefGlosario(def.term)}
            className="mt-2.5 inline-block text-[11px] font-medium text-slate-400 hover:text-slate-100 transition-colors"
          >
            Ver en glosario →
          </Link>
        </div>
      )}
    </>
  );
}
