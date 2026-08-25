import { cargarPanel, contarPorGrupos } from "@/lib/panel-datos";
import { armarCurva, getCurvaOns, spreadsPorLey, validarCurva } from "@/lib/bonos";
import { Suspense } from "react";
import MercadoClient from "@/app/mercado/MercadoClient";
import { VISTA_RENTA_FIJA } from "@/lib/mercado";
import RefreshButton from "@/app/mercado/RefreshButton";
import CurvaSoberanos from "./CurvaSoberanos";
import CurvaOns from "./CurvaOns";
import Card, { Contenedor, EncabezadoPagina } from "@/components/Card";

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
    <Contenedor>
      <EncabezadoPagina
        titulo="Renta fija"
        bajada={`Soberanos hard-dollar y corporativos · ${curva.length} soberanos en la curva · ${total} instrumentos, ${conDatos} con datos`}
        derecha={<RefreshButton lastUpdate={datos.lastUpdate} needsBackfill={datos.needsBackfill} />}
      />

      <div className="space-y-4">
        <Card
          titulo="Curva de soberanos"
          nota="TIR contra duration · capitalización semestral, base 30/360"
          acento="var(--color-acento-verde)"
          destacada
        >
          <CurvaSoberanos puntos={curva} spreads={spreads} validacion={validacion} />
        </Card>

        <Card
          titulo="Obligaciones negociables"
          nota="corporativas en dólares · lo que rinden por encima del soberano es el riesgo de la empresa"
          acento="var(--color-acento-rojo)"
        >
          <Suspense fallback={<div className="h-[380px] animate-pulse bg-encabezado rounded-card" />}>
            {/* Sólo la curva ley NY como referencia: mezclar las dos leyes
                daba una línea en zigzag que no es ninguna de las dos */}
            <SeccionOns
              soberanos={curva
                .filter((p) => p.ley === "NY")
                .map((p) => ({ duration: p.duration, tir: p.tir, ticker: p.ticker }))}
            />
          </Suspense>
        </Card>

        <MercadoClient
          instruments={datos.instruments}
          series={datos.series}
          definiciones={datos.definiciones}
          vista={VISTA_RENTA_FIJA}
        />
      </div>
    </Contenedor>
  );
}
