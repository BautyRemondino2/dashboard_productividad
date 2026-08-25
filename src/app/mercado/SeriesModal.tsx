"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import Link from "next/link";
import { computePanelIndicator, formatDelta, formatValor, LOWER_IS_BETTER } from "@/lib/mercado";
import type { MarketInstrument, MarketSeriesPoint } from "@/lib/mercado";
import { hrefGlosario, type InstrumentoDef } from "@/lib/glosario-instrumentos";

const RANGOS = [
  { key: "30",  label: "30d",  dias: 30 },
  { key: "90",  label: "90d",  dias: 90 },
  { key: "365", label: "1 año", dias: 365 },
  { key: "all", label: "Todo", dias: Infinity },
] as const;

function formatFechaEje(fecha: string): string {
  const [, m, d] = fecha.split("-");
  return `${d}/${m}`;
}

function formatFechaLarga(fecha: string): string {
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const [y, m, d] = fecha.split("-");
  return `${d} ${meses[Number(m) - 1]} ${y}`;
}

export default function SeriesModal({ inst, serie, def, onClose }: {
  inst: MarketInstrument;
  serie: MarketSeriesPoint[];
  def?: InstrumentoDef;
  onClose: () => void;
}) {
  const [rango, setRango] = useState<string>("90");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const data = useMemo(() => {
    const dias = RANGOS.find((r) => r.key === rango)?.dias ?? 90;
    if (dias === Infinity) return serie;

    // El rango se cuenta desde el último dato y no desde el reloj: si el último
    // cierre es del viernes y esto se abre un domingo, "30 días" tiene que
    // significar treinta días de datos, no veintiocho. De paso saca el
    // `Date.now()` de adentro del memo, que el compilador marca como impuro.
    const ancla = serie.at(-1)?.fecha;
    if (!ancla) return serie;

    const corte = new Date(Date.parse(ancla) - dias * 86_400_000).toISOString().slice(0, 10);
    const filtrado = serie.filter((p) => p.fecha >= corte);
    // Series mensuales (IPC) pueden quedar con 1 punto en rangos cortos
    return filtrado.length >= 2 ? filtrado : serie.slice(-2);
  }, [serie, rango]);

  const ind = useMemo(() => computePanelIndicator(data), [data]);
  const lower = LOWER_IS_BETTER.has(inst.ticker);

  const primero = data[0]?.valor ?? 0;
  const ultimo = data[data.length - 1]?.valor ?? 0;
  const sube = ultimo >= primero;
  const bueno = lower ? !sube : sube;
  const color = bueno ? "rgb(52,211,153)" : "rgb(248,113,113)";

  const valores = data.map((p) => p.valor);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const pad = (max - min) * 0.12 || Math.abs(max) * 0.05 || 1;

  // Variación del rango visible, que es lo que el gráfico está mostrando
  const variacion = primero !== 0 ? (ultimo / primero - 1) * 100 : null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-3xl bg-boton border border-outline rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-borde flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-secundario border border-outline/60">
                {inst.ticker}
              </span>
              <span className="text-[10px] text-meta-suave">
                {serie.length} {serie.length === 1 ? "dato" : "datos"}
              </span>
            </div>
            <h2 className="text-xl font-semibold text-titulo tracking-tight">{inst.nombre}</h2>
            <div className="flex items-baseline gap-3 mt-1.5 flex-wrap">
              <span className="text-2xl font-semibold text-titulo tabular-nums">
                {ind.last ? formatValor(ind.last.valor, inst.unidad) : "—"}
              </span>
              {variacion !== null && (
                <span className={`text-[13px] tabular-nums font-medium ${bueno ? "text-sube" : "text-baja"}`}>
                  {sube ? "▲" : "▼"} {Math.abs(variacion).toLocaleString("es-AR", { maximumFractionDigits: 2 })}%
                  <span className="text-meta-suave font-normal"> en el rango</span>
                </span>
              )}
              {ind.last && (
                <span className="text-[11px] text-meta-suave">al {formatFechaLarga(ind.last.fecha)}</span>
              )}
            </div>
            {def && (
              <p className="text-[12px] text-secundario leading-relaxed mt-2.5 text-pretty">
                {def.short}{" "}
                <Link href={hrefGlosario(def.term)} className="text-cuerpo hover:text-titulo whitespace-nowrap transition-colors">
                  Ver en glosario →
                </Link>
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-meta hover:text-cuerpo hover:bg-slate-800 transition-colors"
            title="Cerrar (Esc)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </div>

        {/* Rango */}
        <div className="px-6 pt-3 flex items-center gap-1.5">
          {RANGOS.map((r) => (
            <button
              key={r.key}
              onClick={() => setRango(r.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                rango === r.key
                  ? "bg-slate-700/70 text-titulo"
                  : "text-meta hover:text-cuerpo hover:bg-slate-800/60"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Gráfico */}
        <div className="px-3 pt-3 pb-2 h-[320px]">
          {data.length < 2 ? (
            <div className="h-full flex items-center justify-center text-[12px] text-meta-suave">
              Falta historia para graficar — hacen falta al menos dos datos.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                <defs>
                  <linearGradient id="serieFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgb(30,41,59)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="fecha"
                  tickFormatter={formatFechaEje}
                  tick={{ fill: "rgb(100,116,139)", fontSize: 10 }}
                  stroke="rgb(51,65,85)"
                  minTickGap={40}
                />
                <YAxis
                  domain={[min - pad, max + pad]}
                  tickFormatter={(v: number) => formatValor(v, inst.unidad)}
                  tick={{ fill: "rgb(100,116,139)", fontSize: 10 }}
                  stroke="rgb(51,65,85)"
                  width={78}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgb(15,23,42)",
                    border: "1px solid rgb(51,65,85)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "rgb(148,163,184)", fontSize: 11, marginBottom: 2 }}
                  labelFormatter={(l) => (typeof l === "string" ? formatFechaLarga(l) : "")}
                  formatter={(v) => [
                    typeof v === "number" ? formatValor(v, inst.unidad) : String(v ?? "—"),
                    inst.nombre,
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="valor"
                  stroke={color}
                  strokeWidth={1.8}
                  fill="url(#serieFill)"
                  dot={false}
                  activeDot={{ r: 3.5, fill: color }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Deltas del rango visible */}
        <div className="px-6 py-3 border-t border-borde grid grid-cols-3 gap-3">
          {([
            ["vs. anterior", ind.dPrev],
            ["30 días", ind.d30],
            ["90 días", ind.d90],
          ] as const).map(([label, d]) => {
            if (!d) {
              return (
                <div key={label}>
                  <p className="text-[9px] uppercase tracking-widest text-meta-suave mb-0.5">{label}</p>
                  <p className="text-[13px] text-slate-700 tabular-nums">—</p>
                </div>
              );
            }
            const up = d.abs > 0;
            const flat = d.abs === 0;
            const good = lower ? !up : up;
            return (
              <div key={label}>
                <p className="text-[9px] uppercase tracking-widest text-meta-suave mb-0.5">{label}</p>
                <p className={`text-[13px] tabular-nums font-medium ${
                  flat ? "text-meta" : good ? "text-sube" : "text-baja"
                }`}>
                  {flat ? "=" : up ? "▲" : "▼"} {formatDelta(d, inst.unidad)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
