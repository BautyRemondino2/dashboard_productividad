import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { POR_TICKER } from "@/lib/equity-universo";
import { SECTOR_LABEL } from "@/lib/equity-sectores";
import {
  getComparacion, getConsenso, getFicha, getHistoriaFinanciera,
  getNoticias, getRetornosDe,
} from "@/lib/equity";
import { traducirDescripcion } from "@/lib/traducir";
import {
  PanelConsenso, PanelHistoria, PanelSorpresas,
} from "./Fundamentals";
import PanelComparacion from "./Comparacion";
import {
  PERIODOS, PERIODO_LABEL, RECOMENDACION_LABEL, colorRetorno,
  fmtCap, fmtFecha, fmtPct, fmtUsd,
} from "@/lib/equity-formato";
import GraficoTradingView from "@/components/GraficoTradingView";
import Logo from "./Logo";
import { PanelNoticias } from "./Investigacion";
import Card from "@/components/Card";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const empresa = POR_TICKER.get(ticker.toUpperCase());
  return { title: empresa ? `${empresa.ticker} · ${empresa.nombre}` : "Equity · Dashboard" };
}

// ─── Piezas ─────────────────────────────────────────────────────────────────

/** Un dato de la ficha técnica, al costado de la descripción. */
function FichaDato({ label, valor, nota }: { label: string; valor: string; nota?: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-slate-600">{label}</dt>
      <dd className="text-[13px] text-slate-200 mt-0.5 leading-snug">{valor}</dd>
      {nota && <dd className="text-[10px] text-slate-600">{nota}</dd>}
    </div>
  );
}

function Dato({ label, valor, ayuda }: { label: string; valor: string; ayuda?: string }) {
  return (
    <div title={ayuda}>
      <p className="text-[10px] uppercase tracking-wider text-slate-600">{label}</p>
      <p className="text-[15px] text-slate-200 tabular-nums mt-0.5">{valor}</p>
    </div>
  );
}

/** Retornos exactos por período. Es la parte que cuesta un request. */
async function Retornos({ ticker }: { ticker: string }) {
  const { retornos } = await getRetornosDe(ticker);
  const periodos = PERIODOS.filter((p) => p !== "dia");

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-y-3 gap-x-4">
      {periodos.map((p) => (
        <div key={p}>
          <p className="text-[10px] uppercase tracking-wider text-slate-600">
            {PERIODO_LABEL[p]}
          </p>
          <p className={`text-[15px] tabular-nums mt-0.5 ${colorRetorno(retornos[p])}`}>
            {fmtPct(retornos[p])}
          </p>
        </div>
      ))}
    </div>
  );
}

async function Comparacion({ ticker }: { ticker: string }) {
  const comparacion = await getComparacion(ticker);
  if (!comparacion) {
    return <p className="px-[18px] py-4 text-[11px] text-meta-suave">Sin datos comparables.</p>;
  }
  return <PanelComparacion comparacion={comparacion} ticker={ticker} />;
}

async function Sorpresas({ ticker }: { ticker: string }) {
  const { sorpresas } = await getConsenso(ticker);
  return <PanelSorpresas sorpresas={sorpresas} />;
}

async function Consenso({ ticker }: { ticker: string }) {
  const consenso = await getConsenso(ticker);
  return <PanelConsenso consenso={consenso} />;
}

async function Historia({ ticker }: { ticker: string }) {
  const historia = await getHistoriaFinanciera(ticker);
  return <PanelHistoria historia={historia} />;
}

async function Descripcion({ ticker, original }: { ticker: string; original: string }) {
  const es = await traducirDescripcion(ticker, original).catch(() => null);
  return (
    <>
      <p className="text-[12px] leading-relaxed text-slate-300 max-w-[78ch]">
        {es ?? original}
      </p>
      {!es && (
        <p className="text-[10px] text-slate-600 mt-3 max-w-[78ch]">
          No se pudo traducir —la cuota diaria del traductor es acotada—. Este es el
          original de Yahoo.
        </p>
      )}
    </>
  );
}

async function Noticias({ ticker }: { ticker: string }) {
  const noticias = await getNoticias(ticker);
  return <PanelNoticias noticias={noticias} />;
}

// ─── Página ─────────────────────────────────────────────────────────────────

export default async function TickerPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: crudo } = await params;
  const ticker = crudo.toUpperCase();

  if (!POR_TICKER.has(ticker)) notFound();

  const ficha = await getFicha(ticker);
  if (!ficha) notFound();

  const { analistas: ana, earnings } = ficha;
  const upside =
    ana.precioObjetivo && ficha.precio ? (ana.precioObjetivo / ficha.precio - 1) * 100 : null;

  return (
    <div className="mx-auto px-6 pt-6 max-w-[1600px]">
      {/* ── Encabezado ──────────────────────────────────────────────── */}
      <div className="mb-6">
        <Link
          href="/equity"
          className="text-[11px] text-tenue hover:text-secundario transition-colors duration-[120ms]"
        >
          ← Equity
        </Link>

        <div className="flex items-end justify-between gap-6 flex-wrap mt-2">
          <div className="min-w-0 flex items-start gap-3">
            <Logo web={ficha.web} ticker={ficha.ticker} tamaño={44} />
            <div className="min-w-0">
            <h1 className="text-[34px] leading-none font-semibold text-num tracking-[-0.03em]">
              {ficha.ticker}
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">{ficha.nombre}</p>
            <p className="text-[11px] text-slate-600 mt-1.5">
              {SECTOR_LABEL[ficha.sector]}
              {ficha.industria && ` · ${ficha.industria}`}
              {ficha.empleados && ` · ${ficha.empleados.toLocaleString("es-AR")} empleados`}
              {ficha.web && (
                <>
                  {" · "}
                  <a
                    href={ficha.web}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-slate-400 transition-colors underline decoration-slate-800 underline-offset-2"
                  >
                    sitio
                  </a>
                </>
              )}
            </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-3xl font-semibold text-slate-100 tabular-nums">
              {fmtUsd(ficha.precio)}
            </p>
            <p className={`text-sm tabular-nums mt-0.5 ${colorRetorno(ficha.dia)}`}>
              {fmtPct(ficha.dia, 2)} hoy
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        {/* ── Columna principal ─────────────────────────────────────── */}
        <div className="space-y-5 min-w-0">
          <GraficoTradingView ticker={ficha.ticker} />

          <Card titulo="Retornos" nota="sobre cierres diarios">
            <Suspense
              fallback={<div className="h-[46px] animate-pulse bg-slate-900/50 rounded" />}
            >
              <Retornos ticker={ficha.ticker} />
            </Suspense>
          </Card>

          <div className="grid md:grid-cols-2 gap-5">
            <Card titulo="Ventas y márgenes" nota="por año">
              <Suspense fallback={<div className="h-[130px] animate-pulse bg-slate-900/40 rounded" />}>
                <Historia ticker={ficha.ticker} />
              </Suspense>
            </Card>

            <Card titulo="Resultados vs. consenso" nota="últimos trimestres">
              <Suspense fallback={<div className="h-[130px] animate-pulse bg-slate-900/40 rounded" />}>
                <Sorpresas ticker={ficha.ticker} />
              </Suspense>
            </Card>
          </div>

          <Card titulo="A qué se dedica" nota="traducido del original de Yahoo">
            {/* Prosa a la izquierda con el renglón acotado, ficha técnica a la
                derecha: el párrafo solo dejaba medio panel vacío en pantalla
                ancha, y estos datos no tenían dónde vivir. */}
            <div className="grid lg:grid-cols-[minmax(0,1fr)_200px] gap-6">
              <div className="min-w-0">
                {ficha.descripcion ? (
                  <Suspense
                    fallback={<div className="h-24 animate-pulse bg-slate-900/40 rounded" />}
                  >
                    <Descripcion ticker={ficha.ticker} original={ficha.descripcion} />
                  </Suspense>
                ) : (
                  <p className="text-[12px] text-slate-600">Sin descripción disponible.</p>
                )}
              </div>

              <dl className="space-y-3 lg:border-l lg:border-slate-800/60 lg:pl-6">
                {ficha.fundada && (
                  <FichaDato label="Fundada" valor={String(ficha.fundada)}
                    nota={`hace ${new Date().getFullYear() - ficha.fundada} años`} />
                )}
                {ficha.empleados && (
                  <FichaDato label="Empleados" valor={ficha.empleados.toLocaleString("es-AR")} />
                )}
                {ficha.sede && (
                  <FichaDato label="Sede" valor={ficha.sede} nota={ficha.pais ?? undefined} />
                )}
                {ficha.industria && <FichaDato label="Industria" valor={ficha.industria} />}
                <FichaDato label="Sector" valor={SECTOR_LABEL[ficha.sector]} />
              </dl>
            </div>
          </Card>

          {/* Fundamentals y comparables van juntos: partidos, la mediana
              parecía una verdad del sector en vez de el medio de ocho empresas
              concretas que conviene poder mirar una por una. */}
          <Card
            titulo="Fundamentals"
            nota="dónde cae contra cada uno de sus pares"
            cuerpo={false}
            id="fundamentals"
          >
            <Suspense fallback={<div className="h-[420px] animate-pulse bg-card" />}>
              <Comparacion ticker={ficha.ticker} />
            </Suspense>
          </Card>

        </div>

        {/* ── Sidebar ───────────────────────────────────────────────── */}
        <div className="space-y-5">
          <Card titulo="Noticias">
            <Suspense fallback={<div className="h-40 animate-pulse bg-slate-900/40 rounded" />}>
              <Noticias ticker={ficha.ticker} />
            </Suspense>
          </Card>

          <Card titulo="Analistas" nota={ana.cantidad ? `${ana.cantidad} opiniones` : undefined}>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-600">Consenso</p>
                <p className="text-[15px] text-slate-200 mt-0.5">
                  {ana.recomendacion
                    ? RECOMENDACION_LABEL[ana.recomendacion] ?? ana.recomendacion
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-600">
                  Precio objetivo
                </p>
                <p className="text-[15px] text-slate-200 tabular-nums mt-0.5">
                  {fmtUsd(ana.precioObjetivo)}
                  {upside != null && (
                    <span className={`text-[12px] ml-2 ${colorRetorno(upside)}`}>
                      {fmtPct(upside)}
                    </span>
                  )}
                </p>
                {ana.objetivoMin != null && ana.objetivoMax != null && (
                  <p className="text-[10px] text-slate-600 tabular-nums mt-1">
                    rango {fmtUsd(ana.objetivoMin)} – {fmtUsd(ana.objetivoMax)}
                  </p>
                )}
              </div>

              <div className="pt-1 border-t border-slate-800/60">
                <Suspense
                  fallback={<div className="h-[150px] animate-pulse bg-slate-900/40 rounded mt-3" />}
                >
                  <Consenso ticker={ficha.ticker} />
                </Suspense>
              </div>
            </div>
          </Card>

          <Card
            titulo="Próximo earnings"
            nota={earnings.fecha && earnings.estimada ? "fecha estimada" : undefined}
          >
            <div className="space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-600">Fecha</p>
                <p className="text-[15px] text-slate-200 mt-0.5">{fmtFecha(earnings.fecha)}</p>
              </div>
              <div className="grid grid-cols-2 gap-x-4">
                <Dato
                  label="EPS esperado"
                  valor={earnings.epsEsperado != null ? fmtUsd(earnings.epsEsperado) : "—"}
                  ayuda="Ganancia por acción que espera el consenso"
                />
                <Dato
                  label="Ventas esperadas"
                  valor={fmtCap(earnings.ventasEsperadas)}
                  ayuda="Facturación del trimestre que espera el consenso"
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
