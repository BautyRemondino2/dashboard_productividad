"use client";

import { useState } from "react";
import Link from "next/link";
import TortaSectores from "./TortaSectores";
import { SECTOR_LABEL } from "@/lib/equity-sectores";
import { colorRetorno, fmtNivel, fmtNumero, fmtPct, fmtUsd } from "@/lib/equity-formato";
import type { Composicion, FamiliaETF } from "@/lib/equity";

const ORDEN: FamiliaETF[] = ["amplios", "sectoriales", "internacionales", "otros"];

const FAMILIA_LABEL: Record<FamiliaETF, string> = {
  amplios: "Índices amplios",
  sectoriales: "Sectoriales de EE.UU.",
  internacionales: "Internacionales",
  otros: "Bonos, oro y temáticos",
};

const FAMILIA_NOTA: Record<FamiliaETF, string> = {
  amplios: "El mercado estadounidense entero, con distintos cortes",
  sectoriales: "Los once sectores del S&P por separado",
  internacionales: "Lo que pasa fuera de Estados Unidos",
  otros: "No son acciones: sirven de contrapeso en una cartera",
};

export default function IndicesClient({
  composiciones,
  objetivos,
}: {
  composiciones: Composicion[];
  /** Objetivo traducido al castellano, por ticker. Vacío si no hay clave de API. */
  objetivos: Record<string, string>;
}) {
  const [abierto, setAbierto] = useState<string | null>(composiciones[0]?.ticker ?? null);
  const activo = composiciones.find((c) => c.ticker === abierto) ?? null;

  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-5 items-start">
      {/* ── Listado por familia ───────────────────────────────────────── */}
      <div className="space-y-5">
        {ORDEN.map((familia) => {
          const items = composiciones.filter((c) => c.familia === familia);
          if (items.length === 0) return null;

          return (
            <section key={familia}>
              <h2 className="text-[11px] font-semibold text-slate-300">
                {FAMILIA_LABEL[familia]}
              </h2>
              <p className="text-[10px] text-slate-600 mb-2">{FAMILIA_NOTA[familia]}</p>

              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/20 divide-y divide-slate-900">
                {items.map((c) => (
                  <button
                    key={c.ticker}
                    onClick={() => setAbierto(c.ticker)}
                    className={`w-full text-left px-3 py-2 transition-colors ${
                      abierto === c.ticker ? "bg-slate-800/60" : "hover:bg-slate-900/50"
                    }`}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-[12px] font-medium text-slate-100 w-12 shrink-0">
                        {c.ticker}
                      </span>
                      <span className="text-[11px] text-slate-400 truncate">{c.nombre}</span>
                      <span className={`text-[11px] tabular-nums ml-auto ${colorRetorno(c.dia)}`}>
                        {fmtPct(c.dia, 2)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* ── Detalle ───────────────────────────────────────────────────── */}
      {activo && (
        <div className="space-y-5 min-w-0">
          <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-5">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="min-w-0">
                <h2 className="text-2xl font-semibold text-slate-100 tracking-tight">
                  {activo.ticker}
                </h2>
                <p className="text-[13px] text-slate-400 mt-0.5">{activo.nombre}</p>
                <p className="text-[11px] text-slate-600 mt-0.5">{activo.detalle}</p>
              </div>

              <div className="text-right">
                <p className="text-2xl font-semibold text-slate-100 tabular-nums">
                  {fmtUsd(activo.precio)}
                </p>
                <p className={`text-[13px] tabular-nums mt-0.5 ${colorRetorno(activo.dia)}`}>
                  {fmtPct(activo.dia, 2)} hoy
                </p>
                <p className={`text-[11px] tabular-nums ${colorRetorno(activo.año)}`}>
                  {fmtPct(activo.año)} en 12 meses
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 pt-4 border-t border-slate-800/60">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-600">
                  Comisión anual
                </p>
                <p className="text-[13px] text-slate-200 tabular-nums mt-0.5">
                  {fmtNivel(activo.gastoAnual, 2)}
                </p>
              </div>
              {activo.tenencias.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-600">
                    Concentración
                  </p>
                  <p
                    className="text-[13px] text-slate-200 tabular-nums mt-0.5"
                    title="Cuánto del fondo explican sus diez mayores tenencias"
                  >
                    {fmtNumero(activo.concentracion)}% en 10 papeles
                  </p>
                </div>
              )}
            </div>

            {objetivos[activo.ticker] && (
              <div className="mt-4 pt-4 border-t border-slate-800/60">
                <p className="text-[10px] uppercase tracking-wider text-slate-600 mb-1.5">
                  A qué le da exposición
                </p>
                <p className="text-[12px] leading-relaxed text-slate-300">
                  {objetivos[activo.ticker]}
                </p>
              </div>
            )}
          </div>

          {activo.sectores.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/20 overflow-hidden">
              <header className="px-4 py-2.5 border-b border-slate-800/80 flex items-baseline gap-2">
                <h3 className="text-[12px] font-semibold text-slate-200">De qué depende</h3>
                <span className="text-[10px] text-slate-600">peso por sector</span>
              </header>

              <div className="p-4 grid md:grid-cols-[auto_1fr] gap-6">
                <TortaSectores sectores={activo.sectores} />

                {/* Los once valores exactos: la torta responde "de qué depende",
                    la tabla responde "cuánto exactamente" */}
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-slate-600 mb-2">
                    Los {activo.sectores.length} sectores
                  </p>
                  <div className="space-y-1">
                    {activo.sectores.map((s) => (
                      <div key={s.sector} className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 w-[116px] shrink-0 truncate">
                          {SECTOR_LABEL[s.sector]}
                        </span>
                        <div className="h-[3px] flex-1 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-slate-500 rounded-full"
                            style={{ width: `${(s.peso / activo.sectores[0].peso) * 100}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-slate-300 tabular-nums w-11 text-right shrink-0">
                          {fmtNumero(s.peso, 1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-900/20 overflow-hidden">
            <header className="px-4 py-2.5 border-b border-slate-800/80 flex items-baseline gap-2">
              <h3 className="text-[12px] font-semibold text-slate-200">Mayores tenencias</h3>
              {activo.tenencias.length > 0 && (
                <span className="text-[10px] text-slate-600">
                  {activo.tenencias.length} papeles = {fmtNumero(activo.concentracion)}% del fondo
                </span>
              )}
            </header>

            <div className="p-4">
              {activo.tenencias.length === 0 ? (
                <p className="text-[11px] text-slate-600">
                  Yahoo no publica tenencias para este fondo. Pasa con los de bonos y
                  materias primas: {activo.ticker} no tiene una cartera de acciones que listar.
                </p>
              ) : (
                <>
                  <div className="space-y-1">
                    {activo.tenencias.map((t) => {
                      const fila = (
                        <>
                          <span className="text-[12px] font-medium text-slate-200 w-16 shrink-0">
                            {t.ticker}
                          </span>
                          <span className="text-[11px] text-slate-500 truncate flex-1">
                            {t.nombre}
                          </span>
                          <div className="h-[3px] w-24 bg-slate-800 rounded-full shrink-0 overflow-hidden">
                            <div
                              className="h-full bg-sky-500/70 rounded-full"
                              style={{
                                width: `${(t.peso / activo.tenencias[0].peso) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-[11px] text-slate-300 tabular-nums w-12 text-right shrink-0">
                            {fmtNumero(t.peso, 2)}%
                          </span>
                        </>
                      );

                      return t.enUniverso ? (
                        <Link
                          key={t.ticker}
                          href={`/equity/${t.ticker}`}
                          className="flex items-center gap-2.5 py-1 px-1 -mx-1 rounded hover:bg-slate-900/60 transition-colors"
                        >
                          {fila}
                        </Link>
                      ) : (
                        <div
                          key={t.ticker}
                          className="flex items-center gap-2.5 py-1"
                          title="No está en el universo del monitor"
                        >
                          {fila}
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-[10px] text-slate-600 mt-3">
                    Yahoo publica las diez mayores de cada fondo, no la cartera completa.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
