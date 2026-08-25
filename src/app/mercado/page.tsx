import { cargarPanel, contarPorGrupos } from "@/lib/panel-datos";
import MercadoClient from "./MercadoClient";
import { VISTA_MERCADO } from "@/lib/mercado";
import RefreshButton from "./RefreshButton";
import MapaProvincias from "./MapaProvincias";
import Gobierno from "./Gobierno";
import { getDatosProvinciales } from "@/lib/macro-provincias";
import { Suspense } from "react";
import Card, { Contenedor, EncabezadoPagina } from "@/components/Card";

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
    <Contenedor>
      <EncabezadoPagina
        titulo="Macro Argentina"
        bajada={`Dólar, tasas, inflación y actividad · ${conDatos} de ${total} indicadores con dato`}
        derecha={<RefreshButton lastUpdate={datos.lastUpdate} needsBackfill={datos.needsBackfill} />}
      />

      <MercadoClient
        instruments={datos.instruments}
        series={datos.series}
        definiciones={datos.definiciones}
        vista={VISTA_MERCADO}
      />

      <div className="space-y-4 mt-4">
        <Gobierno />
        <Suspense
          fallback={<div className="h-[420px] rounded-card border border-borde bg-card animate-pulse" />}
        >
          <Provincias />
        </Suspense>
      </div>
    </Contenedor>
  );
}
