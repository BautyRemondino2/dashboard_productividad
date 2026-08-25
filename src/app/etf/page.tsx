import { Suspense } from "react";
import { ETFS, getComposiciones, getIndicesReferencia } from "@/lib/equity";
import EtfClient from "./EtfClient";
import Card, { Contenedor, EncabezadoPagina } from "@/components/Card";

export const metadata = { title: "ETF · Dashboard" };
export const dynamic = "force-dynamic";

/**
 * Los ETF de referencia.
 *
 * Un request por fondo para la composición, cacheado en `@/lib/equity`: la
 * primera carga del día paga y el resto sale de memoria.
 */
async function Fondos() {
  const [composiciones, indices] = await Promise.all([
    getComposiciones(),
    getIndicesReferencia().catch(() => ({})),
  ]);
  return <EtfClient composiciones={composiciones} indices={indices} />;
}

function Esqueleto() {
  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-5">
      <div className="space-y-5">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-40 rounded-card bg-card animate-pulse" />
        ))}
      </div>
      <div className="h-[520px] rounded-card bg-card animate-pulse" />
    </div>
  );
}

export default function IndicesPage() {
  return (
    <Contenedor ancho={1500}>
      <EncabezadoPagina
        titulo="ETF"
        bajada={`${ETFS.length} fondos de referencia · composición sectorial, mayores tenencias y qué replican`}
      />

      <Suspense fallback={<Esqueleto />}>
        <Fondos />
      </Suspense>
    </Contenedor>
  );
}
