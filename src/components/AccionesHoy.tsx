import Link from "next/link";
import { getDb } from "@/lib/db";
import {
  diasRelativos, formatUSD, hoyISO, nombreCompleto, urgenciaDe, type Cliente,
} from "@/lib/crm";
import { BADGE_BASE, ETAPA_CLASS, URGENCIA_DOT } from "@/lib/crm-ui";

/**
 * Widget embebible: lo que hay que hacer hoy o que ya se pasó de fecha,
 * ordenado por ticket para atacar primero lo que más pesa. Es un Server
 * Component sin props obligatorias, así que se pega en cualquier página con
 * `<AccionesHoy />`.
 */
export default function AccionesHoy({ limite = 6 }: { limite?: number }) {
  const hoy = hoyISO();

  const pendientes = getDb()
    .prepare(
      `SELECT * FROM clientes
       WHERE fecha_proxima_accion IS NOT NULL
         AND fecha_proxima_accion <= ?
         AND etapa != 'Descartado'
       ORDER BY ticket_estimado DESC`
    )
    .all(hoy) as Cliente[];

  const visibles = pendientes.slice(0, limite);
  const vencidas = pendientes.filter((c) => c.fecha_proxima_accion! < hoy).length;

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <header className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Acciones de hoy</h3>
          {vencidas > 0 && (
            <span className="text-[10px] text-red-400 tabular">{vencidas} vencida{vencidas === 1 ? "" : "s"}</span>
          )}
        </div>
        <Link href="/crm" className="text-[10px] text-slate-600 hover:text-slate-300 transition-colors whitespace-nowrap">
          ver CRM →
        </Link>
      </header>

      {visibles.length === 0 ? (
        <p className="px-4 py-5 text-[12px] text-slate-600">
          Nada pendiente para hoy. Las próximas acciones futuras están en el CRM.
        </p>
      ) : (
        <ul className="divide-y divide-slate-900">
          {visibles.map((c) => {
            const urgencia = urgenciaDe(c.fecha_proxima_accion, hoy);
            return (
              <li key={c.id}>
                <Link href="/crm" className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-slate-900/60 transition-colors">
                  <span className={`shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${URGENCIA_DOT[urgencia]}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[13px] font-medium text-slate-100 truncate">{nombreCompleto(c)}</p>
                      <span className="text-[11px] tabular text-slate-400 shrink-0">{formatUSD(c.ticket_estimado)}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{c.proxima_accion ?? "sin acción definida"}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`${BADGE_BASE} ${ETAPA_CLASS[c.etapa]}`}>{c.etapa}</span>
                      <span className={`text-[10px] ${urgencia === "vencida" ? "text-red-400" : "text-amber-400"}`}>
                        {diasRelativos(c.fecha_proxima_accion!, hoy)}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pendientes.length > visibles.length && (
        <Link href="/crm" className="block px-4 py-2 text-[11px] text-slate-500 hover:text-slate-300 border-t border-slate-900 transition-colors">
          + {pendientes.length - visibles.length} más
        </Link>
      )}
    </section>
  );
}
