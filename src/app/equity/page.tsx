import { Suspense } from "react";
import { getRanking } from "@/lib/equity";
import { UNIVERSO_SP500 } from "@/lib/equity-universo";
import EquityClient from "./EquityClient";
import RefrescarEquity from "./RefrescarEquity";

export const metadata = { title: "Equity · Dashboard" };

// Los precios cambian con la rueda: la página no puede quedar fija en el build.
// El caché de Yahoo vive en `@/lib/equity`, no acá.
export const dynamic = "force-dynamic";

/**
 * El ranking sale en dos etapas (ver `@/lib/equity`): el lote de quotes es
 * inmediato, los retornos exactos cuestan un request por ticker. Esta parte se
 * renderiza dentro de un Suspense para que el encabezado pinte al instante.
 */
async function Ranking() {
  const filas = await getRanking();
  return <EquityClient filas={filas} />;
}

function Esqueleto() {
  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/20">
      <div className="h-8 bg-slate-900/60 border-b border-slate-800" />
      <div className="divide-y divide-slate-900">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="h-[43px] px-4 flex items-center gap-3">
            <div
              className="h-2.5 rounded bg-slate-800/60 animate-pulse"
              style={{ width: `${28 + ((i * 37) % 45)}%`, animationDelay: `${i * 60}ms` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EquityPage() {
  return (
    <div className="px-8 py-7 max-w-[1600px]">
      <div className="mb-6 fade-up fade-up-1 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-slate-600 mb-1">Dashboard</p>
          <h1 className="text-3xl font-semibold text-slate-100 tracking-tight">Equity</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            S&amp;P 500 · {UNIVERSO_SP500.length} empresas · lo que más se movió
          </p>
        </div>
        <RefrescarEquity />
      </div>

      <Suspense fallback={<Esqueleto />}>
        <Ranking />
      </Suspense>
    </div>
  );
}
