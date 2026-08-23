import Link from "next/link";
import { Suspense } from "react";
import { getTablero } from "@/lib/equity";
import { SECTOR_LABEL } from "@/lib/equity-sectores";
import { colorRetorno, fmtCap, fmtPct, fmtUsd } from "@/lib/equity-formato";
import type { FilaTablero } from "@/lib/equity-formato";

export const metadata = { title: "Earnings · Dashboard" };
export const dynamic = "force-dynamic";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Lunes de la semana a la que pertenece una fecha, en ISO. */
function lunesDe(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return d.toISOString().slice(0, 10);
}

function etiquetaSemana(lunes: string): string {
  const ini = new Date(`${lunes}T12:00:00Z`);
  const fin = new Date(ini);
  fin.setUTCDate(fin.getUTCDate() + 4);

  const hoyLunes = lunesDe(new Date().toISOString().slice(0, 10));
  if (lunes === hoyLunes) return "Esta semana";

  const mismoMes = ini.getUTCMonth() === fin.getUTCMonth();
  return mismoMes
    ? `${ini.getUTCDate()} al ${fin.getUTCDate()} de ${MESES[ini.getUTCMonth()]}`
    : `${ini.getUTCDate()} de ${MESES[ini.getUTCMonth()]} al ${fin.getUTCDate()} de ${MESES[fin.getUTCMonth()]}`;
}

function etiquetaDia(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()}`;
}

/**
 * Calendario de earnings.
 *
 * Sale gratis del mismo lote de quotes que alimenta el ranking: la fecha del
 * próximo balance ya viene ahí, no hay ni un request extra.
 */
async function Calendario() {
  const tablero = await getTablero();
  const hoy = new Date().toISOString().slice(0, 10);

  const proximos = tablero
    .filter((f) => f.proximoEarnings && f.proximoEarnings >= hoy)
    .sort((a, b) => a.proximoEarnings!.localeCompare(b.proximoEarnings!));

  // Agrupado en semanas, y dentro de cada semana por día
  const semanas = new Map<string, Map<string, FilaTablero[]>>();
  for (const f of proximos) {
    const semana = lunesDe(f.proximoEarnings!);
    const dias = semanas.get(semana) ?? new Map<string, FilaTablero[]>();
    const delDia = dias.get(f.proximoEarnings!) ?? [];
    delDia.push(f);
    dias.set(f.proximoEarnings!, delDia);
    semanas.set(semana, dias);
  }

  const proximasOcho = [...semanas.entries()].slice(0, 8);

  if (proximasOcho.length === 0) {
    return (
      <p className="text-[12px] text-slate-600">
        Yahoo no tiene fechas de balance cargadas para el índice en este momento.
      </p>
    );
  }

  return (
    <div className="space-y-7">
      {proximasOcho.map(([semana, dias]) => {
        const total = [...dias.values()].reduce((n, l) => n + l.length, 0);
        return (
          <section key={semana}>
            <div className="flex items-baseline gap-3 mb-3 pb-1.5 border-b border-slate-800">
              <h2 className="text-[13px] font-semibold text-slate-200">
                {etiquetaSemana(semana)}
              </h2>
              <span className="text-[10px] text-slate-600">
                {total} {total === 1 ? "empresa" : "empresas"}
              </span>
            </div>

            <div className="space-y-4">
              {[...dias.entries()].map(([dia, empresas]) => (
                <div key={dia} className="grid sm:grid-cols-[110px_1fr] gap-x-4 gap-y-2">
                  <p className="text-[11px] text-slate-500 pt-1.5 capitalize">
                    {etiquetaDia(dia)}
                  </p>

                  <div className="flex flex-wrap gap-1.5">
                    {empresas
                      .sort((a, b) => (b.capitalizacion ?? 0) - (a.capitalizacion ?? 0))
                      .map((f) => (
                        <Link
                          key={f.ticker}
                          href={`/equity/${f.ticker}`}
                          title={`${f.nombre} · ${SECTOR_LABEL[f.sector]} · ${fmtCap(f.capitalizacion)}${
                            f.earningsEstimado ? " · fecha estimada" : ""
                          }`}
                          className={`group px-2 py-1 rounded-md border bg-slate-900/40 hover:bg-slate-900 transition-colors ${
                            f.earningsEstimado
                              ? "border-slate-800/60 border-dashed"
                              : "border-slate-800"
                          }`}
                        >
                          <span className="text-[12px] font-medium text-slate-200 group-hover:text-white">
                            {f.ticker}
                          </span>
                          <span className={`text-[10px] ml-1.5 tabular-nums ${colorRetorno(f.dia)}`}>
                            {fmtPct(f.dia)}
                          </span>
                          <span className="block text-[9px] text-slate-600 tabular-nums">
                            {fmtUsd(f.precio)}
                          </span>
                        </Link>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <p className="text-[10px] text-slate-600">
        Fechas de Yahoo Finance. Las de borde punteado son estimadas: la empresa todavía
        no confirmó el día.
      </p>
    </div>
  );
}

export default function EarningsPage() {
  return (
    <div className="px-8 py-7 max-w-[1200px]">
      <div className="mb-6 fade-up fade-up-1">
        <Link
          href="/equity"
          className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors"
        >
          ← Equity
        </Link>
        <h1 className="text-3xl font-semibold text-slate-100 tracking-tight mt-2">
          Calendario de earnings
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Próximos balances del S&amp;P 500, por semana
        </p>
      </div>

      <Suspense
        fallback={
          <div className="space-y-6">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-24 animate-pulse bg-slate-900/40 rounded-xl" />
            ))}
          </div>
        }
      >
        <Calendario />
      </Suspense>
    </div>
  );
}
