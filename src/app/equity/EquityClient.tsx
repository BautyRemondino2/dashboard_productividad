"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Sparkline from "@/components/Sparkline";
import { SECTOR_LABEL, SECTORES, type Sector } from "@/lib/equity-sectores";
import {
  PERIODOS, PERIODO_LABEL, colorRetorno, fmtCap, fmtFecha, fmtNumero, fmtPct, fmtUsd,
} from "@/lib/equity-formato";
import type { FilaConRetornos, Periodo } from "@/lib/equity-formato";

/** Un tono por sector, para que el ojo agrupe sin leer la etiqueta. */
const SECTOR_HUE: Record<Sector, number> = {
  "Communication Services": 320,
  "Consumer Discretionary": 30,
  "Consumer Staples": 90,
  Energy: 60,
  Financials: 230,
  "Health Care": 170,
  Industrials: 250,
  "Information Technology": 200,
  Materials: 120,
  "Real Estate": 350,
  Utilities: 280,
};

const sectorColor = (s: Sector, l = 65) => `oklch(${l}% 0.11 ${SECTOR_HUE[s]})`;

/** Valor del período en una fila: "dia" vive arriba, el resto en `retornos`. */
function valorPeriodo(f: FilaConRetornos, p: Periodo): number | null {
  return p === "dia" ? f.dia : f.retornos[p];
}

export default function EquityClient({ filas }: { filas: FilaConRetornos[] }) {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [subiendo, setSubiendo] = useState(true);
  const [sector, setSector] = useState<Sector | "todos">("todos");
  const [busqueda, setBusqueda] = useState("");

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas
      .filter((f) => sector === "todos" || f.sector === sector)
      .filter(
        (f) =>
          !q || f.ticker.toLowerCase().includes(q) || f.nombre.toLowerCase().includes(q)
      )
      .filter((f) => valorPeriodo(f, periodo) != null)
      .sort((a, b) => {
        const va = valorPeriodo(a, periodo)!;
        const vb = valorPeriodo(b, periodo)!;
        return subiendo ? vb - va : va - vb;
      });
  }, [filas, periodo, subiendo, sector, busqueda]);

  // Los sectores que realmente aparecen en el ranking, no los 11 siempre
  const sectoresPresentes = useMemo(
    () => SECTORES.filter((s) => filas.some((f) => f.sector === s)),
    [filas]
  );

  return (
    <div className="space-y-4">
      {/* ── Controles ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-1">
          {PERIODOS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`text-[11px] px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${
                periodo === p
                  ? "bg-slate-800 text-slate-100 font-medium"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {PERIODO_LABEL[p]}
            </button>
          ))}
        </div>

        <button
          onClick={() => setSubiendo((v) => !v)}
          className="text-[11px] px-2.5 py-1 rounded-md border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors whitespace-nowrap"
        >
          {subiendo ? "↑ los que más subieron" : "↓ los que más bajaron"}
        </button>

        <div className="flex items-center gap-2 ml-auto">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="ticker o empresa…"
            className="bg-slate-900 border border-slate-800 focus:border-slate-600 outline-none rounded-md px-2.5 py-1 text-[11px] text-slate-300 w-40 placeholder:text-slate-700"
          />
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value as Sector | "todos")}
            className="bg-slate-900 border border-slate-800 focus:border-slate-600 outline-none rounded-md px-2 py-1 text-[11px] text-slate-300 [color-scheme:dark]"
          >
            <option value="todos">Todos los sectores</option>
            {sectoresPresentes.map((s) => (
              <option key={s} value={s}>
                {SECTOR_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Tabla ─────────────────────────────────────────────────────── */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/20">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse">
            <thead>
              <tr className="bg-slate-900/60 border-b border-slate-800 text-[10px] uppercase tracking-widest text-slate-500">
                <th className="text-left font-normal pl-4 pr-2 py-2 w-10">#</th>
                <th className="text-left font-normal px-2 py-2">Empresa</th>
                <th className="text-right font-normal px-2 py-2">Precio</th>
                {PERIODOS.map((p) => (
                  <th
                    key={p}
                    onClick={() => setPeriodo(p)}
                    className={`text-right font-normal px-2 py-2 cursor-pointer transition-colors whitespace-nowrap ${
                      periodo === p ? "text-slate-200 bg-slate-800/50" : "hover:text-slate-300"
                    }`}
                  >
                    {PERIODO_LABEL[p]}
                  </th>
                ))}
                <th className="text-right font-normal px-2 py-2 whitespace-nowrap">Tendencia 6m</th>
                <th className="text-right font-normal px-2 py-2">PER</th>
                <th className="text-right font-normal px-2 py-2">Cap.</th>
                <th className="text-right font-normal pl-2 pr-4 py-2 whitespace-nowrap">
                  Earnings
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {visibles.map((f, i) => (
                <tr key={f.ticker} className="group hover:bg-slate-900/40 transition-colors">
                  <td className="pl-4 pr-2 py-2 text-[11px] text-slate-600 tabular-nums">
                    {i + 1}
                  </td>

                  <td className="px-2 py-2">
                    <Link href={`/equity/${f.ticker}`} className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-[3px] h-7 rounded-full shrink-0"
                        style={{ background: sectorColor(f.sector) }}
                        title={SECTOR_LABEL[f.sector]}
                      />
                      <span className="min-w-0">
                        <span className="text-[13px] font-medium text-slate-100 group-hover:text-white">
                          {f.ticker}
                        </span>
                        <span className="block text-[10px] text-slate-600 truncate max-w-[190px]">
                          {f.nombre}
                        </span>
                      </span>
                    </Link>
                  </td>

                  <td className="px-2 py-2 text-right text-[12px] text-slate-300 tabular-nums">
                    {fmtUsd(f.precio)}
                  </td>

                  {PERIODOS.map((p) => {
                    const v = valorPeriodo(f, p);
                    return (
                      <td
                        key={p}
                        className={`px-2 py-2 text-right text-[12px] tabular-nums ${colorRetorno(v)} ${
                          periodo === p ? "bg-slate-800/30 font-semibold" : ""
                        }`}
                      >
                        {fmtPct(v)}
                      </td>
                    );
                  })}

                  <td className="px-2 py-2">
                    <div className="flex justify-end">
                      <Sparkline
                        data={f.chispa}
                        color={
                          (f.retornos.seis ?? 0) >= 0 ? "oklch(72% 0.16 155)" : "oklch(68% 0.19 20)"
                        }
                      />
                    </div>
                  </td>

                  <td className="px-2 py-2 text-right text-[11px] text-slate-400 tabular-nums">
                    {fmtNumero(f.per)}
                  </td>

                  <td className="px-2 py-2 text-right text-[11px] text-slate-400 tabular-nums whitespace-nowrap">
                    {fmtCap(f.capitalizacion)}
                  </td>

                  <td className="pl-2 pr-4 py-2 text-right text-[11px] tabular-nums whitespace-nowrap">
                    <span className={f.earningsEstimado ? "text-slate-600" : "text-slate-400"}>
                      {fmtFecha(f.proximoEarnings)}
                    </span>
                    {f.proximoEarnings && f.earningsEstimado && (
                      <span className="text-[9px] text-slate-700 ml-1" title="Fecha estimada por Yahoo, sin confirmar por la empresa">
                        est.
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {visibles.length === 0 && (
          <div className="px-4 py-8 text-center text-[12px] text-slate-600">
            Ninguna empresa del ranking coincide con el filtro.
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-600 leading-relaxed">
        {visibles.length} de {filas.length} empresas · Los porcentajes son retornos reales
        calculados sobre cierres diarios de Yahoo Finance, no distancia a medias móviles.
        El PER es <em>trailing</em> (últimos 12 meses).
      </p>
    </div>
  );
}
