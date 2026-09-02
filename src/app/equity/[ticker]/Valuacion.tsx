import type { Valuacion } from "@/lib/equity-valuacion";
import { leerValuacion } from "@/lib/equity-valuacion";
import { colorRetorno, fmtCap, fmtNivel, fmtPct, fmtUsd } from "@/lib/equity-formato";

/**
 * DCF inverso: qué descuenta el precio de hoy.
 *
 * El panel se lee de arriba abajo como un argumento. Primero **el número**: el
 * crecimiento que hay que creer para pagar lo que cotiza. Después **contra qué
 * se compara** — lo que la empresa viene haciendo, lo que espera el consenso —,
 * que es lo único que convierte ese número en una conclusión. Al final, **la
 * sensibilidad**: cuánto hay que equivocarse en la tasa o en el crecimiento
 * para que el valor cambie, que es la manera honesta de mostrar que un DCF no
 * da un precio sino un rango ancho.
 *
 * Lo que el panel no dice es si comprar. Eso es la tesis y la firma el analista.
 */

/** Verde si conviene, rojo si no, y gris cuando el número no admite juicio. */
function claseValor(potencial: number | null): string {
  if (potencial == null) return "text-cuerpo";
  return colorRetorno(potencial);
}

export default function PanelValuacion({
  valuacion,
  sensibilidad = false,
}: {
  valuacion: Valuacion | null;
  /** La matriz crecimiento × WACC. Va en la ficha, no en la vista rápida. */
  sensibilidad?: boolean;
}) {
  if (!valuacion) {
    return (
      <p className="text-[12px] text-meta leading-relaxed">
        Faltan piezas para descontar flujos: hacen falta la caja libre de los últimos doce meses,
        la capitalización y una beta con la que estimar el costo del capital. Yahoo no las publica
        todas para este papel.
      </p>
    );
  }

  const v = valuacion;
  const lectura = leerValuacion(v);

  // Cuando el método no aplica, el panel es la explicación y nada más. Mostrar
  // los recuadros igual —con un FCF yield de −17% en un banco— sería peor que
  // no mostrar nada: invita a leer como dato lo que la primera línea acaba de
  // decir que no lo es.
  if (v.problema) {
    return (
      <div className="space-y-2.5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-tenue">
          Acá no se puede descontar flujos
        </div>
        <p className="font-serif text-[13px] leading-[1.65] text-secundario max-w-[92ch]">
          {v.problema}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── El número ────────────────────────────────────────────────── */}
      {v.implicito != null ? (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-[10px] uppercase tracking-[0.14em] text-tenue">
            El precio de hoy exige
          </span>
          <span className="text-[30px] leading-none font-semibold text-num tabular-nums tracking-[-0.02em]">
            {fmtNivel(v.implicito)}
          </span>
          <span className="text-[12px] text-secundario">
            de crecimiento anual de la caja libre, {v.entrada.años} años seguidos
          </span>
        </div>
      ) : (
        <div className="text-[12px] text-amber-400/90 leading-relaxed max-w-[92ch]">{lectura[0]}</div>
      )}

      {/* ── Los insumos, para poder discutirlos ──────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-divisor border border-divisor rounded-card overflow-hidden">
        {[
          {
            label: "Caja libre UDM",
            valor: fmtCap(v.entrada.fcf),
            nota: v.fcfPromedio != null ? `promedio anual ${fmtCap(v.fcfPromedio)}` : undefined,
            ayuda: "El flujo del que arranca la proyección: FCO menos capex de los últimos doce meses.",
          },
          {
            label: "FCF yield",
            valor: fmtNivel(v.fcfYield),
            nota: `${fmtUsd(v.fcfPorAccion)} por acción`,
            ayuda: "Lo que rinde la caja libre al precio de hoy, antes de cualquier proyección.",
          },
          {
            label: "WACC",
            valor: fmtNivel(v.entrada.wacc),
            nota: "tasa de descuento",
            ayuda: "Costo del capital estimado por CAPM: Tesoro a 10 años + beta × prima de mercado, ponderado con la deuda.",
          },
          {
            label: "Deuda neta",
            valor: v.entrada.deudaNeta < 0 ? `−${fmtCap(-v.entrada.deudaNeta)}` : fmtCap(v.entrada.deudaNeta),
            nota: v.entrada.deudaNeta < 0 ? "caja neta" : "se resta del valor del negocio",
            ayuda: "Enterprise value menos capitalización: la que el mercado está usando hoy.",
          },
          {
            label: "Crecimiento terminal",
            valor: fmtNivel(v.entrada.gTerminal),
            nota: "a perpetuidad",
            ayuda: "Inflación de largo de EE.UU. Ninguna empresa crece para siempre más que la economía.",
          },
        ].map((d) => (
          <div key={d.label} className="bg-card px-3.5 py-2.5" title={d.ayuda}>
            <div className="text-[10px] uppercase tracking-[0.12em] text-tenue leading-snug">
              {d.label}
            </div>
            <div className="text-[14px] text-cuerpo tabular-nums mt-1">{d.valor}</div>
            {d.nota && <div className="text-[10px] text-meta-suave mt-1 leading-snug">{d.nota}</div>}
          </div>
        ))}
      </div>

      {/* ── Contra qué se compara ────────────────────────────────────── */}
      {v.escenarios.length > 0 && (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="border-b border-borde text-[10px] uppercase tracking-[0.12em] text-tenue">
                <th className="text-left font-normal py-2 pr-3">Si la caja crece…</th>
                <th className="text-right font-normal py-2 px-2.5 whitespace-nowrap">Anual</th>
                <th className="text-right font-normal py-2 px-2.5 whitespace-nowrap">Vale</th>
                <th className="text-right font-normal py-2 pl-2.5 whitespace-nowrap">vs. precio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divisor-fino">
              {v.escenarios.map((e) => (
                <tr key={e.nombre} className="hover:bg-chip/40 transition-colors">
                  <td className="py-[7px] pr-3">
                    <span className="text-cuerpo">{e.nombre}</span>
                    <span className="text-meta-suave text-[10.5px]"> · {e.fuente}</span>
                  </td>
                  <td className="text-right tabular-nums py-[7px] px-2.5 text-secundario whitespace-nowrap">
                    {fmtNivel(e.crecimiento)}
                    {e.original != null && (
                      <span
                        className="text-meta-suave text-[10px] ml-1"
                        title={`La referencia dice ${fmtNivel(
                          e.original
                        )}. Sostener eso diez años no tiene antecedente, así que el escenario se valúa con el techo del modelo.`}
                      >
                        de {fmtNivel(e.original)}
                      </span>
                    )}
                  </td>
                  <td className="text-right tabular-nums py-[7px] px-2.5 text-cuerpo whitespace-nowrap">
                    {e.valor == null ? "—" : fmtUsd(e.valor)}
                  </td>
                  <td
                    className={`text-right tabular-nums py-[7px] pl-2.5 whitespace-nowrap ${claseValor(
                      e.potencial
                    )}`}
                  >
                    {fmtPct(e.potencial, 0)}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-borde">
                <td className="py-[7px] pr-3 text-meta">Precio de mercado</td>
                <td className="text-right tabular-nums py-[7px] px-2.5 text-meta">
                  {v.implicito == null ? "—" : fmtNivel(v.implicito)}
                </td>
                <td className="text-right tabular-nums py-[7px] px-2.5 text-titulo">
                  {fmtUsd(v.precio)}
                </td>
                <td className="text-right tabular-nums py-[7px] pl-2.5 text-meta">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ── La lectura ───────────────────────────────────────────────── */}
      <div className="font-serif text-[13px] leading-[1.65] text-cuerpo max-w-[92ch] space-y-1.5">
        {lectura.map((linea, i) => (
          <p key={i}>{linea}</p>
        ))}
      </div>

      {/* ── Sensibilidad ─────────────────────────────────────────────── */}
      {sensibilidad && v.implicito != null && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-tenue">
            Valor por acción según crecimiento y tasa
          </div>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="text-[11.5px] border-collapse min-w-full">
              <thead>
                <tr>
                  <th className="text-left font-normal text-[10px] uppercase tracking-[0.12em] text-tenue py-1.5 pr-3">
                    Crec. \ WACC
                  </th>
                  {v.matriz.waccs.map((w) => (
                    <th
                      key={w}
                      className="text-right font-normal py-1.5 px-2.5 text-secundario tabular-nums whitespace-nowrap"
                    >
                      {fmtNivel(w)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-divisor-fino">
                {v.matriz.crecimientos.map((g, i) => (
                  <tr key={g}>
                    <td className="py-1.5 pr-3 text-secundario tabular-nums whitespace-nowrap">
                      {fmtNivel(g)}
                    </td>
                    {v.matriz.valores[i].map((valor, j) => {
                      const potencial = valor == null ? null : (valor / v.precio - 1) * 100;
                      return (
                        <td
                          key={j}
                          className={`text-right tabular-nums py-1.5 px-2.5 whitespace-nowrap ${claseValor(
                            potencial
                          )}`}
                          title={potencial == null ? undefined : `${fmtPct(potencial, 0)} contra el precio de hoy`}
                        >
                          {valor == null ? "—" : fmtUsd(valor, 0)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10.5px] text-meta-suave leading-relaxed">
            El rango de la tabla es de un punto de WACC y de {fmtNivel(
              Math.abs(v.matriz.crecimientos[1] - v.matriz.crecimientos[0])
            )}{" "}
            de crecimiento por casilla, y el valor cambia varias veces más que eso: es el argumento
            para no tomar ninguna celda como un precio objetivo. La fila del medio es el
            crecimiento que el mercado está pagando.
          </p>
        </div>
      )}

      <p className="text-[10.5px] text-meta-suave leading-relaxed">
        Diez años de crecimiento constante y después una perpetuidad de Gordon al{" "}
        {fmtNivel(v.entrada.gTerminal)}, descontando caja libre al WACC y restando la deuda neta.
        Es deliberadamente simple: la precisión de un modelo de tres etapas es aparente cuando el
        supuesto que manda —cuánto crece— es una estimación de todos modos.
      </p>
    </div>
  );
}
