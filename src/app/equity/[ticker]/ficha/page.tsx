import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { POR_TICKER } from "@/lib/equity-universo";
import { getComparacion, getFicha, getSerieFinanciera, type Ficha } from "@/lib/equity";
import { getFichaAnalisis } from "@/lib/equity-ficha-db";
import { estimarWacc } from "@/lib/equity-ficha";
import { DB_IS_EPHEMERAL } from "@/lib/db";
import { fredSerie, ultimo } from "@/lib/fred";
import { fmtCap, fmtFecha, fmtUsd } from "@/lib/equity-formato";
import { Contenedor } from "@/components/Card";
import Logo from "../Logo";
import FichaClient from "./FichaClient";
import { BloqueDeuda, BloqueMultiplos, BloqueNumeros, BloqueSeguimiento } from "./Bloques";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const empresa = POR_TICKER.get(ticker.toUpperCase());
  return { title: empresa ? `Ficha · ${empresa.ticker}` : "Ficha de análisis" };
}

// ─── Bloques calculados ─────────────────────────────────────────────────────
// Cada uno resuelve su propio fetch dentro de un Suspense: la ficha se puede
// empezar a escribir mientras Yahoo contesta la serie financiera, que es lo más
// lento de la página. `getSerieFinanciera` está memoizada, así que los tres
// cuadros comparten los mismos cinco requests.

async function Numeros({ ticker, ficha }: { ticker: string; ficha: Ficha }) {
  const [serie, tasaLarga] = await Promise.all([
    getSerieFinanciera(ticker),
    fredSerie("DGS10").then(ultimo).catch(() => null),
  ]);

  const wacc = estimarWacc({
    beta: ficha.fundamentals.beta,
    capitalizacion: ficha.fundamentals.capitalizacion,
    deudaTotal: serie.deudaTotal,
    interesesPagados: serie.interesesPagados,
    tasaImpositiva: serie.tasaImpositiva,
    tasaLibre: tasaLarga?.valor ?? null,
  });

  return <BloqueNumeros serie={serie} wacc={wacc} />;
}

async function Deuda({ ticker }: { ticker: string }) {
  return <BloqueDeuda serie={await getSerieFinanciera(ticker)} />;
}

async function Multiplos({ ticker, ficha }: { ticker: string; ficha: Ficha }) {
  const [serie, comparacion] = await Promise.all([
    getSerieFinanciera(ticker),
    getComparacion(ticker).catch(() => null),
  ]);
  return <BloqueMultiplos ficha={ficha} serie={serie} comparacion={comparacion} />;
}

function Esqueleto({ alto }: { alto: number }) {
  return (
    <div className="rounded-card border border-divisor bg-boton/40 animate-pulse" style={{ height: alto }} />
  );
}

// ─── Página ─────────────────────────────────────────────────────────────────

/** Un dato del encabezado: lo que la plantilla pide y el dashboard ya sabe. */
function Meta({ label, valor }: { label: string; valor: string }) {
  return (
    <span className="text-[11px] text-meta">
      {label}: <span className="text-cuerpo tabular-nums">{valor}</span>
    </span>
  );
}

export default async function FichaAnalisisPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: crudo } = await params;
  const ticker = crudo.toUpperCase();

  if (!POR_TICKER.has(ticker)) notFound();

  const ficha = await getFicha(ticker);
  if (!ficha) notFound();

  const analisis = getFichaAnalisis(ticker);
  const fechaFicha = analisis.creado?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);

  return (
    <Contenedor ancho={1600}>
      <div className="mb-5">
        <Link
          href={`/equity/${ticker}`}
          className="text-[11px] text-tenue hover:text-secundario transition-colors duration-[120ms]"
        >
          ← {ticker}
        </Link>

        <div className="flex items-end justify-between gap-6 flex-wrap mt-2">
          <div className="flex items-start gap-3 min-w-0">
            <Logo web={ficha.web} ticker={ficha.ticker} tamaño={36} />
            <div className="min-w-0">
              <h1 className="font-serif text-[26px] leading-none font-semibold text-num tracking-[-0.02em]">
                Ficha de análisis
              </h1>
              <p className="text-[13px] text-secundario mt-1">
                {ficha.nombre} ({ficha.ticker})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
            <Meta label="Analista" valor="Bauti Remondino" />
            <Meta label="Fecha" valor={fmtFecha(fechaFicha)} />
            <Meta label="Precio" valor={fmtUsd(ficha.precio)} />
            <Meta label="Market cap" valor={fmtCap(ficha.fundamentals.capitalizacion)} />
            <Meta label="EV" valor={fmtCap(ficha.fundamentals.enterpriseValue)} />
          </div>
        </div>

        {DB_IS_EPHEMERAL && (
          <p className="mt-3 text-[11px] text-amber-500/90 border border-amber-900/60 rounded-card px-3 py-2">
            Este deploy corre sobre una copia temporal de la base: lo que escribas acá se pierde en
            el próximo arranque en frío. La ficha se trabaja en el dashboard local.
          </p>
        )}
      </div>

      <FichaClient
        ticker={ticker}
        inicial={analisis}
        bloques={{
          numeros: (
            <Suspense fallback={<Esqueleto alto={430} />}>
              <Numeros ticker={ticker} ficha={ficha} />
            </Suspense>
          ),
          deuda: (
            <Suspense fallback={<Esqueleto alto={92} />}>
              <Deuda ticker={ticker} />
            </Suspense>
          ),
          multiplos: (
            <Suspense fallback={<Esqueleto alto={92} />}>
              <Multiplos ticker={ticker} ficha={ficha} />
            </Suspense>
          ),
          seguimiento: <BloqueSeguimiento ficha={ficha} />,
        }}
      />
    </Contenedor>
  );
}
