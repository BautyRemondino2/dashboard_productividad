import Card from "@/components/Card";
import DetalleSeries, { type Vista } from "./DetalleSeries";
import {
  computePanelIndicator,
  formatDelta,
  formatValor,
  LOWER_IS_BETTER,
  type DeltaInfo,
  type MarketSeriesPoint,
  type Unidad,
} from "@/lib/mercado";
import type { PanelDatos } from "@/lib/panel-datos";

/**
 * Los dos cards que abren la página de macro.
 *
 * El resto del panel son tiles del mismo tamaño, todos compitiendo por la
 * mirada. Estos dos no: el dólar y el riesgo país son los que se miran primero
 * a la mañana, así que van con la cifra en grande y su serie al lado. Lo que
 * les da jerarquía es el tamaño y el fondo, no un borde de color.
 */

const VERDE = "var(--color-acento-verde)";
const ROJO = "var(--color-acento-rojo)";

/**
 * Un tono por dólar, para que las cinco líneas del gráfico se distingan sin
 * leer la leyenda. Misma luminosidad y croma que los acentos del sistema: lo
 * único que cambia es el matiz, así ninguna pesa más que otra.
 */
const COLOR_TC: Record<string, string> = {
  CCL: VERDE,
  MAYORISTA: "oklch(72% 0.10 95)",
  OFICIAL: "oklch(70% 0.11 250)",
  MEP: "oklch(70% 0.11 310)",
  BLUE: "oklch(72% 0.10 205)",
};

/** El pie de los cards: qué serie abre cada celda. */
const PIES_DOLAR = [
  { ticker: "OFICIAL", nombre: "Oficial" },
  { ticker: "MEP", nombre: "MEP" },
  { ticker: "BLUE", nombre: "Blue" },
  { ticker: "MAYORISTA", nombre: "Mayorista" },
] as const;

/** Delta ya resuelto a texto y color, con el riesgo país al revés. */
function leerDelta(d: DeltaInfo | null, unidad: Unidad, ticker: string) {
  if (!d) return null;
  const plano = Math.abs(d.abs) < 1e-9;
  const subio = d.abs > 0;
  const bueno = LOWER_IS_BETTER.has(ticker) ? !subio : subio;
  return {
    texto: `${plano ? "=" : subio ? "▲" : "▼"} ${formatDelta(d, unidad)}`,
    clase: plano ? "text-meta" : bueno ? "text-sube" : "text-baja",
  };
}

/** La fecha del dato, corta: el día y el mes alcanzan. */
const corta = (f: string) => `${f.slice(8)}/${f.slice(5, 7)}`;

/**
 * Serie estirada al ancho disponible.
 *
 * `preserveAspectRatio="none"` deforma el trazo a propósito —lo que importa es
 * la forma general, no la pendiente exacta—, y `vector-effect` evita que esa
 * deformación engorde la línea.
 */
function Serie({
  datos,
  color,
  alto,
  id,
}: {
  datos: number[];
  color: string;
  alto: number;
  id: string;
}) {
  if (datos.length < 2) return null;

  const ancho = 320;
  const min = Math.min(...datos);
  const max = Math.max(...datos);
  const rango = max - min || 1;
  const paso = ancho / (datos.length - 1);

  const puntos = datos.map(
    (v, i) => `${(i * paso).toFixed(1)},${(alto - 2 - ((v - min) / rango) * (alto - 4)).toFixed(1)}`
  );
  const linea = `M${puntos.join(" L")}`;

  return (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      preserveAspectRatio="none"
      className="w-full min-w-0"
      style={{ height: alto }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.26" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${linea} L${ancho},${alto} L0,${alto} Z`} fill={`url(#${id})`} />
      <path
        d={linea}
        stroke={color}
        strokeWidth="1.6"
        fill="none"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** La invitación a abrir el gráfico. Discreta, pero siempre visible. */
function Abrir({ texto }: { texto: string }) {
  return (
    <span className="text-[10px] text-tenue group-hover:text-secundario transition-colors whitespace-nowrap">
      {texto} →
    </span>
  );
}

/** Una celda del pie: nombre, valor y variación. */
function Pie({
  nombre,
  serie,
  unidad,
  ticker,
  ultima = false,
}: {
  nombre: string;
  serie: MarketSeriesPoint[];
  unidad: Unidad;
  ticker: string;
  ultima?: boolean;
}) {
  const ind = computePanelIndicator(serie);
  if (!ind.last) return null;
  const d = leerDelta(ind.dPrev, unidad, ticker);

  return (
    <div className={`h-full px-4 py-[13px] flex flex-col gap-1 ${ultima ? "" : "border-r border-divisor"}`}>
      <span className="text-[11px] text-label">{nombre}</span>
      <span className="text-[19px] font-semibold text-cuerpo tabular-nums tracking-[-0.01em]">
        {formatValor(ind.last.valor, unidad)}
      </span>
      {d && <span className={`text-[11px] tabular-nums ${d.clase}`}>{d.texto}</span>}
    </div>
  );
}

export default function HeroMacro({ datos }: { datos: PanelDatos }) {
  const s = (t: string) => datos.series[t] ?? [];

  const ccl = computePanelIndicator(s("CCL"));
  const brecha = computePanelIndicator(s("BRECHA"));
  const riesgo = computePanelIndicator(s("RIESGO_PAIS"));

  if (!ccl.last || !riesgo.last) return null;

  const dCcl = leerDelta(ccl.dPrev, "ARS", "CCL");
  const dBrecha = leerDelta(brecha.dPrev, "%", "BRECHA");
  const dRiesgo = leerDelta(riesgo.dPrev, "pb", "RIESGO_PAIS");

  // Los últimos noventa puntos alcanzan para ver la forma
  const ultimos = (t: string) => s(t).slice(-90).map((p) => p.valor);

  /**
   * Las vistas del gráfico, armadas en el servidor.
   *
   * Las series van **enteras y por referencia**, sin recortar. Parece al revés
   * —recortar a un año debería pesar menos— pero `MercadoClient` ya recibe
   * `datos.series` completo, así que estos arrays ya están viajando: pasando el
   * mismo objeto, React los serializa una vez y acá referencia. Recortar creaba
   * arrays nuevos y los mandaba de nuevo: medido, 178 KB más por request. De
   * paso, "Todo" en el modal significa todo.
   */
  const serieDe = (ticker: string, nombre: string, color: string) => ({
    ticker,
    nombre,
    color,
    datos: s(ticker),
  });

  const conDatos = (v: Vista): Vista => ({ ...v, series: v.series.filter((x) => x.datos.length > 0) });

  const vistasDolar: Vista[] = [
    conDatos({
      id: "tc",
      label: "Los cinco dólares",
      unidad: "ARS",
      nota: "Todos en pesos y sobre el mismo eje: lo que se lee no es el nivel de cada uno, es cómo se separan entre sí.",
      series: [
        serieDe("CCL", "Contado con liqui", COLOR_TC.CCL),
        serieDe("MEP", "MEP", COLOR_TC.MEP),
        serieDe("BLUE", "Blue", COLOR_TC.BLUE),
        serieDe("OFICIAL", "Oficial", COLOR_TC.OFICIAL),
        serieDe("MAYORISTA", "Mayorista", COLOR_TC.MAYORISTA),
      ],
    }),
    conDatos({
      id: "brecha",
      label: "Brecha",
      unidad: "%",
      nota: "Cuánto le saca el CCL al oficial. Va aparte y no como una línea más: está en porcentaje y meterla en el eje de los pesos sería un gráfico que miente.",
      series: [serieDe("BRECHA", "Brecha CCL / oficial", VERDE)],
    }),
  ].filter((v) => v.series.length > 0);

  const vistasRiesgo: Vista[] = ([
    {
      id: "riesgo",
      label: "Riesgo país",
      unidad: "pb",
      nota: "El EMBI de JP Morgan: el spread que paga la deuda argentina sobre el Tesoro de EE.UU.",
      series: [serieDe("RIESGO_PAIS", "Riesgo país", ROJO)],
    },
    {
      id: "reservas",
      label: "Reservas BCRA",
      unidad: "musd",
      nota: "Reservas brutas del Banco Central.",
      series: [serieDe("RESERVAS", "Reservas BCRA", "oklch(72% 0.10 205)")],
    },
    {
      id: "base",
      label: "Base monetaria",
      unidad: "mars",
      nota: "Circulante más encajes: la base sobre la que se apoya todo lo demás.",
      series: [serieDe("BASE_MON", "Base monetaria", "oklch(70% 0.11 310)")],
    },
  ] as Vista[])
    .map(conDatos)
    .filter((v) => v.series.length > 0);

  return (
    <div className="grid xl:grid-cols-[1.55fr_1fr] gap-4 items-stretch">
      <Card
        titulo="Dólar"
        nota="en pesos · dolarapi.com, mayorista del BCRA"
        acento={VERDE}
        derecha={`al ${corta(ccl.last.fecha)}`}
        destacada
        cuerpo={false}
      >
        <DetalleSeries
          titulo="Dólar"
          vistas={vistasDolar}
          ayuda="Ver los cinco tipos de cambio graficados"
          className="group flex items-start gap-7 px-5 pt-5 pb-2"
        >
          <div className="shrink-0">
            <div className="flex items-baseline gap-3 mb-1.5">
              <span className="text-[11px] uppercase tracking-[0.12em] text-tenue">
                Contado con liqui
              </span>
              <Abrir texto="ver los cinco" />
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-[46px] leading-none font-semibold text-num tabular-nums tracking-[-0.03em]">
                {formatValor(ccl.last.valor, "ARS")}
              </span>
              {dCcl && (
                <span className={`text-[14px] font-medium tabular-nums ${dCcl.clase}`}>
                  {dCcl.texto}
                </span>
              )}
            </div>

            <div className="flex gap-[18px] mt-3">
              {(
                [
                  ["30 días", ccl.d30],
                  ["90 días", ccl.d90],
                ] as const
              ).map(([label, d]) => {
                const l = leerDelta(d, "ARS", "CCL");
                return (
                  <div key={label}>
                    <div className="text-[10px] uppercase tracking-[0.1em] text-tenue">{label}</div>
                    <div className={`text-[13px] font-medium tabular-nums mt-0.5 ${l?.clase ?? "text-meta"}`}>
                      {l?.texto ?? "—"}
                    </div>
                  </div>
                );
              })}
              {brecha.last && (
                <div className="pl-[18px] border-l border-borde">
                  <div className="text-[10px] uppercase tracking-[0.1em] text-tenue">
                    Brecha vs. oficial
                  </div>
                  <div className="flex items-baseline gap-[7px] mt-0.5">
                    <span className="text-[13px] font-semibold text-titulo tabular-nums">
                      {formatValor(brecha.last.valor, "%")}
                    </span>
                    {dBrecha && (
                      <span className={`text-[11px] tabular-nums ${dBrecha.clase}`}>
                        {dBrecha.texto}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <Serie datos={ultimos("CCL")} color={VERDE} alto={92} id="serieCcl" />
          </div>
        </DetalleSeries>

        {/* Cada celda abre el gráfico con ese dólar y el CCL prendidos: la
            pregunta que se hace mirando el blue no es cuánto vale, es cuánto le
            saca al que se usa de referencia. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-divisor">
          {PIES_DOLAR.map((x, i) => (
            <DetalleSeries
              key={x.ticker}
              titulo="Dólar"
              vistas={vistasDolar}
              vistaInicial="tc"
              visiblesIniciales={[x.ticker, "CCL"]}
              ayuda={`Ver ${x.nombre} contra el contado con liqui`}
              className="h-full"
            >
              <Pie
                nombre={x.nombre}
                serie={s(x.ticker)}
                unidad="ARS"
                ticker={x.ticker}
                ultima={i === PIES_DOLAR.length - 1}
              />
            </DetalleSeries>
          ))}
        </div>
      </Card>

      <Card
        titulo="Riesgo & reservas"
        nota="riesgo país de Rava, reservas y base del BCRA"
        acento={ROJO}
        derecha={`al ${corta(riesgo.last.fecha)}`}
        destacada
        cuerpo={false}
        className="flex flex-col"
      >
        <DetalleSeries
          titulo="Riesgo & reservas"
          vistas={vistasRiesgo}
          ayuda="Ver la serie del riesgo país"
          className="group px-5 pt-5 pb-4"
        >
          <div className="flex items-baseline gap-3 mb-1.5">
            <span className="text-[11px] uppercase tracking-[0.12em] text-tenue">
              Riesgo país (EMBI)
            </span>
            <Abrir texto="ver la serie" />
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-[46px] leading-none font-semibold text-num tabular-nums tracking-[-0.03em]">
              {riesgo.last.valor.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
            </span>
            <span className="text-[14px] text-tenue">pb</span>
            {dRiesgo && (
              <span className={`text-[14px] font-medium tabular-nums ml-auto ${dRiesgo.clase}`}>
                {dRiesgo.texto}
              </span>
            )}
          </div>
          <div className="mt-3">
            <Serie datos={ultimos("RIESGO_PAIS")} color={ROJO} alto={56} id="serieRiesgo" />
          </div>
        </DetalleSeries>

        <div className="mt-auto grid grid-cols-2 border-t border-divisor">
          <DetalleSeries
            titulo="Riesgo & reservas"
            vistas={vistasRiesgo}
            vistaInicial="reservas"
            ayuda="Ver la serie de reservas del BCRA"
            className="h-full"
          >
            <Pie nombre="Reservas BCRA" serie={s("RESERVAS")} unidad="musd" ticker="RESERVAS" />
          </DetalleSeries>
          <DetalleSeries
            titulo="Riesgo & reservas"
            vistas={vistasRiesgo}
            vistaInicial="base"
            ayuda="Ver la serie de la base monetaria"
            className="h-full"
          >
            <Pie nombre="Base monetaria" serie={s("BASE_MON")} unidad="mars" ticker="BASE_MON" ultima />
          </DetalleSeries>
        </div>
      </Card>
    </div>
  );
}
