import { cargarPanel, contarPorGrupos } from "@/lib/panel-datos";
import { armarCurva, validarCurva } from "@/lib/bonos";
import MercadoClient from "@/app/mercado/MercadoClient";
import { VISTA_RENTA_FIJA } from "@/lib/mercado";
import RefreshButton from "@/app/mercado/RefreshButton";
import CurvaSoberanos from "./CurvaSoberanos";

export const metadata = { title: "Renta fija · Dashboard" };

// Los precios cambian con la rueda: la página no puede quedar fija en el build.
export const dynamic = "force-dynamic";

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
            TIR contra duration · la distancia entre las dos series es lo que se paga por la ley
          </span>
        </header>
        <div className="p-4">
          <CurvaSoberanos puntos={curva} validacion={validacion} />
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
