import { cargarCinta } from "@/lib/cinta";

/**
 * Los seis números que se miran primero, fijos bajo el nav.
 *
 * Antes vivían sólo en `/mercado` y se perdían al navegar. El CCL y el riesgo
 * país son contexto para leer cualquier otra página: mirar un ADR argentino sin
 * saber a cuánto está el dólar no dice nada.
 *
 * Va pegada al nav (`top-12`, que son sus 48px) y un z-index por debajo, así el
 * nav siempre queda encima al hacer scroll.
 */
export default function CintaIndicadores() {
  let celdas;
  try {
    celdas = cargarCinta();
  } catch {
    // Sin base disponible la cinta no se dibuja: el resto de la página funciona
    return null;
  }

  if (celdas.length === 0) return null;

  return (
    <div className="sticky top-12 z-[19] border-b border-borde-nav sup-cinta flex items-stretch overflow-x-auto">
      {celdas.map((c) => (
        <div
          key={c.ticker}
          className="flex-1 basis-0 min-w-[118px] box-border px-5 py-[11px] border-r border-divisor-fino flex flex-col gap-[3px]"
        >
          <span className="text-[10px] uppercase tracking-[0.11em] text-tenue whitespace-nowrap">
            {c.label}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-[17px] font-semibold text-titulo tabular-nums tracking-[-0.01em]">
              {c.valor}
            </span>
            {c.delta && (
              <span
                title={
                  c.refFecha
                    ? `Contra el dato del ${c.refFecha.slice(8)}/${c.refFecha.slice(5, 7)}` +
                      (c.dias && c.dias > 1 ? ` · ${c.dias} días` : "")
                    : undefined
                }
                className={`text-[11px] font-medium tabular-nums whitespace-nowrap ${
                  c.tono === "sube" ? "text-sube" : c.tono === "baja" ? "text-baja" : "text-meta"
                }`}
              >
                {c.delta}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
