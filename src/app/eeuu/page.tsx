import { Suspense } from "react";
import { Contenedor, EncabezadoPagina } from "@/components/Card";
import Card from "@/components/Card";
import HeroFed from "./HeroFed";
import PanelSendero from "./PanelSendero";
import PanelPostura from "./PanelPostura";
import PanelCurva from "./PanelCurva";
import PanelInflacion from "./PanelInflacion";
import { PanelActividad, PanelCondiciones } from "./PanelIndicadores";
import PanelMundo from "./PanelMundo";
import CalendarioFomc from "./CalendarioFomc";
import Novedades from "./Novedades";
import RefrescarEeuu from "./RefrescarEeuu";

export const metadata = { title: "Estados Unidos · Dashboard" };

// Todo sale de APIs externas con caché en memoria: la página no se puede
// congelar en el build o mostraría la tasa del día del deploy.
export const dynamic = "force-dynamic";

/** Placeholder del alto aproximado de cada panel, para que no salte el layout. */
function Cargando({ alto }: { alto: number }) {
  return (
    <div
      className="rounded-card border border-borde bg-card animate-pulse"
      style={{ height: alto }}
    />
  );
}

/**
 * Macro de EE.UU. — la sección que faltaba.
 *
 * El resto del dashboard mira Argentina, que es donde se opera. Pero la mitad
 * de lo que mueve a un Global o a una ON hard dollar se decide en Washington, y
 * hasta acá eso había que ir a buscarlo afuera: quién preside la Fed, en cuánto
 * está la tasa, cuándo se vuelven a reunir y qué descuenta el mercado.
 *
 * El orden de la página es el de una lectura, no el de una base de datos:
 * primero la decisión (tasa, quién, cuándo), después lo que el mercado espera,
 * y recién ahí los datos que explican por qué —curva, inflación, actividad—.
 *
 * Cada panel resuelve su propio fetch dentro de un Suspense: la página aparece
 * entera aunque BYMA, Yahoo o federalreserve.gov estén lentos, y el que tarde
 * llena su hueco cuando llega.
 */
export default function EstadosUnidosPage() {
  return (
    <Contenedor>
      <EncabezadoPagina
        titulo="Estados Unidos"
        bajada="La tasa que descuenta al mundo · Fed, curva del Tesoro, inflación y actividad"
        derecha={<RefrescarEeuu />}
      />

      <Suspense fallback={<Cargando alto={148} />}>
        <HeroFed />
      </Suspense>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4 mt-4 items-start">
        <div className="space-y-4 min-w-0">
          <Suspense fallback={<Cargando alto={300} />}>
            <PanelPostura />
          </Suspense>
          <Suspense fallback={<Cargando alto={520} />}>
            <PanelSendero />
          </Suspense>
          <Suspense fallback={<Cargando alto={420} />}>
            <PanelCurva />
          </Suspense>
          <Suspense fallback={<Cargando alto={400} />}>
            <PanelInflacion />
          </Suspense>
          <Suspense fallback={<Cargando alto={300} />}>
            <PanelActividad />
          </Suspense>
          <Suspense fallback={<Cargando alto={300} />}>
            <PanelCondiciones />
          </Suspense>
        </div>

        <div className="space-y-4 min-w-0">
          <Card
            titulo="Calendario del FOMC"
            nota="Las de dot plot mueven más que la decisión"
            cuerpo={false}
          >
            <Suspense fallback={<div className="h-48 animate-pulse" />}>
              <CalendarioFomc />
            </Suspense>
          </Card>

          <Suspense fallback={<Cargando alto={240} />}>
            <PanelMundo />
          </Suspense>

          <Card titulo="Qué dijo la Fed" nota="Discursos y comunicados, de la fuente" cuerpo={false}>
            <Suspense fallback={<div className="h-64 animate-pulse" />}>
              <Novedades />
            </Suspense>
          </Card>
        </div>
      </div>
    </Contenedor>
  );
}
