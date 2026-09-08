import Card from "@/components/Card";
import Fuente from "@/components/Fuente";
import { CREDITOS } from "@/lib/fuentes-credito";
import { getRem, mesEnCurso, mesLargo } from "@/lib/rem";
import { serieInflacion } from "@/lib/inflacion";
import InflacionMensualChart from "./InflacionMensualChart";

const pct = (v: number, d = 1) =>
  `${v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d })}%`;

const VIOLETA = "oklch(70% 0.11 300)";

/** Un número de cabecera con su unidad, para el bloque de la derecha. */
function Cifra({ label, valor, nota }: { label: string; valor: string; nota: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-tenue">{label}</div>
      <div className="text-[20px] font-semibold text-cuerpo tabular-nums mt-1.5 leading-none">
        {valor}
      </div>
      <div className="text-[10px] text-meta-suave mt-1">{nota}</div>
    </div>
  );
}

/**
 * La leyenda del gráfico.
 *
 * Va acá y no dentro de recharts porque lo que distingue las dos partes es el
 * relleno —sólido contra hueco—, y el `Legend` de recharts sólo sabe pintar
 * cuadrados llenos: dos swatches idénticos no explicarían nada.
 */
function Leyenda() {
  return (
    <div className="flex items-center gap-4 text-[10.5px] text-meta">
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-[3px] bg-[#a78bfa]" />
        medido · INDEC
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-[3px] border border-[#a78bfa] bg-[#a78bfa]/15" />
        esperado · REM
      </span>
    </div>
  );
}

/**
 * La inflación mensual argentina: lo que ya pasó y lo que el mercado espera.
 *
 * El card cruza dos fuentes que se complementan y **no son lo mismo**:
 *
 *  - **INDEC** mide el IPC del mes cerrado, con unas dos semanas de rezago.
 *  - **El REM del BCRA** es la mediana de lo que pronostican consultoras,
 *    centros de investigación y bancos para los meses que vienen.
 *
 * Antes el card mostraba sólo la expectativa, y esa mitad sola no se puede
 * juzgar: un 1,8% esperado no dice nada hasta saber que el mes pasado midió
 * 2,1%. El gráfico pone las dos en la misma línea de tiempo, con el relleno
 * marcando dónde termina lo medido y empieza lo pronosticado.
 *
 * Dos cosas que el card se ocupa de no dejar ambiguas:
 *
 *  - **El REM no es una proyección del BCRA.** Lo aclara el propio banco arriba
 *    de su publicación y acá va al pie, porque leerlo como meta oficial cambia
 *    por completo lo que significa.
 *  - **Es una mediana, no un consenso.** Por eso al lado va el rango del 25 al
 *    75: si la mitad central de los analistas está entre 1,7% y 1,9%, el dato
 *    es firme; si se abre, la mediana sola engaña.
 *
 * El relevamiento se hace los últimos tres días hábiles del mes y se publica en
 * los primeros del siguiente, así que el número del mes en curso siempre sale
 * del REM anterior. De ahí también sale el mes que acaba de cerrar y todavía no
 * tiene dato de INDEC: es el hueco que el REM tapa hasta que llega la medición.
 */
export default async function Rem() {
  let rem;
  try {
    rem = await getRem();
  } catch {
    return null; // sin el xlsx del BCRA no hay nada que afirmar
  }

  const hoy = mesEnCurso();
  const actual = rem.mensual.find((m) => m.mes >= hoy);
  if (!actual) return null; // el último REM ya no alcanza al mes en curso

  const esElMes = actual.mes === hoy;
  const nucleo = rem.nucleo.find((m) => m.mes === actual.mes) ?? null;
  const doce = rem.interanual.find((h) => h.clave.includes("12 meses"));
  const anio = rem.interanual.find((h) => h.clave === hoy.slice(0, 4));
  const serie = serieInflacion(rem);
  const medido = serie.ultimoMedido;

  return (
    <Card
      titulo="Inflación mensual"
      nota={`Lo que midió INDEC y lo que espera el REM de ${rem.relevamientoLabel}`}
      acento={VIOLETA}
      derecha={rem.participantes ? `${rem.participantes} participantes` : undefined}
      cuerpo={false}
      className="mt-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5 px-5 pt-[18px] pb-4">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-tenue">
            {mesLargo(actual.mes)}
            {esElMes && <span className="text-secundario"> · mes en curso</span>}
          </div>
          <div className="flex items-baseline gap-3 mt-2">
            <span className="text-[40px] leading-none font-semibold text-num tabular-nums tracking-[-0.03em]">
              {pct(actual.mediana)}
            </span>
            <span className="text-[13px] text-tenue">esperado</span>
            {nucleo && (
              <span className="text-[12px] text-secundario tabular-nums pl-3 border-l border-borde">
                núcleo {pct(nucleo.mediana)}
              </span>
            )}
          </div>
          {actual.p25 != null && actual.p75 != null && (
            <p className="text-[11px] text-meta mt-2.5">
              La mitad de los pronósticos cae entre {pct(actual.p25)} y {pct(actual.p75)}.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-x-9 gap-y-4">
          {/* El dato medido va primero: la expectativa del mes en curso no se
              puede juzgar sin saber contra qué viene. */}
          {medido && (
            <Cifra
              label="Último dato"
              valor={pct(medido.valor)}
              nota={`${mesLargo(medido.mes)} · INDEC`}
            />
          )}
          {doce && <Cifra label="Próximos 12 meses" valor={pct(doce.mediana)} nota="interanual" />}
          {anio && (
            <Cifra
              label={`Cierre de ${anio.clave}`}
              valor={pct(anio.mediana)}
              nota="acumulada del año"
            />
          )}
        </div>
      </div>

      <div className="border-t border-divisor pt-3 pb-1">
        <div className="px-5 flex justify-end">
          <Leyenda />
        </div>
        <InflacionMensualChart meses={serie.meses} />
      </div>

      <p className="px-5 py-2.5 text-[10.5px] text-meta-suave leading-relaxed border-t border-divisor">
        Las barras llenas son el IPC que publicó INDEC. Las huecas son el REM, que no son
        proyecciones propias del BCRA: es lo que pronostican las consultoras, los centros de
        investigación y los bancos que participan, relevados los últimos tres días hábiles de{" "}
        {rem.relevamientoLabel}.
      </p>
      <Fuente
        creditos={[CREDITOS.indec, CREDITOS.bcra]}
        extra="IPC de INDEC (vía argentinadatos) y Relevamiento de Expectativas de Mercado, la encuesta que el BCRA le hace a consultoras y bancos. El REM no son proyecciones del Banco Central."
        className="mt-3"
      />
    </Card>
  );
}
