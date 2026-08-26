import { fmtNumero, fmtPct, fmtUsd } from "@/lib/equity-formato";
import type { AñoFinanciero, Consenso } from "@/lib/equity";

/** Si le gana o le pierde al consenso, trimestre a trimestre. */
export function PanelSorpresas({ sorpresas }: { sorpresas: Consenso["sorpresas"] }) {
  if (sorpresas.length === 0) {
    return <p className="text-[11px] text-slate-600">Sin historial de resultados.</p>;
  }

  const ganados = sorpresas.filter((s) => (s.sorpresa ?? 0) > 0).length;

  return (
    <div>
      <p className="text-[12px] text-slate-300 mb-3">
        Le ganó al consenso en{" "}
        <span className={ganados === sorpresas.length ? "text-emerald-400" : "text-slate-100"}>
          {ganados} de {sorpresas.length}
        </span>{" "}
        trimestres.
      </p>

      <div className="space-y-1.5">
        {sorpresas.map((s) => (
          <div key={s.trimestre} className="flex items-center gap-3 text-[11px]">
            <span className="text-slate-600 tabular-nums w-16 shrink-0">
              {s.trimestre.slice(0, 7)}
            </span>
            <span className="text-slate-500 tabular-nums">
              esp. {fmtUsd(s.estimado)}
            </span>
            <span className="text-slate-300 tabular-nums">
              real {fmtUsd(s.real)}
            </span>
            <span
              className={`ml-auto tabular-nums ${
                (s.sorpresa ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {fmtPct(s.sorpresa)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Cómo viene moviéndose el consenso de analistas mes a mes. */
export function PanelConsenso({ consenso }: { consenso: Consenso }) {
  const { tendencia, cambios, institucional } = consenso;

  return (
    <div className="space-y-4">
      {tendencia.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-600 mb-2">
            Recomendaciones por mes
          </p>
          <div className="space-y-1">
            {tendencia.map((t) => {
              const total = t.compraFuerte + t.compra + t.mantener + t.venta + t.ventaFuerte;
              if (total === 0) return null;
              const pct = (n: number) => `${(n / total) * 100}%`;
              return (
                <div key={t.periodo} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-600 tabular-nums w-8 shrink-0">
                    {t.periodo === "0m" ? "hoy" : t.periodo}
                  </span>
                  <div className="flex h-2.5 flex-1 rounded-sm overflow-hidden bg-slate-900">
                    <div style={{ width: pct(t.compraFuerte + t.compra) }} className="bg-emerald-500/70" />
                    <div style={{ width: pct(t.mantener) }} className="bg-slate-600/70" />
                    <div style={{ width: pct(t.venta + t.ventaFuerte) }} className="bg-rose-500/70" />
                  </div>
                  <span className="text-[10px] text-slate-500 tabular-nums w-[74px] text-right shrink-0 whitespace-nowrap">
                    {t.compraFuerte + t.compra}/{total} compra
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {cambios.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-600 mb-2">
            Movimientos recientes
          </p>
          <div className="space-y-1.5">
            {cambios.map((c, i) => (
              <div key={`${c.firma}-${c.fecha}-${i}`} className="flex items-baseline gap-2 text-[11px]">
                <span className="text-slate-300 truncate max-w-[110px]">{c.firma}</span>
                <span className="text-slate-600 truncate">{c.hacia}</span>
                <span className="ml-auto text-slate-400 tabular-nums shrink-0">
                  {c.objetivo ? fmtUsd(c.objetivo, 0) : "—"}
                  {c.objetivoPrevio && c.objetivo && c.objetivoPrevio !== c.objetivo && (
                    <span
                      className={`ml-1 ${
                        c.objetivo > c.objetivoPrevio ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {c.objetivo > c.objetivoPrevio ? "↑" : "↓"}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {institucional != null && (
        <p className="text-[10px] text-slate-600 pt-1">
          {fmtNumero(institucional)}% en manos de instituciones.
        </p>
      )}
    </div>
  );
}

/** Ventas y márgenes por año: distingue una empresa que mejora de una que se cae. */
export function PanelHistoria({ historia }: { historia: AñoFinanciero[] }) {
  if (historia.length < 2) {
    return <p className="text-[11px] text-slate-600">Sin historial anual disponible.</p>;
  }

  const maxVentas = Math.max(...historia.map((a) => a.ventas ?? 0));

  return (
    <div className="space-y-2.5">
      {historia.map((a) => (
        <div key={a.año} className="flex items-center gap-3">
          <span className="text-[11px] text-slate-500 tabular-nums w-9 shrink-0">{a.año}</span>

          <div className="flex-1 h-5 bg-slate-900/60 rounded-sm relative overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-sky-500/25"
              style={{ width: `${((a.ventas ?? 0) / maxVentas) * 100}%` }}
            />
            <span className="absolute inset-y-0 left-2 flex items-center text-[10px] text-slate-300 tabular-nums">
              {a.ventas != null
                ? `US$${(a.ventas / 1e9).toLocaleString("es-AR", { maximumFractionDigits: 1 })} mil M`
                : "—"}
            </span>
          </div>

          <span className="text-[10px] text-slate-500 tabular-nums w-24 text-right shrink-0">
            margen {a.margenNeto != null ? `${a.margenNeto.toFixed(0)}%` : "—"}
          </span>
        </div>
      ))}
      <p className="text-[10px] text-slate-600 pt-1">Ventas anuales y margen neto.</p>
    </div>
  );
}
