import Card from "@/components/Card";
import { getRem, mesEnCurso, mesLargo, type RemMes } from "@/lib/rem";

const pct = (v: number, d = 1) =>
  `${v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d })}%`;

const VIOLETA = "oklch(70% 0.11 300)";

/** Un mes del sendero: etiqueta, valor y una barra para leer la forma de un vistazo. */
function Mes({ dato, tope, actual }: { dato: RemMes; tope: number; actual: boolean }) {
  return (
    <div className={`px-4 py-3 min-w-0 ${actual ? "bg-chip" : "bg-card"}`}>
      <div
        className={`text-[10px] uppercase tracking-[0.12em] ${actual ? "text-secundario" : "text-tenue"}`}
      >
        {dato.etiqueta}
      </div>
      <div
        className={`text-[15px] font-semibold tabular-nums mt-1.5 leading-none ${
          actual ? "text-num" : "text-cuerpo"
        }`}
      >
        {pct(dato.mediana)}
      </div>
      <div className="h-[3px] rounded-full bg-divisor mt-2 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(6, (dato.mediana / tope) * 100)}%`,
            background: actual ? VIOLETA : "var(--color-separador)",
          }}
        />
      </div>
    </div>
  );
}

/** Un horizonte interanual, para el bloque de la derecha. */
function Horizonte({ label, valor, nota }: { label: string; valor: string; nota: string }) {
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
 * La inflación que el mercado espera para el mes en curso, según el REM del BCRA.
 *
 * Es el complemento natural del IPC del panel: ese es el mes cerrado y éste es
 * el mes que está corriendo, que todavía no tiene dato de INDEC. El relevamiento
 * se hace los últimos tres días hábiles del mes y se publica en los primeros del
 * siguiente, así que el número del mes en curso siempre sale del REM anterior:
 * la tarjeta lo dice en el header para que la fecha no se lea mal.
 *
 * Dos cosas que la tarjeta se ocupa de no dejar ambiguas:
 *
 *  - **No es una proyección del BCRA.** Es la mediana de lo que pronostican las
 *    consultoras y los bancos que participan. El propio BCRA lo aclara arriba de
 *    su publicación y acá va al pie, porque leerlo como meta oficial cambia por
 *    completo lo que significa.
 *  - **Es una mediana, no un consenso.** Por eso al lado va el rango del 25 al
 *    75: si la mitad central de los analistas está entre 1,7% y 1,9%, el dato
 *    es firme; si se abre, la mediana sola engaña.
 *
 * Los meses ya vencidos no se muestran: para esos manda el dato de INDEC, que
 * está en el panel de abajo.
 */
export default async function Rem() {
  let rem;
  try {
    rem = await getRem();
  } catch {
    return null; // sin el xlsx del BCRA no hay nada que afirmar
  }

  const hoy = mesEnCurso();
  const adelante = rem.mensual.filter((m) => m.mes >= hoy);
  const actual = adelante[0];
  if (!actual) return null; // el último REM ya no alcanza al mes en curso

  const esElMes = actual.mes === hoy;
  const nucleo = rem.nucleo.find((m) => m.mes === actual.mes) ?? null;
  const doce = rem.interanual.find((h) => h.clave.includes("12 meses"));
  const anio = rem.interanual.find((h) => h.clave === hoy.slice(0, 4));
  const tope = Math.max(...adelante.map((m) => m.mediana));

  return (
    <Card
      titulo="REM · inflación esperada"
      nota={`Mediana de los pronósticos del relevamiento de ${rem.relevamientoLabel} · BCRA`}
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
            <span className="text-[13px] text-tenue">mensual</span>
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

        <div className="flex gap-9">
          {doce && (
            <Horizonte
              label="Próximos 12 meses"
              valor={pct(doce.mediana)}
              nota="interanual"
            />
          )}
          {anio && (
            <Horizonte
              label={`Cierre de ${anio.clave}`}
              valor={pct(anio.mediana)}
              nota="acumulada del año"
            />
          )}
        </div>
      </div>

      {/* Los separadores salen del gap sobre el fondo, no de `divide-*`: una
          grilla que envuelve deja líneas sueltas en el borde de cada fila. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-divisor border-t border-divisor">
        {adelante.map((m) => (
          <Mes key={m.mes} dato={m} tope={tope} actual={m.mes === actual.mes} />
        ))}
      </div>

      <p className="px-5 py-2.5 text-[10.5px] text-meta-suave leading-relaxed border-t border-divisor">
        El REM no son proyecciones propias del BCRA: es lo que pronostican las consultoras, los
        centros de investigación y los bancos que participan, relevados los últimos tres días
        hábiles de {rem.relevamientoLabel}.
      </p>
    </Card>
  );
}
