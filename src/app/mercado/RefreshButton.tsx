"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { refreshMarketData, backfillMarketHistory, type RefreshSummary } from "@/app/actions";

const STALE_MS = 2 * 60 * 60 * 1000; // data912 cachea ~2hs; no tiene sentido refrescar más seguido

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "recién";
  if (mins < 60) return `hace ${mins} min`;
  const hs = Math.round(mins / 60);
  if (hs < 48) return `hace ${hs} h`;
  return `hace ${Math.round(hs / 24)} días`;
}

/**
 * Botón "Actualizar" + estado de fuentes. Si el último dato automático tiene
 * más de 2hs (o nunca corrió), dispara el refresh solo al montar: el panel
 * muestra lo cacheado al instante y los datos frescos entran cuando llegan.
 */
export default function RefreshButton({ lastUpdate, needsBackfill }: {
  lastUpdate: string | null;
  needsBackfill: boolean;
}) {
  const [summary, setSummary] = useState<RefreshSummary[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const firedRef = useRef(false);

  function refresh(withBackfill = false) {
    startTransition(async () => {
      // El backfill va primero: trae el histórico y después el refresh pisa el día de hoy
      const historia = withBackfill ? await backfillMarketHistory() : [];
      const res = await refreshMarketData();
      setSummary([...historia, ...res]);
    });
  }

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    const stale = !lastUpdate || Date.now() - new Date(lastUpdate).getTime() > STALE_MS;
    if (stale || needsBackfill) refresh(needsBackfill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fallidas = summary?.filter((s) => !s.ok && s.guardados === 0) ?? [];
  const guardados = summary?.reduce((acc, s) => acc + s.guardados, 0) ?? 0;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {isPending ? (
        <span className="text-[11px] text-slate-500 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full border border-slate-700 border-t-slate-400 animate-spin" />
          Actualizando fuentes…
        </span>
      ) : summary ? (
        <span className="text-[11px] tabular-nums text-slate-500">
          <span className="text-emerald-400 font-medium">{guardados} valores</span> actualizados
          {fallidas.length > 0 && (
            <span className="text-amber-500" title={fallidas.map((f) => `${f.label}: ${f.error}`).join(" · ")}>
              {" "}· {fallidas.length} {fallidas.length === 1 ? "fuente caída" : "fuentes caídas"} ({fallidas.map((f) => f.label).join(", ")})
            </span>
          )}
        </span>
      ) : lastUpdate ? (
        <span className="text-[11px] text-slate-600">datos {timeAgo(lastUpdate)}</span>
      ) : null}
      <button
        onClick={() => refresh(false)}
        disabled={isPending}
        className="text-[11px] font-medium px-2.5 py-1 rounded-md border border-slate-700 text-slate-300 hover:text-slate-100 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
      >
        ↻ Actualizar
      </button>
    </div>
  );
}
