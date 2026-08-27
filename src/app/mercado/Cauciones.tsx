import { getCauciones, type Caucion } from "@/lib/byma";

const fmtTna = (v: number) =>
  `${v.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const fmtPlazo = (d: number) => `${d} ${d === 1 ? "día" : "días"}`;

function fmtMonto(v: number, ccy: "ARS" | "USD"): string | null {
  if (!(v > 0)) return null;
  const s = ccy === "USD" ? "US$" : "$";
  if (v >= 1e9) return `${s}${(v / 1e9).toLocaleString("es-AR", { maximumFractionDigits: 1 })} mil M`;
  if (v >= 1e6) return `${s}${(v / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 0 })} M`;
  return `${s}${v.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

function Columna({ moneda, lista }: { moneda: "ARS" | "USD"; lista: Caucion[] }) {
  const previo = lista.every((c) => !c.operadoHoy);
  return (
    <div>
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
            <div key={c.plazo} className="px-4 py-2 flex items-center gap-3">
              <span className="text-[12px] text-secundario tabular-nums w-16 shrink-0">
                {fmtPlazo(c.plazo)}
              </span>
              <span className="text-[13px] font-semibold text-titulo tabular-nums">{fmtTna(c.tna)}</span>
              {monto && <span className="text-[10px] text-meta-suave tabular-nums ml-auto">{monto}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * La curva de cauciones de BYMA — tasa corta por plazo y moneda. Reemplaza la
 * carga manual de la caución: el dato entra solo. Si BYMA cae, no renderiza y la
 * página sigue.
 */
export default async function Cauciones() {
  let data;
  try {
    data = await getCauciones();
  } catch {
    return null;
  }

  const cols = ([["ARS", data.ars], ["USD", data.usd]] as const).filter(([, l]) => l.length > 0);
  if (cols.length === 0) return null;

  return (
    <div className="rounded-card border border-borde bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-borde">
        <h3 className="text-[13px] font-semibold text-titulo">Cauciones</h3>
        <p className="text-[10px] text-meta-suave mt-0.5">Tasa por plazo y moneda · TNA · fuente BYMA</p>
      </div>
      <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-borde">
        {cols.map(([m, lista]) => (
          <Columna key={m} moneda={m} lista={lista} />
        ))}
      </div>
    </div>
  );
}
