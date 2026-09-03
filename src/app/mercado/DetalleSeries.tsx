"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatValor, LOWER_IS_BETTER, type MarketSeriesPoint, type Unidad } from "@/lib/mercado";
import Fuente from "@/components/Fuente";

/**
 * El detalle de las series del hero: los tipos de cambio y el riesgo país,
 * graficados en serio.
 *
 * Los dos cards de arriba de macro muestran la cifra del día y una serie
 * dibujada al ancho del card. Eso contesta "cuánto está" y "para dónde viene",
 * pero no contesta la pregunta que se hace todos los días: **cómo vienen los
 * tipos de cambio entre sí**. El CCL solo no dice si la brecha se abre o se
 * cierra, ni si el blue se adelantó.
 *
 * Por eso el gráfico es multi-serie y no un modal por instrumento como el de
 * los tiles de abajo: los cinco dólares comparten unidad y eje, así que
 * superpuestos se leen de una. Lo que no comparte unidad —la brecha en %, las
 * reservas en dólares, la base en pesos— va como *vista* aparte y no como una
 * línea más: dos escalas en un eje es un gráfico que miente.
 */

const RANGOS = [
  { key: "30", label: "30 días", dias: 30 },
  { key: "90", label: "90 días", dias: 90 },
  { key: "365", label: "1 año", dias: 365 },
  { key: "all", label: "Todo", dias: Infinity },
] as const;

export interface SerieDef {
  ticker: string;
  nombre: string;
  color: string;
  datos: MarketSeriesPoint[];
}

export interface Vista {
  id: string;
  label: string;
  unidad: Unidad;
  /** Qué se está mirando, en una línea. Va debajo del título. */
  nota?: string;
  series: SerieDef[];
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ejeFecha = (f: string) => `${f.slice(8)}/${f.slice(5, 7)}`;
const fechaLarga = (f: string) => `${f.slice(8)} ${MESES[Number(f.slice(5, 7)) - 1]} ${f.slice(0, 4)}`;

/** Variación de una serie dentro del rango visible, en %. */
function variacion(datos: MarketSeriesPoint[]): number | null {
  const primero = datos[0]?.valor;
  const ultimo = datos.at(-1)?.valor;
  return primero && ultimo ? (ultimo / primero - 1) * 100 : null;
}

function Modal({
  titulo,
  vistas,
  vistaInicial,
  visiblesIniciales,
  onClose,
}: {
  titulo: string;
  vistas: Vista[];
  vistaInicial?: string;
  visiblesIniciales?: string[];
  onClose: () => void;
}) {
  const [rango, setRango] = useState<string>("90");
  const [vistaId, setVistaId] = useState(vistaInicial ?? vistas[0].id);
  const vista = vistas.find((v) => v.id === vistaId) ?? vistas[0];

  // Qué líneas se ven. Se resetea al cambiar de vista: las series de una vista
  // no existen en la otra.
  const [ocultas, setOcultas] = useState<Set<string>>(
    () =>
      new Set(
        visiblesIniciales
          ? (vistas.find((v) => v.id === (vistaInicial ?? vistas[0].id)) ?? vistas[0]).series
              .filter((s) => !visiblesIniciales.includes(s.ticker))
              .map((s) => s.ticker)
          : []
      )
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const visibles = vista.series.filter((s) => !ocultas.has(s.ticker));

  /**
   * Las filas del gráfico: una por fecha, con una columna por serie.
   *
   * Se recorta primero y se cruza después, sobre la **unión** de fechas. Las
   * series no comparten calendario —el oficial no cotiza los feriados que el
   * blue sí, el riesgo país lo publica JP Morgan con su propio rezago— y
   * quedarse con la intersección tiraría datos buenos. Los huecos se dibujan
   * uniendo los extremos (`connectNulls`), que es lo que hace cualquier
   * terminal de mercado.
   */
  const { filas, corte } = useMemo(() => {
    const dias = RANGOS.find((r) => r.key === rango)?.dias ?? 90;

    // El corte se cuenta desde el último dato y no desde el reloj: si el último
    // cierre es del viernes y esto se abre un domingo, "30 días" tiene que ser
    // treinta días de datos y no veintiocho.
    const ancla = vista.series
      .map((s) => s.datos.at(-1)?.fecha)
      .filter((f): f is string => !!f)
      .sort()
      .at(-1);

    const desde =
      dias === Infinity || !ancla
        ? ""
        : new Date(Date.parse(ancla) - dias * 86_400_000).toISOString().slice(0, 10);

    const porFecha = new Map<string, Record<string, string | number>>();
    for (const s of vista.series) {
      for (const p of s.datos) {
        if (p.fecha < desde) continue;
        const fila = porFecha.get(p.fecha) ?? { fecha: p.fecha };
        fila[s.ticker] = p.valor;
        porFecha.set(p.fecha, fila);
      }
    }

    return {
      filas: [...porFecha.values()].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))),
      corte: desde,
    };
  }, [vista, rango]);

  // El dominio se calcula sobre lo visible: si se apaga el blue, el eje se
  // ajusta a lo que queda y las diferencias dejan de verse aplastadas.
  const valores = filas.flatMap((f) =>
    visibles.map((s) => f[s.ticker]).filter((v): v is number => typeof v === "number")
  );
  const min = valores.length ? Math.min(...valores) : 0;
  const max = valores.length ? Math.max(...valores) : 1;
  const pad = (max - min) * 0.08 || Math.abs(max) * 0.05 || 1;

  const recortadas = (s: SerieDef) => s.datos.filter((p) => p.fecha >= corte);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-4xl bg-boton border border-outline rounded-2xl shadow-2xl overflow-hidden">
        {/* ── Encabezado ───────────────────────────────────────────────── */}
        <div className="px-6 pt-5 pb-4 border-b border-borde flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-titulo tracking-tight">{titulo}</h2>
            {vista.nota && <p className="text-[12px] text-meta mt-1">{vista.nota}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-meta hover:text-cuerpo hover:bg-slate-800 transition-colors"
            title="Cerrar (Esc)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </div>

        {/* ── Vista y rango ────────────────────────────────────────────── */}
        <div className="px-6 pt-3 flex items-center gap-4 flex-wrap">
          {vistas.length > 1 && (
            <div className="flex items-center gap-1.5">
              {vistas.map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    setVistaId(v.id);
                    setOcultas(new Set());
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                    vista.id === v.id
                      ? "bg-slate-700/70 text-titulo"
                      : "text-meta hover:text-cuerpo hover:bg-slate-800/60"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5 ml-auto">
            {RANGOS.map((r) => (
              <button
                key={r.key}
                onClick={() => setRango(r.key)}
                className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                  rango === r.key
                    ? "bg-slate-700/70 text-titulo"
                    : "text-meta hover:text-cuerpo hover:bg-slate-800/60"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Gráfico ──────────────────────────────────────────────────── */}
        <div className="px-3 pt-3 pb-1 h-[340px]">
          {filas.length < 2 || visibles.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[12px] text-meta-suave">
              {visibles.length === 0
                ? "No queda ninguna serie prendida."
                : "Falta historia para graficar — hacen falta al menos dos datos."}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filas} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid stroke="rgb(30,41,59)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="fecha"
                  tickFormatter={ejeFecha}
                  tick={{ fill: "rgb(100,116,139)", fontSize: 10 }}
                  stroke="rgb(51,65,85)"
                  minTickGap={40}
                />
                <YAxis
                  domain={[min - pad, max + pad]}
                  tickFormatter={(v: number) => formatValor(v, vista.unidad)}
                  tick={{ fill: "rgb(100,116,139)", fontSize: 10 }}
                  stroke="rgb(51,65,85)"
                  width={86}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgb(15,23,42)",
                    border: "1px solid rgb(51,65,85)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "rgb(148,163,184)", fontSize: 11, marginBottom: 4 }}
                  labelFormatter={(l) => (typeof l === "string" ? fechaLarga(l) : "")}
                  formatter={(v, nombre) => [
                    typeof v === "number" ? formatValor(v, vista.unidad) : "—",
                    nombre,
                  ]}
                />
                {vista.series.length > 1 && (
                  <Legend
                    verticalAlign="top"
                    height={26}
                    iconType="plainline"
                    wrapperStyle={{ fontSize: 11, color: "rgb(148,163,184)" }}
                  />
                )}
                {visibles.map((s) => (
                  <Line
                    key={s.ticker}
                    type="monotone"
                    dataKey={s.ticker}
                    name={s.nombre}
                    stroke={s.color}
                    strokeWidth={1.8}
                    dot={false}
                    activeDot={{ r: 3.5, fill: s.color }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Las series, con su variación en el rango ─────────────────── */}
        <div className="px-6 py-3 border-t border-borde flex flex-wrap gap-x-6 gap-y-2.5">
          {vista.series.map((s) => {
            const datos = recortadas(s);
            const v = variacion(datos);
            const ultimo = datos.at(-1)?.valor;
            const apagada = ocultas.has(s.ticker);
            const sube = (v ?? 0) > 0;
            const bueno = LOWER_IS_BETTER.has(s.ticker) ? !sube : sube;

            return (
              <button
                key={s.ticker}
                onClick={() =>
                  setOcultas((prev) => {
                    const next = new Set(prev);
                    if (next.has(s.ticker)) next.delete(s.ticker);
                    else next.add(s.ticker);
                    return next;
                  })
                }
                title={apagada ? "Mostrar en el gráfico" : "Sacar del gráfico"}
                className={`text-left transition-opacity ${apagada ? "opacity-35" : ""} ${
                  vista.series.length > 1 ? "hover:opacity-100 cursor-pointer" : "cursor-default"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-[3px] rounded-full shrink-0"
                    style={{ background: s.color }}
                  />
                  <span className="text-[10px] uppercase tracking-[0.1em] text-tenue">
                    {s.nombre}
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-[15px] text-cuerpo tabular-nums">
                    {ultimo == null ? "—" : formatValor(ultimo, vista.unidad)}
                  </span>
                  {v != null && (
                    <span
                      className={`text-[11px] tabular-nums ${
                        Math.abs(v) < 0.005 ? "text-meta" : bueno ? "text-sube" : "text-baja"
                      }`}
                    >
                      {sube ? "▲" : "▼"} {Math.abs(v).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-6 pb-4 space-y-1.5">
          <Fuente tickers={vista.series.map((x) => x.ticker)} />
          <p className="text-[10.5px] text-meta-suave leading-relaxed">
            La variación es la del rango que se está viendo, no la del día. Tocá una serie para
            sacarla del gráfico: con menos líneas el eje se ajusta a lo que queda y las diferencias
            dejan de verse aplastadas.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Envuelve una zona del hero y la vuelve clickeable.
 *
 * Es un `div` con rol de botón y no un `<button>`: adentro hay cifras, series y
 * en el card del dólar una grilla entera, y meter todo eso dentro de un botón
 * da HTML inválido —los botones no pueden anidar contenido interactivo— y
 * rompe el layout de la grilla.
 */
export default function DetalleSeries({
  titulo,
  vistas,
  vistaInicial,
  visiblesIniciales,
  ayuda,
  className = "",
  children,
}: {
  titulo: string;
  vistas: Vista[];
  vistaInicial?: string;
  visiblesIniciales?: string[];
  /** Lo que dice el tooltip al pasar por encima. */
  ayuda?: string;
  className?: string;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        title={ayuda ?? "Ver el gráfico"}
        onClick={() => setAbierto(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setAbierto(true);
          }
        }}
        className={`cursor-pointer transition-colors hover:bg-slate-100/[0.03] focus:outline-none focus-visible:ring-1 focus-visible:ring-outline ${className}`}
      >
        {children}
      </div>

      {abierto && (
        <Modal
          titulo={titulo}
          vistas={vistas}
          vistaInicial={vistaInicial}
          visiblesIniciales={visiblesIniciales}
          onClose={() => setAbierto(false)}
        />
      )}
    </>
  );
}
