import { getBenchmarks } from "@/lib/equity";
import { colorRetorno, fmtPct } from "@/lib/equity-formato";

/**
 * Franja de referencia: el índice y los 11 sectores del día.
 *
 * Sin esto, un +3% no se puede interpretar. Si el S&P subió 2,8%, ese +3% es
 * ruido; si el S&P cayó, es otra cosa completamente distinta.
 */
export default async function Referencias() {
  const benchmarks = await getBenchmarks();
  const indice = benchmarks[0];
  const sectores = benchmarks.slice(1);

  return (
    <div className="flex items-stretch gap-4 border border-slate-800 rounded-xl bg-slate-900/20 px-4 py-3 overflow-x-auto">
      {/* El índice, con más peso visual que los sectores */}
      <div className="shrink-0 pr-4 border-r border-slate-800">
        <p className="text-[10px] uppercase tracking-widest text-slate-600">
          {indice.nombre}
        </p>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span className="text-[17px] font-semibold text-slate-100 tabular-nums">
            {indice.precio?.toLocaleString("es-AR", { maximumFractionDigits: 0 }) ?? "—"}
          </span>
          <span className={`text-[12px] tabular-nums ${colorRetorno(indice.dia)}`}>
            {fmtPct(indice.dia, 2)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-x-5 gap-y-1 flex-wrap min-w-0">
        {sectores
          .slice()
          .sort((a, b) => (b.dia ?? -99) - (a.dia ?? -99))
          .map((s) => (
            <div key={s.ticker} className="shrink-0" title={`${s.nombre} · ETF ${s.ticker}`}>
              <p className="text-[10px] text-slate-500 whitespace-nowrap">{s.nombre}</p>
              <p className={`text-[12px] tabular-nums ${colorRetorno(s.dia)}`}>
                {fmtPct(s.dia, 2)}
              </p>
            </div>
          ))}
      </div>
    </div>
  );
}
