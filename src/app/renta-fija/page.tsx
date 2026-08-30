import { cargarPanel, contarPorGrupos } from "@/lib/panel-datos";
import { armarCurva, getCurvaOns, spreadsPorLey, validarCurva } from "@/lib/bonos";
import { getCurvaCer, getCurvaDolarLinked } from "@/lib/bonos-ars";
import { breakevenInflacion, getCurvaTasaFija } from "@/lib/bonos-tasa-fija";
import { getCurvaTesoroDuration, tesoroEnDuration } from "@/lib/eeuu";
import { Suspense } from "react";
import MercadoClient from "@/app/mercado/MercadoClient";
import { VISTA_RENTA_FIJA } from "@/lib/mercado";
import RefreshButton from "@/app/mercado/RefreshButton";
import CurvaSoberanos from "./CurvaSoberanos";
import CurvaOns from "./CurvaOns";
import CurvaPesos from "./CurvaPesos";
import CurvaTasaFija from "./CurvaTasaFija";
import CalendarioPagos from "./CalendarioPagos";
import Card, { Contenedor, EncabezadoPagina } from "@/components/Card";

export const metadata = { title: "Renta fija · Dashboard" };

// Los precios cambian con la rueda: la página no puede quedar fija en el build.
export const dynamic = "force-dynamic";

/**
 * El color de cada curva, uno por moneda de ajuste.
 *
 * El punto de acento del card lleva el mismo color que la línea del gráfico, así
 * que los cuatro encabezados funcionan de leyenda de la página entera.
 */
const COLOR_SOBERANOS = "#3987e5";
const COLOR_CER = "#8b5cf6";
const COLOR_DL = "#0891b2";
const COLOR_ONS = "#199e70";
const COLOR_TASA_FIJA = "#e0912f";

function Esqueleto({ alto = 380 }: { alto?: number }) {
  return <div className="animate-pulse bg-encabezado rounded-card" style={{ height: alto }} />;
}

/**
 * La curva soberana, con el Tesoro de EE.UU. dibujado abajo.
 *
 * El spread de cada bono se calcula acá, del lado del servidor, y no en el
 * componente: interpolar la curva del Tesoro necesita `@/lib/eeuu`, que trae
 * `fetch` y no tiene por qué viajar al navegador.
 *
 * Se compara contra el Tesoro **a la misma duration** y no contra el 10 años.
 * Un AL30 con duration 2,5 no compite con un bono a diez años del Tesoro: su
 * alternativa libre de riesgo rinde bastante menos, y medirlo contra el 10a
 * subestimaba su spread de crédito.
 */
async function SeccionSoberanos({
  curva,
  spreads,
  validacion,
  ust10y,
}: {
  curva: ReturnType<typeof armarCurva>;
  spreads: ReturnType<typeof spreadsPorLey>;
  validacion: ReturnType<typeof validarCurva>;
  ust10y: number | null;
}) {
  const tesoro = await getCurvaTesoroDuration().catch(() => []);

  const spreadsTesoro: Record<string, number> = {};
  for (const p of curva) {
    const base = tesoroEnDuration(tesoro, p.duration);
    if (base != null) spreadsTesoro[p.ticker] = (p.tir - base) * 100;
  }

  return (
    <CurvaSoberanos
      puntos={curva}
      spreads={spreads}
      validacion={validacion}
      ust10y={ust10y}
      tesoro={tesoro}
      spreadsTesoro={spreadsTesoro}
    />
  );
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
/**
 * La curva de tasa fija necesita además la CER para el breakeven, así que pide
 * las dos. Si la CER no viene, la curva se dibuja igual y el breakeven se
 * omite: es un extra, no la razón de ser del panel.
 */
async function SeccionTasaFija() {
  const [datos, cer] = await Promise.all([
    getCurvaTasaFija().catch(() => null),
    getCurvaCer().catch(() => null),
  ]);
  if (!datos) return <SinDatos que="data912 con los precios de las letras" />;

  const breakevens = cer ? breakevenInflacion(datos.puntos, cer.puntos) : [];
  return <CurvaTasaFija datos={datos} breakevens={breakevens} />;
}

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
        serif
        titulo="Renta fija"
        bajada={`Cuatro curvas ajustadas por Nelson-Siegel: hard-dollar, CER, dólar linked y corporativos · ${total} instrumentos, ${conDatos} con datos`}
        derecha={<RefreshButton lastUpdate={datos.lastUpdate} needsBackfill={datos.needsBackfill} />}
      />

      {/* Dos por fila: las cuatro curvas comparten ejes y marcas, y en grilla se
          comparan de un vistazo en vez de scrolleando una debajo de la otra.
          `items-start` para que cada card mida lo que ocupa: estirado, el de
          CER quedaba con un palmo de vacío adentro para igualar al de
          soberanos, que lleva además el spread por ley. */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4 items-start">
        <Card
          serif
          titulo="Curva de soberanos"
          nota="hard-dollar · capitalización semestral, base 30/360"
          acento={COLOR_SOBERANOS}
        >
          <Suspense
            fallback={
              <CurvaSoberanos
                puntos={curva}
                spreads={spreads}
                validacion={validacion}
                ust10y={precios["UST10Y"] ?? null}
              />
            }
          >
            <SeccionSoberanos
              curva={curva}
              spreads={spreads}
              validacion={validacion}
              ust10y={precios["UST10Y"] ?? null}
            />
          </Suspense>
        </Card>

        <Card
          serif
          titulo="Curva de tasa fija en pesos"
          nota="Lecaps y Boncaps · lo que paga el Tesoro sin ajuste"
          acento={COLOR_TASA_FIJA}
        >
          <Suspense fallback={<Esqueleto />}>
            <SeccionTasaFija />
          </Suspense>
        </Card>

        <Card
          serif
          titulo="Curva CER"
          nota="tasa real: lo que paga el Tesoro por encima de la inflación"
          acento={COLOR_CER}
        >
          <Suspense fallback={<Esqueleto />}>
            <SeccionCer />
          </Suspense>
        </Card>

        <Card
          serif
          titulo="Curva dólar linked"
          nota="tasa en dólares oficiales: lo que rinde además de la devaluación"
          acento={COLOR_DL}
        >
          <Suspense fallback={<Esqueleto />}>
            <SeccionDolarLinked />
          </Suspense>
        </Card>

        <Card
          serif
          titulo="Obligaciones negociables"
          nota="corporativas en dólares · contra la soberana, el riesgo de la empresa"
          acento={COLOR_ONS}
        >
          <Suspense fallback={<Esqueleto />}>
            {/* Sólo la curva ley NY como referencia: mezclar las dos leyes
                daba una línea en zigzag que no es ninguna de las dos */}
            <SeccionOns
              soberanos={curva
                .filter((p) => p.ley === "NY")
                .map((p) => ({ duration: p.duration, tir: p.tir, ticker: p.ticker }))}
            />
          </Suspense>
        </Card>
      </div>

      <Card
        serif
        titulo="Próximos pagos"
        nota="qué cobra una tenencia en los próximos 90 días · por cada 100 de valor nominal"
        cuerpo={false}
        className="mb-4"
      >
        <Suspense fallback={<Esqueleto alto={280} />}>
          <CalendarioPagos />
        </Suspense>
      </Card>

      <div>
        <MercadoClient
          instruments={datos.instruments}
          series={datos.series}
          definiciones={datos.definiciones}
          sinFuente={datos.sinFuente}
          vista={VISTA_RENTA_FIJA}
        />
      </div>
    </Contenedor>
  );
}
