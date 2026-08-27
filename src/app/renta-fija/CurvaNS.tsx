"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, XAxis, YAxis, ZAxis,
} from "recharts";
import { ajustarNelsonSiegel, type AjusteNS } from "@/lib/nelson-siegel";

/**
 * El gráfico de curva del dashboard: la nube de bonos y el Nelson-Siegel encima.
 *
 * Lo usan las cuatro curvas —hard-dollar, CER, dólar linked y ONs— con los
 * mismos ejes y las mismas marcas, para que se puedan comparar de un vistazo
 * sin recalibrar la vista en cada card.
 *
 * Las decisiones que valen la pena explicar:
 *
 * La línea es el ajuste, no los puntos unidos. Unir bono con bono da una
 * quebrada que sugiere que entre dos vencimientos la tasa hace exactamente eso;
 * el ajuste dice lo que de verdad se puede decir —la forma que tiene la curva—
 * y deja que cada bono se aparte de ella, que es la información que importa.
 *
 * El detalle va fijo abajo y no en un tooltip flotante. Con veinte bonos
 * apretados en el tramo corto, un cartel que sigue al mouse tapa justo la zona
 * que se está mirando. En su lugar, al pasar por un punto se encienden dos
 * guías punteadas hasta los ejes: la lectura de duration y TIR se hace sobre el
 * eje, que es donde el ojo la busca.
 *
 * La grilla es sólo horizontal. Lo que se compara en una curva de rendimientos
 * son niveles de tasa; las verticales sólo agregan ruido detrás de la nube.
 */

export interface PuntoNube {
  ticker: string;
  /** El nombre largo, si el ticker no se explica solo. */
  nombre?: string;
  tir: number;
  duration: number;
  /** Lo que se muestra en la barra de detalle al pasar el mouse. */
  detalle?: { label: string; valor: string }[];
  /** Se dibuja apagado y no entra al ajuste: dato frágil o a verificar. */
  atenuado?: boolean;
}

export interface SerieCurva {
  id: string;
  etiqueta: string;
  color: string;
  puntos: PuntoNube[];
  /** Sólo la línea del ajuste, sin marcas: se usa para curvas de referencia. */
  soloLinea?: boolean;
}

const GRIS = "#64748b";
const TENUE = "#475569";
const TINTA = "#e2e8f0";
const REJILLA = "#16233a";
const FONDO = "#020617";

const fmt = (v: number, d = 2) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });

/**
 * Con más marcas que esto, etiquetarlas todas es ilegible: los Boncer se apilan
 * en el tramo corto y los textos se pisan. Arriba del umbral se etiqueta sólo
 * lo que se está mirando y los dos extremos del residuo.
 */
const MAX_ETIQUETAS = 10;

/**
 * Una escala con cortes en números redondos.
 *
 * Dejar que recharts eligiera sobre un dominio cualquiera daba cortes como
 * 6,814458517%. Se toma un paso de la serie 1-2-2,5-5 —la de cualquier eje
 * impreso— y el dominio se estira hasta el múltiplo de ese paso: los cortes
 * caen redondos y arriba y abajo queda el aire justo, sin el medio gráfico
 * vacío que dejaba redondear al entero de más.
 */
function escalaLinda(min: number, max: number, cortes = 6) {
  const rango = Math.max(max - min, 1e-6);
  const crudo = rango / cortes;
  const magnitud = Math.pow(10, Math.floor(Math.log10(crudo)));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * magnitud).find((p) => p >= crudo) ?? 10 * magnitud;

  const desde = Math.floor(min / paso) * paso;
  const hasta = Math.ceil(max / paso) * paso;

  const ticks: number[] = [];
  // El épsilon evita que el último corte se pierda por error de redondeo
  for (let t = desde; t <= hasta + paso * 1e-6; t += paso) ticks.push(+t.toFixed(10));

  // Los decimales salen del paso y no de su magnitud: con paso 2,5 y cero
  // decimales los cortes se imprimían 0-3-5-8-10-13, que se lee como una escala
  // rota cuando en realidad está bien espaciada
  const decimales = Number.isInteger(paso) ? 0 : Number.isInteger(paso * 10) ? 1 : 2;
  return { desde, hasta, ticks, decimales };
}

/** Una línea horizontal de referencia: un nivel de tasa con su etiqueta. */
export interface Referencia {
  /** Nivel de TIR, en %, donde va la línea. */
  y: number;
  etiqueta: string;
  color?: string;
}

export default function CurvaNS({
  series,
  alto = 320,
  notaDerecha,
  referencias,
  vacio = "Sin precios en este momento.",
  children,
}: {
  series: SerieCurva[];
  alto?: number;
  /** Texto chico arriba a la derecha: el índice con que se ajustó, la fecha. */
  notaDerecha?: string;
  /**
   * Líneas horizontales de contexto: un plazo fijo, el Tesoro libre de riesgo,
   * la TIR que implica el riesgo país. La curva se lee contra ellas.
   */
  referencias?: Referencia[];
  vacio?: string;
  /** Bloques propios de cada curva: el spread por ley, el spread corporativo. */
  children?: React.ReactNode;
}) {
  const [activo, setActivo] = useState<string | null>(null);

  const ajustes = useMemo(
    () =>
      series.map((s) => ({
        serie: s,
        ajuste: ajustarNelsonSiegel(
          s.puntos.filter((p) => !p.atenuado).map((p) => ({ ticker: p.ticker, duration: p.duration, tir: p.tir }))
        ),
      })),
    [series]
  );

  const todos = useMemo(
    () => series.filter((s) => !s.soloLinea).flatMap((s) => s.puntos),
    [series]
  );

  /**
   * De qué lado va la etiqueta de cada punto.
   *
   * Los pares del mismo año —AL30 y GD30, por caso— caen casi en la misma
   * duration, y con las dos etiquetas arriba se pisan. La de abajo se la lleva
   * el punto más bajo del par, que es la lectura natural.
   */
  const etiquetaAbajo = useMemo(() => {
    const abajo = new Set<string>();
    const cerca = Math.max(...todos.map((p) => p.duration), 1) * 0.06;
    for (const p of todos) {
      const tapado = todos.some(
        (o) => o.ticker !== p.ticker && Math.abs(o.duration - p.duration) < cerca && o.tir > p.tir
      );
      if (tapado) abajo.add(p.ticker);
    }
    return abajo;
  }, [todos]);

  /** Los que más se apartan del ajuste, para etiquetarlos aunque haya muchos. */
  const destacados = useMemo(() => {
    const set = new Set<string>();
    for (const { serie, ajuste } of ajustes) {
      if (!ajuste || serie.soloLinea || ajuste.residuos.length < 3) continue;
      set.add(ajuste.residuos[0].ticker);
      set.add(ajuste.residuos[ajuste.residuos.length - 1].ticker);
    }
    return set;
  }, [ajustes]);

  if (todos.length === 0) return <p className="text-[12px] text-meta">{vacio}</p>;

  /** Cuántas series son de la curva en sí y no referencias. */
  const propias = series.filter((s) => !s.soloLinea).length;
  const punto = activo ? todos.find((p) => p.ticker === activo) : null;

  // La escala contempla los puntos, las curvas de referencia y las líneas
  // ajustadas: recharts estira el dominio hasta cubrir todo lo que dibuja, así
  // que un ajuste que se saliera del rango dado descolocaría los cortes
  const tirs = [
    ...series.flatMap((s) => s.puntos.map((p) => p.tir)),
    ...ajustes.flatMap(({ ajuste }) => (ajuste ? ajuste.curva.map((c) => c.tir) : [])),
    // Las referencias entran a la escala: si el Tesoro cae por debajo del bono
    // más bajo, su línea igual tiene que quedar dentro del gráfico.
    ...(referencias?.map((r) => r.y) ?? []),
  ];
  const durations = series.flatMap((s) => s.puntos.map((p) => p.duration));
  const escalaY = escalaLinda(Math.min(...tirs), Math.max(...tirs));
  const escalaX = escalaLinda(0, Math.max(...durations), 6);

  const etiquetarTodos = todos.length <= MAX_ETIQUETAS;

  /** El residuo del punto que se está mirando, contra la curva de su serie. */
  const residuoActivo = (() => {
    if (!activo) return null;
    for (const { serie, ajuste } of ajustes) {
      if (!ajuste || serie.soloLinea) continue;
      const r = ajuste.residuos.find((x) => x.ticker === activo);
      if (r && serie.puntos.some((p) => p.ticker === activo)) return r;
    }
    return null;
  })();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-5 flex-wrap">
        {series.map((s) => (
          <span key={s.id} className="flex items-center gap-2">
            <span
              className={s.soloLinea ? "w-3.5 h-[3px] rounded-full" : "w-2.5 h-2.5 rounded-full"}
              style={{ background: s.color }}
            />
            <span className="text-[11px] text-secundario">{s.etiqueta}</span>
            <span className="text-[10px] text-meta">{s.puntos.length}</span>
          </span>
        ))}
        {notaDerecha && <span className="text-[10px] text-meta-suave ml-auto">{notaDerecha}</span>}
      </div>

      <div style={{ height: alto }} className="-ml-1">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 18, bottom: 16, left: 2 }}>
            <CartesianGrid stroke={REJILLA} strokeDasharray="2 4" vertical={false} />
            <XAxis
              type="number"
              dataKey="duration"
              name="Duration"
              domain={[escalaX.desde, escalaX.hasta]}
              ticks={escalaX.ticks}
              tick={{ fill: GRIS, fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: REJILLA }}
              tickFormatter={(v: number) => fmt(v, escalaX.decimales)}
              label={{
                value: "duration (años)",
                position: "insideBottomRight",
                offset: -10,
                fill: TENUE,
                fontSize: 10,
              }}
            />
            <YAxis
              type="number"
              dataKey="tir"
              name="TIR"
              domain={[escalaY.desde, escalaY.hasta]}
              ticks={escalaY.ticks}
              tick={{ fill: GRIS, fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${fmt(v, escalaY.decimales)}%`}
              width={46}
            />
            <ZAxis range={[70, 70]} />

            {/* Referencias de contexto, detrás de todo: el nivel de una tasa
                conocida contra el que se lee la altura de la curva */}
            {referencias?.map((r, i) => (
              <ReferenceLine
                key={`ref-${i}`}
                y={r.y}
                stroke={r.color ?? TENUE}
                strokeDasharray="5 4"
                strokeOpacity={0.75}
                label={{
                  value: r.etiqueta,
                  position: "insideTopRight",
                  fill: r.color ?? GRIS,
                  fontSize: 10,
                }}
              />
            ))}

            {/* Guías del punto que se está mirando: la lectura va sobre el eje */}
            {punto && (
              <ReferenceLine x={punto.duration} stroke={TENUE} strokeDasharray="3 3" />
            )}
            {punto && <ReferenceLine y={punto.tir} stroke={TENUE} strokeDasharray="3 3" />}

            {/* Primero las líneas del ajuste, para que las marcas queden encima */}
            {ajustes.map(({ serie, ajuste }) =>
              ajuste ? (
                <Scatter
                  key={`ns-${serie.id}`}
                  data={ajuste.curva}
                  line={{ stroke: serie.color, strokeWidth: 2, strokeLinecap: "round" }}
                  lineType="joint"
                  isAnimationActive={false}
                  shape={() => <g />}
                />
              ) : null
            )}

            {series.map((s) =>
              s.soloLinea ? null : (
                <Scatter
                  key={s.id}
                  data={s.puntos}
                  isAnimationActive={false}
                  shape={(props: unknown) => {
                    const { cx, cy, payload } = props as { cx: number; cy: number; payload: PuntoNube };
                    const esta = activo === payload.ticker;
                    const etiquetar = etiquetarTodos || esta || destacados.has(payload.ticker);
                    // Contra el piso la etiqueta se montaba sobre los cortes del
                    // eje —X30S6 quedaba encima del 0—, y contra el techo se
                    // cortaba: en los bordes manda el borde, no el vecino
                    const abajo =
                      cy < 26 ? true : cy > alto - 52 ? false : etiquetaAbajo.has(payload.ticker);
                    return (
                      <g
                        onMouseEnter={() => setActivo(payload.ticker)}
                        onMouseLeave={() => setActivo(null)}
                        style={{ cursor: "pointer" }}
                      >
                        {/* Área de contacto más grande que la marca */}
                        <circle cx={cx} cy={cy} r={14} fill="transparent" />
                        {/* El aro del color del fondo separa las marcas que se tocan */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={esta ? 7 : 5}
                          fill={s.color}
                          fillOpacity={payload.atenuado ? 0.3 : 1}
                          stroke={FONDO}
                          strokeWidth={2}
                        />
                        {etiquetar && (
                          <text
                            x={cx}
                            y={cy + (abajo ? 19 : -12)}
                            textAnchor="middle"
                            fill={esta ? TINTA : GRIS}
                            fontSize={10}
                            /* Halo del color del fondo: en la nube del tramo
                               corto la etiqueta cae sobre otras marcas, y sin
                               esto se lee la mitad de las letras */
                            stroke={FONDO}
                            strokeWidth={3}
                            paintOrder="stroke"
                          >
                            {payload.ticker}
                          </text>
                        )}
                      </g>
                    );
                  }}
                />
              )
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="min-h-[44px] rounded-lg border border-borde bg-encabezado/40 px-4 py-2.5">
        {punto ? (
          <div className="flex items-baseline gap-x-5 gap-y-1 flex-wrap">
            <span className="text-[13px] font-semibold text-titulo">{punto.ticker}</span>
            {punto.nombre && <span className="text-[11px] text-secundario">{punto.nombre}</span>}
            {punto.detalle?.map((d) => (
              <span key={d.label} className="text-[11px] text-secundario">
                {d.label} <span className="text-cuerpo tabular-nums">{d.valor}</span>
              </span>
            ))}
            <span className="text-[11px] text-secundario">
              TIR <span className="text-cuerpo tabular-nums">{fmt(punto.tir)}%</span>
            </span>
            <span className="text-[11px] text-secundario">
              duration <span className="text-cuerpo tabular-nums">{fmt(punto.duration)} años</span>
            </span>
            {residuoActivo && (
              <span className="text-[11px] text-secundario">
                contra la curva{" "}
                <span className="text-cuerpo tabular-nums">
                  {residuoActivo.pb > 0 ? "+" : ""}
                  {Math.round(residuoActivo.pb)} pb
                </span>
              </span>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-meta">
            Pasá el mouse por un punto para ver su TIR y cuánto se aparta de la curva.
          </p>
        )}
      </div>

      {/* La curva de referencia no lleva ficha: no es la que se está mirando */}
      {ajustes.map(({ serie, ajuste }) =>
        ajuste && !serie.soloLinea ? (
          <FichaAjuste key={`f-${serie.id}`} serie={serie} ajuste={ajuste} unaSola={propias === 1} />
        ) : null
      )}

      {children}
    </div>
  );
}

/**
 * Lo que el ajuste sostiene, en castellano.
 *
 * No van β0, β1 ni β2: con bonos de uno a seis años de duration, la asíntota
 * que estima β0 no está anclada en ningún dato y sale cualquier número (ver el
 * encabezado de `nelson-siegel.ts`). Lo que sí se puede leer es la curva
 * evaluada en plazos donde hay bonos, cuánto sube entre punta y punta, y con
 * qué error —una pendiente de 30 pb con un error típico de 80 no es pendiente—.
 */
function FichaAjuste({
  serie,
  ajuste,
  unaSola,
}: {
  serie: SerieCurva;
  ajuste: AjusteNS;
  unaSola: boolean;
}) {
  const barato = ajuste.residuos[0];
  const caro = ajuste.residuos[ajuste.residuos.length - 1];

  return (
    <div className="flex items-baseline gap-x-4 gap-y-1 flex-wrap text-[11px]">
      {!unaSola && (
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: serie.color }} />
          <span className="text-tenue">{serie.etiqueta}</span>
        </span>
      )}
      <span className="text-[10px] uppercase tracking-wider text-tenue">Nelson-Siegel</span>
      {ajuste.plazosClave.map((p) => (
        <Dato key={p.plazo} label={`${p.plazo}a`} valor={`${fmt(p.tir, 1)}%`} />
      ))}
      <Dato
        label="pendiente"
        valor={`${ajuste.pendientePb > 0 ? "+" : ""}${Math.round(ajuste.pendientePb)} pb`}
      />
      <Dato label="R² aj." valor={fmt(ajuste.r2Ajustado, 2)} />
      <Dato label="error típico" valor={`${Math.round(ajuste.rmsePb)} pb`} />
      {!ajuste.conJoroba && (
        <span className="text-meta-suave">{ajuste.n} bonos: se ajusta sin curvatura</span>
      )}
      {barato && caro && barato.ticker !== caro.ticker && (
        <span className="text-meta-suave">
          más barato <span className="text-secundario">{barato.ticker}</span> ({barato.pb > 0 ? "+" : ""}
          {Math.round(barato.pb)} pb) · más caro <span className="text-secundario">{caro.ticker}</span> (
          {caro.pb > 0 ? "+" : ""}
          {Math.round(caro.pb)} pb)
        </span>
      )}
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <span className="text-secundario">
      {label} <span className="text-cuerpo tabular-nums">{valor}</span>
    </span>
  );
}
