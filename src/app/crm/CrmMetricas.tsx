"use client";

import { useMemo } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { computeMetricas, formatUSDCorto, type Cliente } from "@/lib/crm";
import { ETAPA_COLOR } from "@/lib/crm-ui";

/**
 * Métricas del embudo. Se calculan sobre la lista que está en pantalla, así que
 * cambiar una etapa desde la tabla las actualiza al instante.
 */
export default function CrmMetricas({ clientes }: { clientes: Cliente[] }) {
  const m = useMemo(() => computeMetricas(clientes), [clientes]);

  const data = useMemo(
    () => m.porEtapa.map((e) => ({ etapa: e.etapa, cantidad: e.cantidad })),
    [m.porEtapa]
  );

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_320px] items-start mb-6">
      {/* Funnel */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <p className="text-[10px] uppercase tracking-widest text-slate-600">Funnel por etapa</p>
          <p className="text-[10px] text-slate-600 tabular">{m.total} registros</p>
        </div>
        <div className="h-[190px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }}>
              <XAxis type="number" allowDecimals={false} hide />
              <YAxis
                type="category"
                dataKey="etapa"
                width={128}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "rgb(148,163,184)", fontSize: 11 }}
              />
              <Tooltip
                cursor={{ fill: "rgba(148,163,184,0.06)" }}
                contentStyle={{
                  background: "rgb(15,23,42)", border: "1px solid rgb(51,65,85)",
                  borderRadius: 8, fontSize: 12,
                }}
                labelStyle={{ color: "rgb(226,232,240)" }}
                formatter={(v) => {
                  const n = Number(v);
                  return [`${n} ${n === 1 ? "cliente" : "clientes"}`, ""];
                }}
              />
              {/* Sin animación de entrada: si el navegador no la ejecuta (pestaña
                  en segundo plano, prefers-reduced-motion) las barras se quedan
                  en tamaño cero y el funnel aparece vacío. */}
              <Bar dataKey="cantidad" radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false}>
                {data.map((d) => (
                  <Cell key={d.etapa} fill={ETAPA_COLOR[d.etapa]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
        <Tile
          label="AUM potencial"
          valor={formatUSDCorto(m.aumPotencial)}
          nota="todo lo que sigue vivo"
          tone="text-slate-100"
        />
        <Tile
          label="AUM activo"
          valor={formatUSDCorto(m.aumActivo)}
          nota={`${m.activos} ${m.activos === 1 ? "cliente" : "clientes"}`}
          tone="text-emerald-300"
        />
        <Tile
          label="Conversión"
          valor={`${(m.tasaConversion * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`}
          nota={`${m.activos} de ${m.trabajados} trabajados`}
          tone="text-slate-100"
          className="col-span-2 lg:col-span-1"
        />
      </div>
    </div>
  );
}

function Tile({ label, valor, nota, tone, className = "" }: {
  label: string; valor: string; nota: string; tone: string; className?: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 ${className}`}>
      <p className="text-[10px] uppercase tracking-widest text-slate-600 whitespace-nowrap">{label}</p>
      <p className={`text-2xl font-semibold tabular leading-tight mt-0.5 ${tone}`}>{valor}</p>
      <p className="text-[10px] text-slate-600 mt-0.5">{nota}</p>
    </div>
  );
}
