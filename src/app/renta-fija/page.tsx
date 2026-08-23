import { cargarPanel, contarPorGrupos } from "@/lib/panel-datos";
import MercadoClient from "@/app/mercado/MercadoClient";
import { VISTA_RENTA_FIJA } from "@/lib/mercado";
import RefreshButton from "@/app/mercado/RefreshButton";

export const metadata = { title: "Renta fija · Dashboard" };

// Los precios cambian con la rueda: la página no puede quedar fija en el build.
export const dynamic = "force-dynamic";

export default function RentaFijaPage() {
  const datos = cargarPanel();
  const { total, conDatos } = contarPorGrupos(datos, VISTA_RENTA_FIJA.tablas);

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

      <MercadoClient
        instruments={datos.instruments}
        series={datos.series}
        definiciones={datos.definiciones}
        vista={VISTA_RENTA_FIJA}
      />
    </div>
  );
}
