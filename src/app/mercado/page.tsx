import { cargarPanel, contarPorGrupos } from "@/lib/panel-datos";
import MercadoClient from "./MercadoClient";
import { VISTA_MERCADO } from "@/lib/mercado";
import RefreshButton from "./RefreshButton";
import MapaProvincias from "./MapaProvincias";
import Gobierno from "./Gobierno";
import { getDatosProvinciales } from "@/lib/macro-provincias";
import { Suspense } from "react";

export const metadata = { title: "Macro Argentina · Dashboard" };

// El panel lee la DB en cada request: los valores del día cambian con cada
// refresh, así que la página no puede quedar congelada en el build.
export const dynamic = "force-dynamic";

/** Los datos provinciales salen de APIs del Estado: van en su propio Suspense. */
async function Provincias() {
  const datos = await getDatosProvinciales().catch(() => ({}));
  return <MapaProvincias datos={datos} />;
}

export default function MacroPage() {
  const datos = cargarPanel();
  const { total, conDatos } = contarPorGrupos(datos, VISTA_MERCADO.tiles);

  return (
    <div className="px-8 py-7 max-w-[1400px]">
      <div className="mb-6 fade-up fade-up-1 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-slate-600 mb-1">Dashboard</p>
          <h1 className="text-3xl font-semibold text-slate-100 tracking-tight">
            Macro Argentina
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Dólar, tasas, inflación y actividad · {total} indicadores · {conDatos} con datos
          </p>
        </div>
        <RefreshButton lastUpdate={datos.lastUpdate} needsBackfill={datos.needsBackfill} />
      </div>

      <MercadoClient
        instruments={datos.instruments}
        series={datos.series}
        definiciones={datos.definiciones}
        vista={VISTA_MERCADO}
      />

      <div className="space-y-5 mt-7 fade-up fade-up-3">
        <Gobierno />
        <Suspense
          fallback={<div className="h-[420px] rounded-xl border border-slate-800 bg-slate-900/20 animate-pulse" />}
        >
          <Provincias />
        </Suspense>
      </div>
    </div>
  );
}
