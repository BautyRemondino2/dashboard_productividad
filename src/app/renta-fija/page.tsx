import { cargarPanel, contarPorGrupos } from "@/lib/panel-datos";
import { armarCurva, getCurvaOns, spreadsPorLey, validarCurva } from "@/lib/bonos";
import { getCurvaCer, getCurvaDolarLinked } from "@/lib/bonos-ars";
import { Suspense } from "react";
import MercadoClient from "@/app/mercado/MercadoClient";
import { VISTA_RENTA_FIJA } from "@/lib/mercado";
import RefreshButton from "@/app/mercado/RefreshButton";
import CurvaSoberanos from "./CurvaSoberanos";
import CurvaOns from "./CurvaOns";
import CurvaPesos from "./CurvaPesos";
import Card, { Contenedor, EncabezadoPagina } from "@/components/Card";

export const metadata = { title: "Renta fija · Dashboard" };

// Los precios cambian con la rueda: la página no puede quedar fija en el build.
export const dynamic = "force-dynamic";

/** El color de cada curva. Uno por moneda de ajuste, igual en toda la página. */
const COLOR_CER = "#8b5cf6";
const COLOR_DL = "#0891b2";

function Esqueleto({ alto = 380 }: { alto?: number }) {
  return <div className="animate-pulse bg-encabezado rounded-card" style={{ height: alto }} />;
}

/** Los precios de las ONs se piden en vivo: van en su propio Suspense. */
async function SeccionOns({ soberanos }: { soberanos: { duration: number; tir: number; ticker: string }[] }) {
  const puntos = await getCurvaOns().catch(() => []);
  return <CurvaOns puntos={puntos} soberanos={soberanos} />;
}

/**
 * Las dos curvas en pesos dependen de data912 y del BCRA a la vez. Si alguna de
 * las dos fuentes no responde no se dibuja media curva: se dice que falta.
 */
async function SeccionCer() {
  const curva = await getCurvaCer().catch(() => null);
  if (!curva) return <SinDatos que="el CER del BCRA o los precios de data912" />;
  return (
    <CurvaPesos
      curva={curva}
      color={COLOR_CER}
      etiqueta="Boncer y Lecer"
      etiquetaPrecioAjustado="ajustado"
    />
  );
}

async function SeccionDolarLinked() {
  const curva = await getCurvaDolarLinked().catch(() => null);
  if (!curva) return <SinDatos que="el A3500 del BCRA o los precios de data912" />;
  return (
    <CurvaPesos
      curva={curva}
      color={COLOR_DL}
      etiqueta="Bonos y letras dólar linked"
      etiquetaPrecioAjustado="en dólares"
    />
  );
}

function SinDatos({ que }: { que: string }) {
  return <p className="text-[12px] text-meta">No respondió {que}. La curva vuelve al recargar.</p>;
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
        bajada={`Cuatro curvas ajustadas por Nelson-Siegel: hard-dollar, CER, dólar linked y corporativos · ${total} instrumentos, ${conDatos} con datos`}
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

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card
            titulo="Curva CER"
            nota="tasa real: lo que paga el Tesoro por encima de la inflación"
            acento={COLOR_CER}
          >
            <Suspense fallback={<Esqueleto />}>
              <SeccionCer />
            </Suspense>
          </Card>

          <Card
            titulo="Curva dólar linked"
            nota="tasa en dólares oficiales: lo que rinde además de la devaluación"
            acento={COLOR_DL}
          >
            <Suspense fallback={<Esqueleto />}>
              <SeccionDolarLinked />
            </Suspense>
          </Card>
        </div>

        <Card
          titulo="Obligaciones negociables"
          nota="corporativas en dólares · lo que rinden por encima del soberano es el riesgo de la empresa"
          acento="var(--color-acento-rojo)"
        >
          <Suspense fallback={<Esqueleto alto={420} />}>
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
