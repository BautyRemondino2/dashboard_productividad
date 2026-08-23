import Link from "next/link";
import { Suspense } from "react";
import { ETFS, getComposiciones } from "@/lib/equity";
import { getObjetivoEs } from "@/lib/equity-claude";
import IndicesClient from "./IndicesClient";

export const metadata = { title: "Índices · Dashboard" };
export const dynamic = "force-dynamic";

/**
 * Los índices y ETF de referencia.
 *
 * Un request por fondo para la composición, más uno de traducción por objetivo.
 * Todo cacheado en `@/lib/equity` y `@/lib/equity-claude`, así que la primera
 * carga del día paga y el resto sale de memoria.
 */
async function Indices() {
  const composiciones = await getComposiciones();

  // Los objetivos vienen de Yahoo en jerga de prospecto y en inglés. Si falla
  // una traducción, ese fondo se muestra sin el párrafo y los demás igual.
  const traducidos = await Promise.all(
    composiciones.map(async (c) =>
      c.objetivo
        ? [c.ticker, await getObjetivoEs(c.ticker, c.nombre, c.objetivo).catch(() => null)] as const
        : [c.ticker, null] as const
    )
  );

  const objetivos = Object.fromEntries(
    traducidos.filter((t): t is readonly [string, string] => Boolean(t[1]))
  );

  return <IndicesClient composiciones={composiciones} objetivos={objetivos} />;
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
        <Link
          href="/equity"
          className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors"
        >
          ← Equity
        </Link>
        <h1 className="text-3xl font-semibold text-slate-100 tracking-tight mt-2">Índices</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {ETFS.length} fondos de referencia · qué replican y de qué dependen
        </p>
      </div>

      <Suspense fallback={<Esqueleto />}>
        <Indices />
      </Suspense>
    </div>
  );
}
