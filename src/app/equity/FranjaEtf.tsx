import Link from "next/link";
import { ETFS, ETFS_DESTACADOS, getComposiciones } from "@/lib/equity";
import { colorRetorno, fmtPct, fmtUsd } from "@/lib/equity-formato";

/**
 * Franja de ETF del monitor.
 *
 * Sólo los cuatro de referencia y sin composición: el análisis completo —torta
 * sectorial, tenencias, objetivo del fondo— vive en /etf, que tiene su propia
 * entrada en la navegación.
 */
export default async function FranjaEtf() {
  const composiciones = await getComposiciones(ETFS_DESTACADOS);
  if (composiciones.length === 0) return null;

  return (
    <section className="border border-borde rounded-card bg-card overflow-hidden flex flex-wrap items-stretch">
      {composiciones.map((c) => (
        <Link
          key={c.ticker}
          href="/etf"
          className="flex-1 min-w-[168px] px-4 py-3 border-r border-borde hover:bg-encabezado transition-colors"
        >
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold text-titulo">{c.ticker}</span>
            <span className="text-[10px] text-meta truncate">{c.nombre}</span>
            <span className={`text-[11px] tabular-nums ml-auto ${colorRetorno(c.dia)}`}>
              {fmtPct(c.dia, 2)}
            </span>
          </div>
          <span className="text-[11px] text-secundario tabular-nums">{fmtUsd(c.precio)}</span>
        </Link>
      ))}

      <Link
        href="/etf"
        className="px-4 py-3 flex items-center text-[11px] text-meta hover:text-cuerpo transition-colors whitespace-nowrap"
      >
        ver los {ETFS.length} ETF →
      </Link>
    </section>
  );
}
