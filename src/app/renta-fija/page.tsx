import { cargarPanel, contarPorGrupos } from "@/lib/panel-datos";
import { armarCurva, getCurvaOns, spreadsPorLey, validarCurva } from "@/lib/bonos";
import { Suspense } from "react";
import MercadoClient from "@/app/mercado/MercadoClient";
import { VISTA_RENTA_FIJA } from "@/lib/mercado";
import RefreshButton from "@/app/mercado/RefreshButton";
import CurvaSoberanos from "./CurvaSoberanos";
import CurvaOns from "./CurvaOns";

export const metadata = { title: "Renta fija · Dashboard" };

// Los precios cambian con la rueda: la página no puede quedar fija en el build.
export const dynamic = "force-dynamic";

/** Los precios de las ONs se piden en vivo: van en su propio Suspense. */
async function SeccionOns({ soberanos }: { soberanos: { duration: number; tir: number; ticker: string }[] }) {
  const puntos = await getCurvaOns().catch(() => []);
  return <CurvaOns puntos={puntos} soberanos={soberanos} />;
}

export default function RentaFijaPage() {
  const datos = cargarPanel();
  const { total, conDatos } = contarPorGrupos(datos, VISTA_RENTA_FIJA.tablas);

  // Último precio de cada instrumento, que es lo que alimenta la curva
  const precios: Record<string, number> = {};
  for (const [ticker, serie] of Object.entries(datos.series)) {
    const ultimo = serie.at(-1);
    if (ultimo) precios[ticker] = ultimo.valor;
  }

  const curva = armarCurva(precios);
  const spreads = spreadsPorLey(curva);
  const validacion = validarCurva(curva, precios["RIESGO_PAIS"] ?? null, precios["UST10Y"] ?? null);

  return (
    <div className="px-8 py-7 max-w-[1400px]">
      <div className="mb-6 fade-up fade-up-1 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-slate-600 mb-1">Dashboard</p>
          <h1 className="text-3xl font-semibold text-slate-100 tracking-tight">Renta fija</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Soberanos hard-dollar, curva en pesos y corporativos · {total} instrumentos ·{" "}
            {conDatos} con datos
          </p>
        </div>
        <RefreshButton lastUpdate={datos.lastUpdate} needsBackfill={datos.needsBackfill} />
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900/20 overflow-hidden mb-6 fade-up fade-up-2">
        <header className="px-4 py-3 border-b border-slate-800/80 flex items-baseline gap-3 flex-wrap">
          <h2 className="text-[13px] font-semibold text-slate-200">Curva de soberanos</h2>
          <span className="text-[10px] text-slate-600">
            TIR anual con capitalización semestral y base 30/360, calculada sobre los flujos
          </span>
        </header>
        <div className="p-4">
          <CurvaSoberanos puntos={curva} spreads={spreads} validacion={validacion} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/20 overflow-hidden mb-6 fade-up fade-up-2">
        <header className="px-4 py-3 border-b border-slate-800/80 flex items-baseline gap-3 flex-wrap">
          <h2 className="text-[13px] font-semibold text-slate-200">
            Obligaciones negociables
          </h2>
          <span className="text-[10px] text-slate-600">
            corporativas en dólares · lo que rinden por encima del soberano es el riesgo de
            la empresa
          </span>
        </header>
        <div className="p-4">
          <Suspense
            fallback={<div className="h-[380px] animate-pulse bg-slate-900/30 rounded" />}
          >
            {/* Sólo la curva ley NY como referencia: mezclar las dos leyes
                daba una línea en zigzag que no es ninguna de las dos */}
            <SeccionOns
              soberanos={curva
                .filter((p) => p.ley === "NY")
                .map((p) => ({ duration: p.duration, tir: p.tir, ticker: p.ticker }))}
            />
          </Suspense>
        </div>
      </section>

      <MercadoClient
        instruments={datos.instruments}
        series={datos.series}
        definiciones={datos.definiciones}
        vista={VISTA_RENTA_FIJA}
      />
    </div>
  );
}
