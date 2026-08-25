import Card from "@/components/Card";
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
    <div className={`px-4 py-[13px] flex flex-col gap-1 ${ultima ? "" : "border-r border-divisor"}`}>
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

  return (
    <div className="grid xl:grid-cols-[1.55fr_1fr] gap-4 items-stretch">
      <Card
        titulo="Dólar"
        nota="en pesos"
        acento={VERDE}
        derecha={`al ${corta(ccl.last.fecha)}`}
        destacada
        cuerpo={false}
      >
        <div className="flex items-start gap-7 px-5 pt-5 pb-2">
          <div className="shrink-0">
            <div className="text-[11px] uppercase tracking-[0.12em] text-tenue mb-1.5">
              Contado con liqui
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
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-divisor">
          <Pie nombre="Oficial" serie={s("OFICIAL")} unidad="ARS" ticker="OFICIAL" />
          <Pie nombre="MEP" serie={s("MEP")} unidad="ARS" ticker="MEP" />
          <Pie nombre="Blue" serie={s("BLUE")} unidad="ARS" ticker="BLUE" />
          <Pie nombre="Mayorista" serie={s("MAYORISTA")} unidad="ARS" ticker="MAYORISTA" ultima />
        </div>
      </Card>

      <Card
        titulo="Riesgo & reservas"
        acento={ROJO}
        derecha={`al ${corta(riesgo.last.fecha)}`}
        destacada
        cuerpo={false}
        className="flex flex-col"
      >
        <div className="px-5 pt-5 pb-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-tenue mb-1.5">
            Riesgo país (EMBI)
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
        </div>

        <div className="mt-auto grid grid-cols-2 border-t border-divisor">
          <Pie nombre="Reservas BCRA" serie={s("RESERVAS")} unidad="musd" ticker="RESERVAS" />
          <Pie nombre="Base monetaria" serie={s("BASE_MON")} unidad="mars" ticker="BASE_MON" ultima />
        </div>
      </Card>
    </div>
  );
}
