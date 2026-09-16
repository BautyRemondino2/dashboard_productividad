import Card from "@/components/Card";
import { formatValor } from "@/lib/mercado";
import { BLOQUE_LABEL, type BloqueBrief } from "@/lib/morning-brief-config";
import type { IndicadorBrief } from "@/lib/morning-brief-datos";
import type { TipoVariacion } from "@/lib/morning-brief-config";

const ORDEN_BLOQUES: BloqueBrief[] = ["overnight", "tasas_dolar", "riesgo", "commodities", "argentina"];

function formatVariacion(variacion: number, tipo: TipoVariacion): string {
  if (tipo === "pct") return `${variacion >= 0 ? "+" : ""}${variacion.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`;
  return `${variacion >= 0 ? "+" : ""}${variacion.toLocaleString("es-AR", { maximumFractionDigits: 0 })} pb`;
}

function Fila({ ind, tipo }: { ind: IndicadorBrief; tipo: TipoVariacion }) {
  const sinDato = ind.valor == null;
  return (
    <tr className={ind.inusual ? "bg-amber-500/[0.06]" : undefined}>
      <td className="px-[18px] py-2 text-[12.5px] text-cuerpo">
        {ind.label}
        {ind.inusual && (
          <span
            className="ml-1.5 text-[9.5px] px-1.5 py-px rounded-badge border border-amber-700/50 text-amber-400 align-middle"
            title="Variación fuera de lo normal de las últimas 60 ruedas (>2 desvíos)"
          >
            inusual
          </span>
        )}
      </td>
      <td className="px-[18px] py-2 text-[12.5px] text-titulo tabular-nums text-right">
        {sinDato ? <span className="text-meta-suave">s/d</span> : formatValor(ind.valor as number, ind.unidad)}
      </td>
      <td className="px-[18px] py-2 text-[12.5px] tabular-nums text-right">
        {sinDato || ind.variacion == null ? (
          <span className="text-meta-suave">—</span>
        ) : (
          <span className={ind.variacion >= 0 ? "text-sube" : "text-baja"}>{formatVariacion(ind.variacion, tipo)}</span>
        )}
      </td>
      <td className="px-[18px] py-2 text-[11px] text-meta-suave text-right whitespace-nowrap">
        {ind.fecha_dato ?? "sin dato"}
      </td>
    </tr>
  );
}

/** La tabla de indicadores del snapshot, agrupada por bloque en el orden del método de 8 pasos. */
export default function IndicadoresTabla({
  indicadores,
  tiposPorId,
}: {
  indicadores: IndicadorBrief[];
  tiposPorId: Map<string, TipoVariacion>;
}) {
  const porBloque = new Map<BloqueBrief, IndicadorBrief[]>();
  for (const ind of indicadores) {
    const lista = porBloque.get(ind.bloque) ?? [];
    lista.push(ind);
    porBloque.set(ind.bloque, lista);
  }

  return (
    <Card titulo="Indicadores" nota="agrupados en el orden del método" cuerpo={false}>
      {ORDEN_BLOQUES.filter((b) => (porBloque.get(b)?.length ?? 0) > 0).map((bloque) => (
        <table key={bloque} className="w-full border-collapse">
          <thead>
            <tr className="bg-encabezado">
              <th className="px-[18px] py-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.1em] text-tenue">
                {BLOQUE_LABEL[bloque]}
              </th>
              <th className="px-[18px] py-2 text-right text-[10.5px] font-semibold uppercase tracking-[0.1em] text-tenue">
                Valor
              </th>
              <th className="px-[18px] py-2 text-right text-[10.5px] font-semibold uppercase tracking-[0.1em] text-tenue">
                Variación
              </th>
              <th className="px-[18px] py-2 text-right text-[10.5px] font-semibold uppercase tracking-[0.1em] text-tenue">
                Fecha
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divisor-fino">
            {porBloque.get(bloque)!.map((ind) => (
              <Fila key={ind.id} ind={ind} tipo={tiposPorId.get(ind.id) ?? "pct"} />
            ))}
          </tbody>
        </table>
      ))}
    </Card>
  );
}
