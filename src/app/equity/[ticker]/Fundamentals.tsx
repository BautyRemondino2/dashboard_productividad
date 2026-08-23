import {
  TONO_COLOR, fmtMetrica, fmtNumero, fmtPct, fmtUsd, leerMetrica,
} from "@/lib/equity-formato";
import type { MetricaComparada } from "@/lib/equity-formato";
import type { AñoFinanciero, Comparacion, Consenso } from "@/lib/equity";

/**
 * Una métrica con su lectura al lado. El número solo no dice nada: lo que
 * informa es contra qué se lo mide.
 */
function Fila({ m }: { m: MetricaComparada }) {
  const lectura = leerMetrica(m);
  // La barra satura en ±100%: más allá de duplicar la mediana el largo deja de
  // aportar y sólo distorsiona la escala del resto.
  const ancho = lectura ? Math.min(Math.abs(lectura.desvio), 100) / 2 : 0;

  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 py-1.5" title={m.ayuda}>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-400 truncate">{m.label}</p>
        {lectura && (
          <div className="flex items-center gap-1.5 mt-0.5">
            {/* Eje al centro: a la derecha por encima de la mediana, a la izquierda por debajo */}
            <div className="relative h-[3px] w-16 bg-slate-800/60 rounded-full shrink-0">
              <div
                className={`absolute top-0 bottom-0 rounded-full ${
                  lectura.tono === "bueno"
                    ? "bg-emerald-500/70"
                    : lectura.tono === "malo"
                      ? "bg-rose-500/70"
                      : "bg-slate-500/60"
                }`}
                style={
                  lectura.desvio >= 0
                    ? { left: "50%", width: `${ancho}%` }
                    : { right: "50%", width: `${ancho}%` }
                }
              />
              <div className="absolute left-1/2 top-[-2px] bottom-[-2px] w-px bg-slate-600" />
            </div>
            <span className={`text-[10px] ${TONO_COLOR[lectura.tono]}`}>{lectura.texto}</span>
          </div>
        )}
      </div>

      <span className="text-[13px] text-slate-100 tabular-nums text-right">
        {fmtMetrica(m.valor, m.formato)}
      </span>
      <span className="text-[11px] text-slate-600 tabular-nums text-right w-16">
        {fmtMetrica(m.mediana, m.formato)}
      </span>
    </div>
  );
}

export function PanelFundamentals({ comparacion }: { comparacion: Comparacion }) {
  return (
    <div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 pb-1.5 mb-1 border-b border-slate-800/60 text-[9px] uppercase tracking-widest text-slate-600">
        <span>Métrica</span>
        <span className="text-right">Valor</span>
        <span className="text-right w-16">Mediana</span>
      </div>

      <div className="divide-y divide-slate-900/70">
        {comparacion.metricas.map((m) => (
          <Fila key={m.clave} m={m} />
        ))}
      </div>

      <p className="text-[10px] text-slate-600 mt-3 leading-relaxed">
        Comparado contra la mediana de {comparacion.pares.length} pares del sector:{" "}
        {comparacion.pares.join(", ")}. La valuación va sin color a propósito — que esté
        cara no es malo por sí solo, ni barata es buena señal automáticamente.
      </p>
    </div>
  );
}

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
