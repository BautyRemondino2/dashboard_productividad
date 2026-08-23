import { Suspense } from "react";
import { ETFS, getComposiciones } from "@/lib/equity";
import EtfClient from "./EtfClient";

export const metadata = { title: "ETF · Dashboard" };
export const dynamic = "force-dynamic";

/**
 * Los ETF de referencia.
 *
 * Un request por fondo para la composición, más uno de traducción por objetivo.
 * Todo cacheado en `@/lib/equity` y `@/lib/equity-claude`, así que la primera
 * carga del día paga y el resto sale de memoria.
 */
async function Fondos() {
  const composiciones = await getComposiciones();
  return <EtfClient composiciones={composiciones} />;
}

function Esqueleto() {
  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-5">
      <div className="space-y-5">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-40 rounded-xl bg-slate-900/40 animate-pulse" />
        ))}
      </div>
      <div className="h-[520px] rounded-xl bg-slate-900/40 animate-pulse" />
    </div>
  );
}

export default function IndicesPage() {
  return (
    <div className="px-8 py-7 max-w-[1500px]">
      <div className="mb-6 fade-up fade-up-1">
        <p className="text-[11px] uppercase tracking-widest text-slate-600 mb-1">Dashboard</p>
        <h1 className="text-3xl font-semibold text-slate-100 tracking-tight">ETF</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {ETFS.length} fondos de referencia · qué replican y de qué dependen
        </p>
      </div>

      <Suspense fallback={<Esqueleto />}>
        <Fondos />
      </Suspense>
    </div>
  );
}
