import Link from "next/link";
import { ETFS, ETFS_DESTACADOS, getComposiciones } from "@/lib/equity";
import { colorRetorno, fmtPct, fmtUsd } from "@/lib/equity-formato";

/**
 * Franja de índices del monitor.
 *
 * Sólo los cuatro de referencia y sin composición: el análisis completo —torta
 * sectorial, tenencias, objetivo del fondo— vive en /equity/indices, donde hay
 * espacio para los 25 fondos.
 */
export default async function FranjaIndices() {
  const composiciones = await getComposiciones(ETFS_DESTACADOS);
  if (composiciones.length === 0) return null;

  return (
    <section className="border border-slate-800 rounded-xl bg-slate-900/20 overflow-hidden flex flex-wrap items-stretch">
      {composiciones.map((c) => (
        <Link
          key={c.ticker}
          href="/equity/indices"
          className="flex-1 min-w-[168px] px-4 py-3 border-r border-slate-800 hover:bg-slate-900/50 transition-colors"
        >
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold text-slate-100">{c.ticker}</span>
            <span className="text-[10px] text-slate-500 truncate">{c.nombre}</span>
            <span className={`text-[11px] tabular-nums ml-auto ${colorRetorno(c.dia)}`}>
              {fmtPct(c.dia, 2)}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 tabular-nums">{fmtUsd(c.precio)}</span>
        </Link>
      ))}

      <Link
        href="/equity/indices"
        className="px-4 py-3 flex items-center text-[11px] text-slate-500 hover:text-slate-200 transition-colors whitespace-nowrap"
      >
        ver los {ETFS.length} índices →
      </Link>
    </section>
  );
}
