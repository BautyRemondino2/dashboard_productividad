import { Contenedor, EncabezadoPagina } from "@/components/Card";
import { hoyEnArgentina } from "@/lib/rava";
import { getBrief, listarAgenda, listarClientes, listarHistorial } from "@/lib/morning-brief-db";
import { INDICADORES_BRIEF } from "@/lib/morning-brief-config";
import AdvertenciasBanner from "./AdvertenciasBanner";
import TesisForm from "./TesisForm";
import GenerarBriefButton from "./GenerarBriefButton";
import IndicadoresTabla from "./IndicadoresTabla";
import BriefResultado from "./BriefResultado";
import EvaluarCierre from "./EvaluarCierre";
import AgendaManager from "./AgendaManager";
import ClientesManager from "./ClientesManager";
import Historial from "./Historial";

export const metadata = { title: "Morning Brief · Dashboard" };
export const dynamic = "force-dynamic";

/**
 * Morning Brief — la rutina matinal de un PM: juntar los indicadores clave en
 * orden, interpretarlos y dejar una tesis del día para contrastar al cierre.
 *
 * El código trae y calcula todos los números (`morning-brief-datos.ts`);
 * Claude sólo interpreta lo que ya está calculado (`morning-brief-claude.ts`).
 * La tesis propia se escribe primero y recién ahí se desbloquea el resto —
 * comprometerse después de leer el brief no sirve para contrastar nada.
 */
export default async function MorningBriefPage() {
  const fecha = hoyEnArgentina();
  const brief = getBrief(fecha);
  const agendaItems = listarAgenda();
  const clientes = listarClientes();
  const historial = listarHistorial();
  const sinClave = !process.env.ANTHROPIC_API_KEY;

  const tiposPorId = new Map(INDICADORES_BRIEF.map((c) => [c.id, c.tipoVariacion]));
  const tesisGuardada = brief?.tesis_propia ?? null;

  return (
    <Contenedor ancho={980}>
      <EncabezadoPagina titulo="Morning Brief" bajada={`${fecha} · la rutina matinal, en orden`} />

      <div className="space-y-4">
        {brief?.advertencias && <AdvertenciasBanner advertencias={brief.advertencias} />}

        <TesisForm fecha={fecha} tesisGuardada={tesisGuardada} />

        {tesisGuardada && (
          <>
            <GenerarBriefButton yaGenerado={!!brief?.brief} sinClave={sinClave} />

            {brief?.snapshot && (
              <IndicadoresTabla indicadores={brief.snapshot.indicadores} tiposPorId={tiposPorId} />
            )}

            {brief?.brief && (
              <>
                <BriefResultado brief={brief.brief} tesisPropia={tesisGuardada} />
                <EvaluarCierre
                  fecha={fecha}
                  evaluacion={brief.evaluacion}
                  aprendizajeGuardado={brief.aprendizaje}
                  tesisAcierto={brief.tesis_acierto}
                />
              </>
            )}
          </>
        )}

        <AgendaManager items={agendaItems} />
        <ClientesManager clientes={clientes} />
        <Historial filas={historial} />
      </div>
    </Contenedor>
  );
}
