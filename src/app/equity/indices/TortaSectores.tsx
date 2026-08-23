"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { SECTOR_LABEL } from "@/lib/equity-sectores";
import { fmtNumero } from "@/lib/equity-formato";
import type { Sector } from "@/lib/equity-sectores";

/**
 * Composición sectorial de un fondo.
 *
 * Once sectores en una torta sería ilegible: con porciones del 2% y del 3%
 * pegadas, el ojo no distingue nada y hacen falta once colores que ningún
 * daltónico puede separar. Se muestran los seis mayores y el resto se agrupa en
 * "Otros" — el gráfico responde "de qué depende este fondo" de un vistazo, y la
 * lista de al lado tiene los once valores exactos.
 *
 * Los seis colores están validados contra el fondo del dashboard: separación
 * para daltonismo por encima del umbral en todos los pares vecinos del anillo.
 * "Otros" va gris a propósito: es un resto, no una categoría más.
 */
const COLORES = [
  "#3987e5", // azul
  "#d95926", // naranja
  "#199e70", // aguamarina
  "#c98500", // amarillo
  "#d55181", // magenta
  "#9085e9", // violeta
];
const GRIS_OTROS = "#64748b";

const VISIBLES = 6;

export default function TortaSectores({
  sectores,
}: {
  sectores: { sector: Sector; peso: number }[];
}) {
  if (sectores.length === 0) return null;

  const mayores = sectores.slice(0, VISIBLES);
  const resto = sectores.slice(VISIBLES);
  const pesoResto = resto.reduce((total, s) => total + s.peso, 0);

  const datos = [
    ...mayores.map((s, i) => ({
      nombre: SECTOR_LABEL[s.sector],
      peso: s.peso,
      color: COLORES[i],
    })),
    ...(pesoResto > 0
      ? [{
          nombre: `Otros ${resto.length} sectores`,
          peso: pesoResto,
          color: GRIS_OTROS,
        }]
      : []),
  ];

  return (
    <div className="flex items-center gap-5">
      <div className="w-[168px] h-[168px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={datos}
              dataKey="peso"
              nameKey="nombre"
              innerRadius={48}
              outerRadius={80}
              startAngle={90}
              endAngle={-270}
              // Separación entre porciones: sin esto dos tonos vecinos se leen
              // como una sola mancha
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {datos.map((d) => (
                <Cell key={d.nombre} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Referencia con etiqueta directa: la identidad nunca depende del color solo */}
      <ul className="space-y-1.5 min-w-0">
        {datos.map((d) => (
          <li key={d.nombre} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ background: d.color }}
            />
            <span className="text-[11px] text-slate-400 truncate">{d.nombre}</span>
            <span className="text-[11px] text-slate-300 tabular-nums ml-auto pl-2">
              {fmtNumero(d.peso, 0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
