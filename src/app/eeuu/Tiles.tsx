import Sparkline from "@/components/Sparkline";
import { fmtFecha } from "@/lib/equity-formato";
import type { IndicadorUsa } from "@/lib/eeuu";

/** El valor ya formateado según su unidad, en formato es-AR. */
function fmtValor(v: number | null, unidad: IndicadorUsa["unidad"]): string {
  if (v == null) return "—";
  const n = (d: number) =>
    v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
  switch (unidad) {
    case "%": return `${n(1)}%`;
    case "pb": return `${n(0)} pb`;
    case "miles": return `${n(0)} mil`;
    case "k viviendas": return `${n(0)} mil`;
    case "mil M USD": return `${v.toLocaleString("es-AR", { maximumFractionDigits: 0 })} mil M`;
    default: return n(1);
  }
}

/** Decimales del cambio: los que hacen falta para que el número no sea "0,0". */
function decimalesCambio(unidad: IndicadorUsa["unidad"]): number {
  if (unidad === "pb" || unidad === "miles" || unidad === "mil M USD" || unidad === "k viviendas") return 0;
  return 2;
}

/**
 * El cambio, o nada. Un "-0,0" ocupa el mismo lugar que un movimiento real y no
 * dice nada: si redondeado a su precisión da cero, se omite la línea entera.
 */
function fmtCambio(v: number | null, unidad: IndicadorUsa["unidad"]): string {
  if (v == null) return "";
  const dec = decimalesCambio(unidad);
  if (Math.abs(v) < 0.5 / 10 ** dec) return "";
  const signo = v > 0 ? "+" : "";
  return `${signo}${v.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
}

/**
 * La fecha del dato, leída como la lee quien publica la serie.
 *
 * FRED estampa el dato mensual el día 1 del mes y el trimestral el día 1 del
 * trimestre. Imprimir eso tal cual —"1 jul"— inventa una precisión diaria que
 * el dato no tiene: el desempleo de julio no se midió el 1 de julio, es julio
 * entero. Por eso la frecuencia viaja con el indicador.
 */
function fmtFechaDato(iso: string | null, frecuencia: IndicadorUsa["frecuencia"]): string {
  if (!iso) return "—";
  const [a, m] = iso.split("-").map(Number);
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const anioCorto = String(a).slice(2);
  if (frecuencia === "trimestral") return `${Math.floor((m - 1) / 3) + 1}T ${anioCorto}`;
  if (frecuencia === "mensual") return `${meses[m - 1]} ${anioCorto}`;
  return fmtFecha(iso);
}

/**
 * El color del cambio codifica si el movimiento es buena o mala noticia, no su
 * signo. Un desempleo que sube y un VIX que sube son ambos rojos aunque el
 * número vaya para arriba; el balance de la Fed o el dólar no tienen un lado
 * "bueno" y van en gris a propósito.
 */
function tono(cambio: number | null, mejor: IndicadorUsa["mejor"]): string {
  if (cambio == null || cambio === 0 || mejor === "neutro") return "text-meta";
  const favorable = mejor === "alto" ? cambio > 0 : cambio < 0;
  return favorable ? "text-sube" : "text-baja";
}

function colorSpark(ind: IndicadorUsa): string {
  if (ind.mejor === "neutro" || ind.cambio == null || ind.cambio === 0) return "#64748b";
  const favorable = ind.mejor === "alto" ? ind.cambio > 0 : ind.cambio < 0;
  return favorable ? "#34d399" : "#f87171";
}

/**
 * La grilla de indicadores: número grande, cómo se movió, la miniatura de la
 * serie y —siempre— la línea que dice qué mide y cómo se lee.
 *
 * Esa última línea es la que convierte la grilla en algo consultable. "Confianza
 * del consumidor 55,2" no le dice nada a nadie; "base 100 = 1966, abajo de 70 es
 * pesimismo marcado" lo vuelve una lectura.
 */
export default function Tiles({ indicadores }: { indicadores: IndicadorUsa[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 divide-divisor-fino">
      {indicadores.map((ind, i) => (
        <div
          key={ind.clave}
          className={`p-[18px] ${i % 4 !== 0 ? "xl:border-l" : ""} ${
            i % 2 !== 0 ? "sm:border-l xl:border-l" : ""
          } ${i >= 4 ? "xl:border-t" : ""} ${i >= 2 ? "sm:border-t" : ""} border-divisor-fino`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] text-label truncate">{ind.label}</div>
              <div className="text-[21px] font-semibold text-num tabular-nums mt-1 leading-none">
                {fmtValor(ind.valor, ind.unidad)}
              </div>
            </div>
            <div className="shrink-0 pt-0.5" style={{ color: colorSpark(ind) }}>
              <Sparkline data={ind.serie} color={colorSpark(ind)} width={64} height={22} />
            </div>
          </div>

          <div className="flex items-baseline gap-2 mt-1.5">
            <span className={`text-[11px] tabular-nums ${tono(ind.cambio, ind.mejor)}`}>
              {fmtCambio(ind.cambio, ind.unidad)}
            </span>
            <span className="text-[10px] text-meta-suave ml-auto">
              {fmtFechaDato(ind.fecha, ind.frecuencia)}
            </span>
          </div>

          <p className="text-[10.5px] text-meta leading-relaxed mt-2">{ind.nota}</p>
        </div>
      ))}
    </div>
  );
}
