import type { SerieSec } from "@/lib/sec";
import { fmtCap, fmtNivel, fmtNumero, fmtUsd } from "@/lib/equity-formato";
import Fuente from "@/components/Fuente";
import { CREDITOS } from "@/lib/fuentes-credito";

/**
 * La historia larga: los ejercicios como los presentó la empresa ante la SEC.
 *
 * El cuadro de arriba sale de Yahoo y llega a cinco años, que es todo lo que
 * Yahoo publica. Cinco puntos alcanzan para ver el último ciclo y no para ver
 * si la empresa atravesó uno: qué hizo en 2008, si el margen de hoy es el
 * normal o el bueno, cuántas acciones emitió en veinte años.
 *
 * Son menos filas que el cuadro de Yahoo a propósito. Sólo entran las métricas
 * cuyo concepto XBRL es estable y verificable —ventas, resultado, caja,
 * patrimonio, acciones—. El EBITDA y el ROIC no son conceptos que la empresa
 * reporte sino cuentas que cada analista arma distinto: reconstruirlas de
 * veinte etiquetas sería inventar precisión, y para eso ya está el cuadro de
 * arriba, que llega a cinco años pero viene calculado.
 */

const fmtMonto = (v: number | null): string =>
  v == null ? "—" : v < 0 ? `−${fmtCap(Math.abs(v))}` : fmtCap(v);

const fmtAcciones = (v: number | null): string =>
  v == null ? "—" : `${fmtNumero(v / 1e6, 0)} M`;

function tono(valor: number | null, bueno: (v: number) => boolean): string {
  if (valor == null) return "text-slate-500";
  return bueno(valor) ? "text-sube" : "text-baja";
}

export default function HistoriaLarga({ serie }: { serie: SerieSec }) {
  const e = serie.ejercicios;

  if (e.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-[12px] text-meta leading-relaxed max-w-[92ch]">
          {serie.problema ?? "La SEC no devuelve ejercicios para este papel."}
        </p>
        <Fuente creditos={[CREDITOS.sec]} />
      </div>
    );
  }

  const col = <T,>(f: (x: (typeof e)[number]) => T) => e.map(f);

  const filas: { label: string; ayuda?: string; valores: string[]; clases?: (string | undefined)[]; destacada?: boolean }[] = [
    { label: "Ventas", valores: col((x) => fmtMonto(x.ventas)), destacada: true },
    {
      label: "Crec. %",
      valores: col((x) => (x.crecimiento == null ? "—" : fmtNivel(x.crecimiento, 0))),
      clases: col((x) => tono(x.crecimiento, (v) => v > 0)),
    },
    { label: "Res. neto", valores: col((x) => fmtMonto(x.neto)) },
    {
      label: "Margen neto",
      valores: col((x) => (x.margenNeto == null ? "—" : fmtNivel(x.margenNeto, 0))),
      clases: col((x) => tono(x.margenNeto, (v) => v > 0)),
    },
    { label: "FCO", ayuda: "Flujo de caja operativo", valores: col((x) => fmtMonto(x.fco)) },
    { label: "Capex", valores: col((x) => fmtMonto(x.capex)) },
    { label: "FCF", ayuda: "Caja libre: FCO menos capex", valores: col((x) => fmtMonto(x.fcf)), destacada: true },
    {
      label: "Acciones",
      ayuda: "Diluidas promedio del ejercicio, ajustadas por splits",
      valores: col((x) => fmtAcciones(x.acciones)),
    },
    {
      label: "FCF por acción",
      ayuda: "La prueba de si el crecimiento le llegó al accionista o se lo comió la dilución",
      valores: col((x) => (x.fcfPorAccion == null ? "—" : fmtUsd(x.fcfPorAccion))),
      destacada: true,
    },
    { label: "Patrimonio", valores: col((x) => fmtMonto(x.patrimonio)) },
  ];

  const primero = e[0];
  const ultimo = e[e.length - 1];
  const años = Number(ultimo.año) - Number(primero.año);

  // La dilución acumulada es la lectura que sólo aparece con la serie larga:
  // en cinco años una emisión del 3% anual no se nota; en veinte, sí.
  const dilucion =
    primero.acciones && ultimo.acciones && años > 0
      ? ((ultimo.acciones / primero.acciones) ** (1 / años) - 1) * 100
      : null;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="border-b border-borde">
              <th className="text-left font-normal text-[10px] uppercase tracking-[0.12em] text-tenue py-2 pr-3 min-w-[132px] sticky left-0 bg-card">
                {e.length} ejercicios
              </th>
              {e.map((x) => (
                <th
                  key={x.cierre}
                  className="text-right font-medium py-2 px-2.5 whitespace-nowrap text-secundario"
                  title={`Cierre ${x.cierre}`}
                >
                  {x.año}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-divisor-fino">
            {filas.map((f) => (
              <tr key={f.label} className="hover:bg-chip/40 transition-colors">
                <td
                  className={`py-[7px] pr-3 whitespace-nowrap sticky left-0 bg-card ${
                    f.destacada ? "text-cuerpo font-medium" : "text-label"
                  }`}
                  title={f.ayuda}
                >
                  {f.label}
                  {f.ayuda && <span className="text-tenue"> ·</span>}
                </td>
                {f.valores.map((v, i) => (
                  <td
                    key={i}
                    className={`text-right tabular-nums py-[7px] px-2.5 whitespace-nowrap ${
                      v === "—" ? "text-slate-700" : f.clases?.[i] ?? "text-cuerpo"
                    }`}
                  >
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dilucion != null && (
        <p className="text-[11.5px] text-secundario leading-relaxed">
          Entre {primero.año} y {ultimo.año} las acciones{" "}
          <span className={dilucion > 0.5 ? "text-baja" : dilucion < -0.5 ? "text-sube" : "text-cuerpo"}>
            {dilucion > 0 ? "crecieron" : "cayeron"} {fmtNivel(Math.abs(dilucion))} por año
          </span>
          {dilucion > 0
            ? " — parte del crecimiento de la empresa no llegó al accionista."
            : " — la recompra le sumó al que se quedó."}
        </p>
      )}

      {serie.problema && (
        <p className="text-[11.5px] text-amber-400/90 leading-relaxed max-w-[92ch]">
          {serie.problema}
        </p>
      )}

      <Fuente
        creditos={[CREDITOS.sec]}
        extra="Los 10-K tal como los presentó la empresa, etiquetados en XBRL. Cuando un ejercicio fue reexpresado vale la última presentación. Las acciones se ajustan por splits, que EDGAR no marca: el factor se deduce del mismo ejercicio informado dos veces."
      />
    </div>
  );
}
