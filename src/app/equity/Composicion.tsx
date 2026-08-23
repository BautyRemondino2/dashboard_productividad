"use client";

import { useState } from "react";
import Link from "next/link";
import { SECTOR_LABEL } from "@/lib/equity-sectores";
import { colorRetorno, fmtNumero, fmtPct, fmtUsd } from "@/lib/equity-formato";
import type { Composicion } from "@/lib/equity";

/**
 * De qué está hecho cada índice.
 *
 * Los pesos vienen de Yahoo, que da las diez mayores tenencias de cada fondo.
 * En SPY esas diez son más de un tercio del total, así que se muestra la
 * concentración para que no parezca que ese es el fondo entero.
 */
export default function PanelComposicion({ composiciones }: { composiciones: Composicion[] }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const activo = composiciones.find((c) => c.ticker === abierto) ?? null;

  if (composiciones.length === 0) return null;

  return (
    <section className="border border-slate-800 rounded-xl bg-slate-900/20 overflow-hidden">
      <div className="flex flex-wrap">
        {composiciones.map((c) => {
          const seleccionado = abierto === c.ticker;
          return (
            <button
              key={c.ticker}
              onClick={() => setAbierto(seleccionado ? null : c.ticker)}
              className={`flex-1 min-w-[168px] text-left px-4 py-3 border-r last:border-r-0 border-slate-800 transition-colors ${
                seleccionado ? "bg-slate-800/50" : "hover:bg-slate-900/50"
              }`}
            >
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-semibold text-slate-100">{c.ticker}</span>
                <span className="text-[10px] text-slate-500 truncate">{c.nombre}</span>
                <span className={`text-[11px] tabular-nums ml-auto ${colorRetorno(c.dia)}`}>
                  {fmtPct(c.dia, 2)}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {fmtUsd(c.precio)}
                </span>
                <span className="text-[10px] text-slate-600">
                  {seleccionado ? "ocultar composición" : "ver composición"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {activo && (
        <div className="border-t border-slate-800 p-4 grid md:grid-cols-[1fr_260px] gap-6">
          {/* Mayores tenencias */}
          <div>
            <div className="flex items-baseline gap-2 mb-2.5">
              <h3 className="text-[11px] uppercase tracking-wider text-slate-500">
                Mayores tenencias
              </h3>
              <span className="text-[10px] text-slate-600">
                {activo.tenencias.length} papeles ={" "}
                {fmtNumero(activo.concentracion)}% del fondo
              </span>
            </div>

            <div className="space-y-1">
              {activo.tenencias.map((t) => {
                const fila = (
                  <>
                    <span className="text-[12px] font-medium text-slate-200 w-14 shrink-0">
                      {t.ticker}
                    </span>
                    <span className="text-[11px] text-slate-500 truncate flex-1">{t.nombre}</span>
                    <div className="h-[3px] w-20 bg-slate-800 rounded-full shrink-0 overflow-hidden">
                      <div
                        className="h-full bg-sky-500/70 rounded-full"
                        // Escala relativa a la mayor tenencia: en un fondo parejo
                        // todas las barras al 3% serían invisibles
                        style={{ width: `${(t.peso / activo.tenencias[0].peso) * 100}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-slate-400 tabular-nums w-12 text-right shrink-0">
                      {fmtNumero(t.peso, 2)}%
                    </span>
                  </>
                );

                return t.enUniverso ? (
                  <Link
                    key={t.ticker}
                    href={`/equity/${t.ticker}`}
                    className="flex items-center gap-2.5 py-0.5 rounded hover:bg-slate-900/60 transition-colors"
                  >
                    {fila}
                  </Link>
                ) : (
                  <div
                    key={t.ticker}
                    className="flex items-center gap-2.5 py-0.5"
                    title="No está en el universo del monitor"
                  >
                    {fila}
                  </div>
                );
              })}
            </div>

            <p className="text-[10px] text-slate-600 mt-3">
              Yahoo publica las diez mayores de cada fondo, no la cartera completa.
              El resto se reparte entre el resto de los papeles del índice.
            </p>
          </div>

          {/* Peso por sector */}
          <div>
            <h3 className="text-[11px] uppercase tracking-wider text-slate-500 mb-2.5">
              Peso por sector
            </h3>
            {activo.sectores.length === 0 ? (
              <p className="text-[11px] text-slate-600">Sin datos sectoriales.</p>
            ) : (
              <div className="space-y-1.5">
                {activo.sectores.map((s) => (
                  <div key={s.sector} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 w-[104px] shrink-0 truncate">
                      {SECTOR_LABEL[s.sector]}
                    </span>
                    <div className="h-[3px] flex-1 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-500 rounded-full"
                        style={{ width: `${(s.peso / activo.sectores[0].peso) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 tabular-nums w-9 text-right shrink-0">
                      {fmtNumero(s.peso, 0)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
