"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from "recharts";
import type { PuntoOn } from "@/lib/bonos";

/**
 * Curva de obligaciones negociables en dólares.
 *
 * Mismo eje que la de soberanos —TIR contra duration— para que se puedan
 * comparar de un vistazo: lo que una ON rinde por encima del soberano de igual
 * plazo es lo que se cobra por el riesgo de la empresa en vez del riesgo país.
 *
 * A diferencia de los soberanos, acá los puntos no se unen con una línea: son
 * cincuenta emisores distintos y unirlos sugeriría una curva única que no
 * existe. Se dibuja la nube y encima el ajuste, que sí es la referencia.
 */

const COLOR = "#199e70";
const REFERENCIA = "#3987e5";

/**
 * Debajo de este plazo la TIR anualizada deja de ser comparable.
 *
 * A tres meses del vencimiento, un peso de diferencia en el precio mueve el
 * rendimiento anualizado varios puntos: una ON de Banco Galicia a 98,10 daba
 * 20% anual. El número no está mal calculado, pero es frágil y arriba de la
 * nube parece una oportunidad cuando es ruido de liquidez.
 */
const DURATION_FRAGIL = 0.5;

const fmt = (v: number, d = 2) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function CurvaOns({
  puntos,
  soberanos,
}: {
  puntos: PuntoOn[];
  /** La curva soberana, para ver el spread corporativo. */
  soberanos: { duration: number; tir: number; ticker: string }[];
}) {
  const [activo, setActivo] = useState<string | null>(null);

  const punto = activo ? puntos.find((p) => p.ticker === activo) : null;

  /** Interpola la curva soberana para comparar a igual duration. */
  const soberanoEn = useMemo(() => {
    const orden = [...soberanos].sort((a, b) => a.duration - b.duration);
    return (d: number) => {
      if (orden.length === 0) return null;
      if (d <= orden[0].duration) return orden[0].tir;
      if (d >= orden[orden.length - 1].duration) return orden[orden.length - 1].tir;
      for (let i = 1; i < orden.length; i++) {
        if (d <= orden[i].duration) {
          const a = orden[i - 1], b = orden[i];
          const t = (d - a.duration) / (b.duration - a.duration || 1);
          return a.tir + t * (b.tir - a.tir);
        }
      }
      return null;
    };
  }, [soberanos]);

  if (puntos.length === 0) {
    return <p className="text-[12px] text-slate-600">Sin precios de ONs en este momento.</p>;
  }

  const tirs = puntos.map((p) => p.tir);
  const min = Math.floor(Math.min(...tirs, ...soberanos.map((s) => s.tir)) - 1);
  const max = Math.ceil(Math.max(...tirs) + 1);
  const spread = punto ? (soberanoEn(punto.duration) ?? null) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-5 flex-wrap">
        <span className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR }} />
          <span className="text-[11px] text-slate-400">Obligaciones negociables</span>
          <span className="text-[10px] text-slate-600">{puntos.length}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full border border-dashed border-slate-500" />
          <span className="text-[11px] text-slate-500">
            a menos de 6 meses
          </span>
          <span className="text-[10px] text-slate-600">
            {puntos.filter((p) => p.duration < DURATION_FRAGIL).length}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-[3px] rounded-full" style={{ background: REFERENCIA }} />
          <span className="text-[11px] text-slate-400">Soberanos ley NY, de referencia</span>
        </span>
      </div>

      <div className="h-[300px] -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="2 4" />
            <XAxis
              type="number" dataKey="duration" domain={[0, "dataMax + 0.4"]}
              tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false}
              axisLine={{ stroke: "#1e293b" }} tickFormatter={(v: number) => `${fmt(v, 1)}a`}
            />
            <YAxis
              type="number" dataKey="tir" domain={[min, max]}
              tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false}
              axisLine={{ stroke: "#1e293b" }} tickFormatter={(v: number) => `${v}%`} width={42}
            />
            <ZAxis range={[60, 60]} />

            {/* La soberana va primero para que quede por debajo de la nube */}
            <Scatter
              data={soberanos}
              line={{ stroke: REFERENCIA, strokeWidth: 2 }}
              lineType="joint"
              isAnimationActive={false}
              shape={() => <g />}
            />

            <Scatter
              data={puntos}
              isAnimationActive={false}
              shape={(props: unknown) => {
                const { cx, cy, payload } = props as { cx: number; cy: number; payload: PuntoOn };
                const esta = activo === payload.ticker;
                return (
                  <g
                    onMouseEnter={() => setActivo(payload.ticker)}
                    onMouseLeave={() => setActivo(null)}
                    style={{ cursor: "pointer" }}
                  >
                    <circle cx={cx} cy={cy} r={12} fill="transparent" />
                    <circle
                      cx={cx} cy={cy} r={esta ? 6 : 4}
                      fill={payload.duration < DURATION_FRAGIL ? "#64748b" : COLOR}
                      stroke="#020617" strokeWidth={1.5}
                      strokeDasharray={payload.duration < DURATION_FRAGIL ? "2 2" : undefined}
                      opacity={activo && !esta ? 0.45 : 1}
                    />
                    {esta && (
                      <text x={cx} y={cy - 11} textAnchor="middle" fill="#e2e8f0" fontSize={10}>
                        {payload.ticker}
                      </text>
                    )}
                  </g>
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="min-h-[46px] rounded-lg border border-slate-800 bg-slate-900/30 px-4 py-2.5">
        {punto ? (
          <div className="flex items-baseline gap-x-6 gap-y-1 flex-wrap">
            <span className="text-[13px] font-semibold text-slate-100">{punto.ticker}</span>
            <span className="text-[11px] text-slate-500">{punto.emisor}</span>
            <span className="text-[11px] text-slate-400">
              precio <span className="text-slate-200 tabular-nums">US${fmt(punto.precio)}</span>
            </span>
            <span className="text-[11px] text-slate-400">
              TIR <span className="text-slate-200 tabular-nums">{fmt(punto.tir)}%</span>
            </span>
            <span className="text-[11px] text-slate-400">
              duration <span className="text-slate-200 tabular-nums">{fmt(punto.duration)} años</span>
            </span>
            <span className="text-[11px] text-slate-400">
              vence <span className="text-slate-200 tabular-nums">{punto.vencimiento}</span>
            </span>
            {punto.duration < DURATION_FRAGIL && (
              <span className="text-[10px] text-amber-500/90">
                a {Math.round(punto.duration * 12)} meses: la TIR anualizada se mueve mucho con el precio
              </span>
            )}
            {spread != null && (
              <span
                className="text-[11px] text-slate-400"
                title="Diferencia contra el soberano de la misma duration. En Argentina lo habitual es que una buena empresa rinda menos que el Estado."
              >
                vs. soberano{" "}
                {/* Sin color: rendir menos que el soberano no es malo. Acá es lo
                    normal para un emisor de buen crédito */}
                <span className="tabular-nums text-slate-200">
                  {punto.tir - spread > 0 ? "+" : ""}{Math.round((punto.tir - spread) * 100)} pb
                </span>
              </span>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-slate-600">
            Pasá el mouse por un punto. La línea azul son los soberanos ley NY. Que una ON
            rinda por debajo es habitual en Argentina: el Estado tiene historial de default
            y las buenas empresas no.
          </p>
        )}
      </div>
    </div>
  );
}
