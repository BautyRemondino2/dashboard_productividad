import { getCauciones, type Caucion } from "@/lib/byma";
import Fuente from "@/components/Fuente";
import { CREDITOS } from "@/lib/fuentes-credito";

const fmtTna = (v: number) =>
  `${v.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const fmtPlazo = (d: number) => `${d} ${d === 1 ? "día" : "días"}`;

const fmtVar = (v: number) =>
  Math.abs(v).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function fmtMonto(v: number, ccy: "ARS" | "USD"): string | null {
  if (!(v > 0)) return null;
  const s = ccy === "USD" ? "US$" : "$";
  if (v >= 1e9) return `${s}${(v / 1e9).toLocaleString("es-AR", { maximumFractionDigits: 1 })} mil M`;
  if (v >= 1e6) return `${s}${(v / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 0 })} M`;
  return `${s}${v.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

function Seccion({
  moneda,
  lista,
  conBorde,
}: {
  moneda: "ARS" | "USD";
  lista: Caucion[];
  conBorde: boolean;
}) {
  const previo = lista.every((c) => !c.operadoHoy);
  return (
    <div className={conBorde ? "border-t border-borde" : ""}>
      <div className="px-4 py-2 flex items-baseline justify-between border-b border-divisor-fino">
        <span className="text-[11px] font-medium text-cuerpo">
          {moneda === "ARS" ? "Pesos" : "Dólares"}
        </span>
        <span className="text-[10px] text-meta-suave">{previo ? "cierre previo" : "operado hoy"}</span>
      </div>
      <div className="divide-y divide-divisor-fino">
        {lista.map((c) => {
          const monto = fmtMonto(c.volumen, moneda);
          return (
            <div key={c.plazo} className="px-4 py-1.5 flex items-center gap-2.5">
              <span className="text-[12px] text-secundario tabular-nums w-14 shrink-0">
                {fmtPlazo(c.plazo)}
              </span>
              <span className="text-[13px] font-semibold text-titulo tabular-nums">{fmtTna(c.tna)}</span>
              {c.variacion != null && c.variacion !== 0 && (
                <span
                  className={`text-[10px] tabular-nums ${c.variacion > 0 ? "text-sube" : "text-baja"}`}
                  title="Variación de la TNA vs. el cierre previo"
                >
                  {c.variacion > 0 ? "▲" : "▼"} {fmtVar(c.variacion)} pp
                </span>
              )}
              {monto && (
                <span className="text-[10px] text-meta-suave tabular-nums ml-auto">{monto}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * La curva de cauciones de BYMA — tasa corta por plazo y moneda, como lista
 * vertical para el sidebar. Reemplaza la carga manual de la caución: el dato
 * entra solo.
 *
 * Dos formas distintas de no tener datos, y se tratan distinto a propósito:
 *
 *  - **BYMA no contesta** (timeout, error HTTP): no se renderiza nada. No hay
 *    forma de saber si hay rueda o no, y afirmar cualquiera de las dos cosas
 *    sería inventar.
 *  - **BYMA contesta con la lista vacía**: eso *sí* es información. Es lo que
 *    devuelve los sábados, domingos y feriados, cuando no hay rueda. Antes el
 *    panel desaparecía sin decir nada y parecía que algo se había roto, así que
 *    ahora la tarjeta queda con la explicación.
 */
export default async function Cauciones() {
  let data;
  try {
    data = await getCauciones();
  } catch {
    return null;
  }

  const secciones = ([["ARS", data.ars], ["USD", data.usd]] as const).filter(([, l]) => l.length > 0);

  if (secciones.length === 0) {
    return (
      <div className="rounded-card border border-borde bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-borde">
          <h3 className="text-[13px] font-semibold text-titulo">Cauciones</h3>
          <p className="text-[10px] text-meta-suave mt-0.5">TNA por plazo · BYMA</p>
        </div>
        <p className="px-4 py-3 text-[11.5px] text-meta leading-relaxed">
          Sin rueda: BYMA no publica cauciones los fines de semana ni los feriados. La curva vuelve
          sola con la próxima rueda.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-borde bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-borde">
        <h3 className="text-[13px] font-semibold text-titulo">Cauciones</h3>
        <p className="text-[10px] text-meta-suave mt-0.5">TNA por plazo · variación vs cierre previo</p>
      </div>
      {secciones.map(([m, lista], i) => (
        <Seccion key={m} moneda={m} lista={lista} conBorde={i > 0} />
      ))}
      <div className="px-4 py-3 border-t border-borde">
        <Fuente
          creditos={[CREDITOS.byma]}
          extra="Precio de cierre de cada plazo; los que no operaron hoy muestran el cierre anterior."
        />
      </div>
    </div>
  );
}
