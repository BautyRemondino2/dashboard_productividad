import type { Advertencia } from "@/lib/morning-brief-tipos";

/**
 * Las inconsistencias de la validación posterior no se corrigen solas: se
 * muestran, en rojo, arriba de todo. Un id citado sin valor o un alias que no
 * existe es una falla de la síntesis, no un detalle de estilo.
 */
export default function AdvertenciasBanner({ advertencias }: { advertencias: Advertencia[] }) {
  if (advertencias.length === 0) return null;

  return (
    <div className="rounded-card border border-red-900/50 bg-red-950/30 px-[18px] py-3 space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-red-400">
        {advertencias.length === 1 ? "1 advertencia" : `${advertencias.length} advertencias`}
      </p>
      <ul className="space-y-1">
        {advertencias.map((a, i) => (
          <li key={i} className="text-[12.5px] text-red-300/90 leading-relaxed">
            {a.mensaje}
          </li>
        ))}
      </ul>
    </div>
  );
}
