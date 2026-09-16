import Card from "@/components/Card";
import { formatValor } from "@/lib/mercado";
import { BLOQUE_LABEL, BLOQUE_NOTA, type BloqueBrief, type TipoVariacion } from "@/lib/morning-brief-config";
import type { IndicadorBrief } from "@/lib/morning-brief-datos";

export function formatVariacion(variacion: number, tipo: TipoVariacion): string {
  const signo = variacion > 0 ? "+" : variacion < 0 ? "−" : "";
  const abs = Math.abs(variacion);
  const num = (decimales: number) => abs.toLocaleString("es-AR", { maximumFractionDigits: decimales });

  if (tipo === "pct") return `${signo}${num(2)}%`;
  if (tipo === "pp") return `${signo}${num(2)} pp`;
  return `${signo}${num(0)} pb`;
}

/**
 * Cuántas columnas para N tiles.
 *
 * Las clases son literales porque Tailwind no puede generar una clase armada
 * en runtime. El tope existe para los bloques que viven en media pantalla: seis
 * columnas ahí dejan tiles de cien píxeles.
 */
const COLUMNAS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-5",
  6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
};

function columnasPara(n: number, tope = 6): string {
  return COLUMNAS[Math.min(n, tope)] ?? COLUMNAS[6];
}

/**
 * Un indicador: nombre, valor y cuánto se movió.
 *
 * El acento ámbar marca el movimiento inusual —más de dos desvíos contra sus
 * últimas 60 ruedas—, que es lo único que justifica frenar el barrido y mirar
 * dos veces. Si todo estuviera resaltado, nada lo estaría.
 */
function Tile({ ind }: { ind: IndicadorBrief }) {
  const sinDato = ind.valor == null;
  const sube = (ind.variacion ?? 0) > 0;

  return (
    <div
      className={`px-3.5 py-2.5 border-r border-b border-divisor ${ind.inusual ? "bg-amber-500/[0.07]" : ""}`}
      title={ind.nota ?? undefined}
    >
      <div className="flex items-baseline gap-1.5">
        <span className="text-[10px] uppercase tracking-[0.08em] text-tenue truncate">
          {ind.label}
        </span>
        {ind.inusual && (
          <span
            className="text-[8.5px] px-1 rounded-badge border border-amber-700/60 text-amber-400 shrink-0"
            title="Se movió más de dos desvíos contra sus últimas 60 ruedas"
          >
            !
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
        <span className="text-[15px] font-semibold text-num tabular-nums leading-none">
          {sinDato ? <span className="text-meta-suave text-[13px]">s/d</span> : formatValor(ind.valor as number, ind.unidad)}
        </span>
        {ind.variacion != null && !sinDato && (
          <span className={`text-[11px] tabular-nums ${sube ? "text-sube" : "text-baja"}`}>
            {formatVariacion(ind.variacion, ind.tipoVariacion)}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Grilla de tiles.
 *
 * Los separadores van como borde de cada celda y no como `gap` pintado sobre
 * el fondo: un grupo de tres en una grilla de seis dejaba media fila de huecos
 * oscuros, porque el fondo del contenedor asomaba donde no había tile. Con
 * bordes, lo que no existe no se dibuja. El `overflow-hidden` del Card se come
 * el borde sobrante de la última columna.
 */
function Grilla({ indicadores, tope }: { indicadores: IndicadorBrief[]; tope?: number }) {
  return (
    <div className={`grid ${columnasPara(indicadores.length, tope)} -mb-px`}>
      {indicadores.map((ind) => (
        <Tile key={ind.id} ind={ind} />
      ))}
    </div>
  );
}

function EtiquetaGrupo({ texto }: { texto: string }) {
  return (
    <p className="px-3.5 pt-2.5 pb-1 text-[10px] uppercase tracking-[0.1em] text-meta-suave">
      {texto}
    </p>
  );
}

export default function BloqueIndicadores({
  bloque,
  indicadores,
  tope,
  gruposEnFila = false,
  derecha,
  children,
}: {
  bloque: BloqueBrief;
  indicadores: IndicadorBrief[];
  /** Máximo de columnas por grilla. Menos en los bloques de media pantalla. */
  tope?: number;
  /**
   * Los subgrupos, uno al lado del otro en vez de apilados. Es lo que quiere
   * "Asia | Europa": son dos mitades de la misma pregunta y se leen juntas.
   */
  gruposEnFila?: boolean;
  derecha?: React.ReactNode;
  children?: React.ReactNode;
}) {
  if (indicadores.length === 0 && !children) return null;

  const grupos = new Map<string, IndicadorBrief[]>();
  for (const ind of indicadores) {
    const clave = ind.grupo ?? "";
    const lista = grupos.get(clave) ?? [];
    lista.push(ind);
    grupos.set(clave, lista);
  }
  const entradas = [...grupos.entries()];

  return (
    <Card titulo={BLOQUE_LABEL[bloque]} nota={BLOQUE_NOTA[bloque]} derecha={derecha} cuerpo={false}>
      {gruposEnFila && entradas.length > 1 ? (
        <div className={`grid grid-cols-1 ${entradas.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
          {entradas.map(([grupo, lista]) => (
            <div key={grupo} className="border-r border-divisor last:border-r-0">
              <EtiquetaGrupo texto={grupo} />
              <Grilla indicadores={lista} tope={lista.length} />
            </div>
          ))}
        </div>
      ) : (
        entradas.map(([grupo, lista]) => (
          <div key={grupo}>
            {grupo && <EtiquetaGrupo texto={grupo} />}
            <Grilla indicadores={lista} tope={tope} />
          </div>
        ))
      )}
      {children}
    </Card>
  );
}
