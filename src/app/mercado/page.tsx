import { Suspense } from "react";
import { cargarPanel } from "@/lib/panel-datos";
import MercadoClient from "./MercadoClient";
import { VISTA_MERCADO } from "@/lib/mercado";
import RefreshButton from "./RefreshButton";
import MapaProvincias from "./MapaProvincias";
import Gobierno from "./Gobierno";
import { getDatosProvinciales } from "@/lib/macro-provincias";
import { Contenedor, EncabezadoPagina } from "@/components/Card";
import HeroMacro from "./HeroMacro";
import Cauciones from "./Cauciones";
import Panorama from "./Panorama";
import Rem from "./Rem";

export const metadata = { title: "Macro Argentina · Dashboard" };

// El panel lee la DB en cada request: los valores del día cambian con cada
// refresh, así que la página no puede quedar congelada en el build.
export const dynamic = "force-dynamic";

export default function MacroPage() {
  const datos = cargarPanel();
  // El conteo va sobre todo el panel, no sobre los tiles: el dólar y el riesgo
  // país siguen siendo indicadores aunque ahora se muestren en el hero
  const { total, conDatos } = datos;

  return (
    <Contenedor>
      <EncabezadoPagina
        titulo="Macro Argentina"
        bajada={`Dólar, tasas, inflación y actividad · ${conDatos} de ${total} indicadores con dato`}
        derecha={<RefreshButton lastUpdate={datos.lastUpdate} needsBackfill={datos.needsBackfill} />}
      />

      <HeroMacro datos={datos} />

      {/* Cada celda resuelve su propio fetch: la página no espera a FRED ni a
          data912 para dibujar el panel argentino, que es lo que se mira primero. */}
      <Suspense fallback={<div className="h-[124px] mt-4 rounded-card border border-borde bg-card animate-pulse" />}>
        <Panorama />
      </Suspense>

      {/* La inflación esperada del mes en curso: el complemento del IPC del panel,
          que siempre es del mes cerrado. Va antes de los tiles porque contesta la
          pregunta que el dato de INDEC deja abierta —cómo viene este mes—. */}
      <Suspense fallback={<div className="h-[196px] mt-4 rounded-card border border-borde bg-card animate-pulse" />}>
        <Rem />
      </Suspense>

      <div className="mt-4">
        <MercadoClient
          instruments={datos.instruments}
          series={datos.series}
          definiciones={datos.definiciones}
          sinFuente={datos.sinFuente}
          vista={VISTA_MERCADO}
          cauciones={
            <Suspense
              key="cauciones"
              fallback={<div className="h-64 rounded-card border border-borde bg-card animate-pulse" />}
            >
              <Cauciones />
            </Suspense>
          }
        />
      </div>

      <div className="space-y-4 mt-4">
        <Gobierno />
        <MapaProvincias datos={getDatosProvinciales()} />
      </div>
    </Contenedor>
  );
}
