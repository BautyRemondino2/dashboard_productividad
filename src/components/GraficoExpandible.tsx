"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Fuente from "@/components/Fuente";
import type { Credito } from "@/lib/fuentes-credito";

/**
 * El envoltorio de todos los gráficos propios del dashboard.
 *
 * Un gráfico dentro de un card mide 150 o 240 píxeles de alto porque tiene que
 * convivir con otros cinco. A ese tamaño se lee la forma —sube, baja, se
 * aplana— y poco más: dos series que se cruzan tres veces en dos años son un
 * borrón. Tocarlo lo abre grande, con el rango de fechas a mano y la fuente al
 * pie.
 *
 * ## Cómo se usa
 *
 * El gráfico se pasa como función y no como `children`, porque el modal
 * necesita volver a dibujarlo con otro alto y con las filas ya recortadas:
 *
 * ```tsx
 * <GraficoExpandible
 *   titulo="Inflación en EE.UU."
 *   creditos={[CREDITOS.fred]}
 *   filas={filas}
 *   fechaDe={(f) => f.fecha}
 *   rangos={RANGOS_MENSUALES}
 * >
 *   {({ filas, alto }) => <InflacionChart filas={filas} alto={alto} />}
 * </GraficoExpandible>
 * ```
 *
 * `filas`, `fechaDe` y `rangos` son opcionales **y van juntos**: sin ellos no
 * aparecen los chips de rango. Es lo correcto en un gráfico que no es una serie
 * de tiempo —la curva del Tesoro es un corte por plazo, el sendero de la Fed
 * son reuniones futuras— donde "últimos 90 días" no significa nada. Esos se
 * abren igual, más grandes y con su fuente; lo que no hacen es ofrecer un
 * control que no aplica.
 *
 * TradingView queda afuera: trae su propio control de rango y su propia marca.
 */

export interface Rango {
  key: string;
  label: string;
  /** Días hacia atrás desde el último dato. `Infinity` es todo. */
  dias: number;
}

/**
 * Los rangos que ofrece cualquier gráfico del dashboard.
 *
 * Es **una sola lista para todos**, diarios y mensuales, para que el control se
 * lea igual en toda la página. Los que no dan puntos suficientes se muestran
 * deshabilitados con el motivo en el tooltip, en vez de esconderse: que la
 * inflación no se pueda mirar a 30 días es información sobre el dato —se publica
 * una vez por mes—, no una opción que convenga ocultar.
 */
export const RANGOS: Rango[] = [
  { key: "30", label: "30 días", dias: 30 },
  { key: "90", label: "90 días", dias: 90 },
  { key: "1a", label: "1 año", dias: 365 },
  { key: "3a", label: "3 años", dias: 365 * 3 },
  { key: "5a", label: "5 años", dias: 365 * 5 },
  { key: "all", label: "Todo", dias: Infinity },
];

/**
 * Puntos mínimos para que un rango valga la pena.
 *
 * Con dos, el gráfico es una recta entre dos marcas y sugiere una transición
 * suave que nadie observó. Con tres ya hay forma.
 */
const MINIMO_PUNTOS = 3;

export interface EstadoGrafico<T> {
  filas: T[];
  alto: number;
  /** true dentro del modal: sirve para mostrar detalle que no entra en el card. */
  expandido: boolean;
}

interface Props<T> {
  titulo: string;
  /** Qué se está mirando, en una línea. Va debajo del título en el modal. */
  nota?: string;
  creditos?: Credito[];
  /** Los tickers del panel, cuando la fuente sale de ahí. */
  tickers?: string[];
  /** La letra chica de la fuente. */
  extra?: string;
  /** La serie completa. Sin esto no hay selector de rango. */
  filas?: T[];
  fechaDe?: (fila: T) => string;
  /** Por defecto, la lista completa. Se pasa sólo para acotarla. */
  rangos?: Rango[];
  /** Rango con el que abre el modal. Por defecto, el último de la lista. */
  rangoInicial?: string;
  /** Alto del gráfico dentro del card. */
  alto: number;
  /** Alto del gráfico dentro del modal. */
  altoModal?: number;
  /** Lo que aclara el tooltip al pasar por encima. */
  ayuda?: string;
  children: (estado: EstadoGrafico<T>) => ReactNode;
}

/**
 * Recorta la serie a un rango, contando desde el último dato y no desde el
 * reloj: si el último cierre es del viernes y esto se abre un domingo, "30
 * días" tiene que significar treinta días de datos y no veintiocho.
 */
function recortar<T>(
  filas: T[],
  fechaDe: (f: T) => string,
  dias: number,
  relleno = true
): T[] {
  if (dias === Infinity || filas.length === 0) return filas;

  const ancla = filas.map(fechaDe).sort().at(-1);
  if (!ancla) return filas;

  const desde = new Date(Date.parse(ancla) - dias * 86_400_000).toISOString().slice(0, 10);
  const cortadas = filas.filter((f) => fechaDe(f) >= desde);

  // Con series mensuales un rango corto puede dejar un solo punto, y un punto
  // no es un gráfico: ahí conviene mostrar los dos últimos antes que nada. Al
  // contar para habilitar los chips ese relleno se apaga, porque justamente lo
  // que se quiere saber es cuántos puntos hay de verdad.
  if (!relleno) return cortadas;
  return cortadas.length >= 2 ? cortadas : filas.slice(-2);
}

export default function GraficoExpandible<T>({
  titulo,
  nota,
  creditos,
  tickers,
  extra,
  filas,
  fechaDe,
  rangos = RANGOS,
  rangoInicial,
  alto,
  altoModal = 440,
  ayuda,
  children,
}: Props<T>) {
  const [abierto, setAbierto] = useState(false);
  const hayRangos = Boolean(filas && fechaDe && rangos.length);
  const [rango, setRango] = useState(() => rangoInicial ?? rangos.at(-1)?.key ?? "all");

  /**
   * Cuántos puntos deja cada rango. Con esto se sabe cuáles ofrecer: en una
   * serie mensual "30 días" es un solo dato y "90 días" son tres, y en una
   * serie que arranca hace ocho meses "5 años" es lo mismo que "Todo".
   */
  const puntosPorRango = useMemo(() => {
    const out = new Map<string, number>();
    if (!filas || !fechaDe) return out;
    for (const r of rangos) {
      out.set(r.key, r.dias === Infinity ? filas.length : recortar(filas, fechaDe, r.dias, false).length);
    }
    return out;
  }, [filas, fechaDe, rangos]);

  /**
   * Un rango sirve si tiene puntos suficientes y si además muestra algo que
   * "Todo" no muestre ya.
   *
   * Lo segundo importa tanto como lo primero: si la serie arranca hace catorce
   * meses, "3 años" y "5 años" dibujan exactamente lo mismo que "Todo". Tres
   * chips que hacen lo mismo no son tres opciones, son dos que decepcionan.
   *
   * El que sobrevive siempre es el último —"Todo"— y no el más chico de los que
   * empatan: es el que el lector espera encontrar, y el único cuyo nombre sigue
   * siendo cierto cuando la serie crezca.
   */
  const habilitado = (r: Rango, i: number) => {
    const puntos = puntosPorRango.get(r.key) ?? 0;
    if (puntos < MINIMO_PUNTOS) return false;
    const total = filas?.length ?? 0;
    return i === rangos.length - 1 || puntos < total;
  };

  const disponibles = rangos.filter(habilitado);

  // Si el rango elegido se quedó sin datos —cambió la serie— se cae al mayor
  // que sí tenga: mejor mostrar de más que un gráfico vacío.
  const rangoEfectivo = disponibles.some((r) => r.key === rango)
    ? rango
    : disponibles.at(-1)?.key ?? rango;

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto]);

  const filasModal = useMemo(() => {
    if (!filas) return [] as T[];
    if (!hayRangos || !fechaDe) return filas;
    const dias = rangos.find((r) => r.key === rangoEfectivo)?.dias ?? Infinity;
    return recortar(filas, fechaDe, dias);
  }, [filas, fechaDe, hayRangos, rangos, rangoEfectivo]);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        title={ayuda ?? "Abrir el gráfico en grande"}
        aria-label={`Abrir ${titulo} en grande`}
        onClick={() => setAbierto(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setAbierto(true);
          }
        }}
        className="group relative cursor-pointer rounded-md transition-colors hover:bg-slate-100/[0.02] focus:outline-none focus-visible:ring-1 focus-visible:ring-outline"
      >
        {children({ filas: filas ?? ([] as T[]), alto, expandido: false })}

        {/* La invitación aparece al pasar por encima: siempre visible sería una
            etiqueta más compitiendo con las series. */}
        <span className="pointer-events-none absolute top-0 right-0 text-[10px] text-tenue opacity-0 group-hover:opacity-100 transition-opacity">
          ampliar ↗
        </span>
      </div>

      {abierto && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setAbierto(false)}
          />

          <div className="relative z-10 w-full max-w-5xl bg-boton border border-outline rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-borde flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-titulo tracking-tight">{titulo}</h2>
                {nota && <p className="text-[12px] text-meta mt-1">{nota}</p>}
              </div>
              <button
                onClick={() => setAbierto(false)}
                className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-meta hover:text-cuerpo hover:bg-slate-800 transition-colors"
                title="Cerrar (Esc)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
            </div>

            {hayRangos && (
              <div className="px-6 pt-3 flex items-center gap-1.5 flex-wrap">
                {rangos.map((r, i) => {
                  const puntos = puntosPorRango.get(r.key) ?? 0;
                  const activo = rangoEfectivo === r.key;
                  const sinDatos = !habilitado(r, i);
                  return (
                    <button
                      key={r.key}
                      onClick={() => !sinDatos && setRango(r.key)}
                      disabled={sinDatos}
                      title={
                        sinDatos
                          ? puntos === 0
                            ? "La serie no llega tan atrás."
                            : puntos >= MINIMO_PUNTOS
                              ? "La serie no llega tan atrás: este rango muestra lo mismo que \u201cTodo\u201d."
                              : `Este dato se publica cada tanto: en ${r.label.toLowerCase()} hay ${puntos} ${
                                  puntos === 1 ? "punto" : "puntos"
                                }, no alcanza para un gráfico.`
                          : `${puntos} datos`
                      }
                      className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                        sinDatos
                          ? "text-slate-700 cursor-not-allowed"
                          : activo
                            ? "bg-slate-700/70 text-titulo"
                            : "text-meta hover:text-cuerpo hover:bg-slate-800/60"
                      }`}
                    >
                      {r.label}
                    </button>
                  );
                })}
                <span className="text-[10.5px] text-meta-suave ml-2">
                  {filasModal.length} {filasModal.length === 1 ? "dato" : "datos"}
                </span>
              </div>
            )}

            <div className="px-4 pt-4 pb-2">
              {children({ filas: filasModal, alto: altoModal, expandido: true })}
            </div>

            <div className="px-6 pb-4 pt-2 border-t border-borde">
              <Fuente creditos={creditos} tickers={tickers} extra={extra} className="pt-3" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
