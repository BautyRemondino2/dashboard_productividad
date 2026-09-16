import type { AdrBrief } from "@/lib/morning-brief-datos";

function Pct({ v }: { v: number | null }) {
  if (v == null) return <span className="text-meta-suave">—</span>;
  const signo = v > 0 ? "+" : v < 0 ? "−" : "";
  return (
    <span className={v >= 0 ? "text-sube" : "text-baja"}>
      {signo}
      {Math.abs(v).toLocaleString("es-AR", { maximumFractionDigits: 2 })}%
    </span>
  );
}

/**
 * Los ADRs argentinos en Nueva York.
 *
 * El premarket es la columna que importa a las nueve de la mañana: Nueva York
 * abre recién a las 10:30 hora de acá, y lo que se opera antes es la primera
 * traducción de todo lo global a papeles argentinos. Fuera de esa franja la
 * columna queda vacía, que es lo honesto: no hay premarket que mostrar.
 */
export default function Adrs({ adrs }: { adrs: AdrBrief[] }) {
  const hayPremarket = adrs.some((a) => a.premarket != null);

  return (
    <div className="border-t border-divisor">
      <div className="flex items-baseline gap-2 px-[18px] pt-2.5 pb-1">
        <p className="text-[10px] uppercase tracking-[0.1em] text-meta-suave">ADRs en Nueva York</p>
        {!hayPremarket && (
          <span className="text-[10px] text-meta-suave">· sin premarket ahora: se muestra el último cierre</span>
        )}
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="px-[18px] py-1 text-left text-[9.5px] uppercase tracking-[0.08em] text-tenue font-semibold">
              Papel
            </th>
            <th className="px-3 py-1 text-right text-[9.5px] uppercase tracking-[0.08em] text-tenue font-semibold">
              Cierre
            </th>
            <th className="px-3 py-1 text-right text-[9.5px] uppercase tracking-[0.08em] text-tenue font-semibold">
              Día
            </th>
            <th className="px-[18px] py-1 text-right text-[9.5px] uppercase tracking-[0.08em] text-tenue font-semibold">
              Premarket
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divisor-fino">
          {adrs.map((a) => (
            <tr key={a.symbol}>
              <td className="px-[18px] py-1.5 text-[12px] text-cuerpo">
                {a.symbol}
                <span className="text-meta-suave ml-1.5 text-[10.5px]">{a.nombre}</span>
              </td>
              <td className="px-3 py-1.5 text-[12px] text-titulo tabular-nums text-right">
                {a.cierre == null
                  ? <span className="text-meta-suave">s/d</span>
                  : `US$${a.cierre.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </td>
              <td className="px-3 py-1.5 text-[12px] tabular-nums text-right">
                <Pct v={a.variacionCierre} />
              </td>
              <td className="px-[18px] py-1.5 text-[12px] tabular-nums text-right">
                <Pct v={a.variacionPremarket} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
