import Card from "@/components/Card";
import type { BriefRow } from "@/lib/morning-brief-db";

const PUNTAJE_TESIS: Record<string, number> = { si: 1, parcial: 0.5, no: 0 };

function pct(n: number): string {
  return `${(n * 100).toLocaleString("es-AR", { maximumFractionDigits: 0 })}%`;
}

/** Historial de briefs con la tasa de aciertos propia contra la de Claude. */
export default function Historial({ filas }: { filas: BriefRow[] }) {
  if (filas.length === 0) return null;

  const evaluadasClaude = filas.filter((f) => f.total_predicciones != null && f.total_predicciones > 0);
  const totalClaude = evaluadasClaude.reduce((a, f) => a + (f.total_predicciones ?? 0), 0);
  const aciertosClaude = evaluadasClaude.reduce((a, f) => a + (f.aciertos ?? 0), 0);
  const tasaClaude = totalClaude > 0 ? aciertosClaude / totalClaude : null;

  const evaluadasPropia = filas.filter((f) => f.tesis_acierto != null);
  const tasaPropia =
    evaluadasPropia.length > 0
      ? evaluadasPropia.reduce((a, f) => a + PUNTAJE_TESIS[f.tesis_acierto as string], 0) / evaluadasPropia.length
      : null;

  return (
    <Card
      titulo="Historial"
      nota={
        tasaClaude != null && tasaPropia != null
          ? `vos ${pct(tasaPropia)} · Claude ${pct(tasaClaude)}`
          : "se completa a medida que se evalúan los cierres"
      }
      cuerpo={false}
    >
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-encabezado">
            <th className="px-[18px] py-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.1em] text-tenue">Fecha</th>
            <th className="px-[18px] py-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.1em] text-tenue">Régimen</th>
            <th className="px-[18px] py-2 text-right text-[10.5px] font-semibold uppercase tracking-[0.1em] text-tenue">Tu tesis</th>
            <th className="px-[18px] py-2 text-right text-[10.5px] font-semibold uppercase tracking-[0.1em] text-tenue">Claude</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divisor-fino">
          {filas.map((f) => (
            <tr key={f.fecha}>
              <td className="px-[18px] py-2 text-[12px] text-cuerpo tabular-nums">{f.fecha}</td>
              <td className="px-[18px] py-2 text-[12px] text-secundario">{f.brief?.regimen ?? "—"}</td>
              <td className="px-[18px] py-2 text-[12px] text-right tabular-nums">
                {f.tesis_acierto == null ? (
                  <span className="text-meta-suave">sin evaluar</span>
                ) : (
                  <span className={PUNTAJE_TESIS[f.tesis_acierto] === 1 ? "text-sube" : PUNTAJE_TESIS[f.tesis_acierto] === 0 ? "text-baja" : "text-secundario"}>
                    {f.tesis_acierto === "si" ? "acertó" : f.tesis_acierto === "parcial" ? "parcial" : "no acertó"}
                  </span>
                )}
              </td>
              <td className="px-[18px] py-2 text-[12px] text-right tabular-nums">
                {f.total_predicciones == null ? (
                  <span className="text-meta-suave">sin evaluar</span>
                ) : (
                  `${f.aciertos ?? 0}/${f.total_predicciones}`
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
