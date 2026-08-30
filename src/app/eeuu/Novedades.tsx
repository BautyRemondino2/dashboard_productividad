import { getNovedadesFed, type NovedadFed } from "@/lib/fed";

const ETIQUETA: Record<NovedadFed["tipo"], string> = {
  discurso: "discurso",
  comunicado: "comunicado",
  testimonio: "testimonio",
};

const TONO: Record<NovedadFed["tipo"], string> = {
  discurso: "border-sky-900/70 text-sky-400/90",
  comunicado: "border-amber-900/70 text-amber-500/90",
  testimonio: "border-violet-900/70 text-violet-400/90",
};

/** "28 ago" a partir de un ISO con hora. */
function fecha(iso: string): string {
  const d = new Date(iso);
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d.getUTCDate()} ${meses[d.getUTCMonth()]}`;
}

/**
 * Qué dijo la Fed, de sus propios feeds.
 *
 * Discursos, comunicados de política monetaria y testimonios ante el Congreso,
 * mezclados y ordenados por fecha. Es la fuente primaria: lo que llega por
 * canales de WhatsApp es casi siempre la interpretación de alguien sobre uno de
 * estos links, con horas de retraso y sin el original a mano.
 *
 * Los títulos van en inglés a propósito: son el nombre propio del documento y
 * traducirlos haría más difícil encontrarlo después.
 */
export default async function Novedades() {
  let novedades: NovedadFed[] = [];
  try {
    novedades = await getNovedadesFed(10);
  } catch {
    return null;
  }
  if (novedades.length === 0) return null;

  return (
    <div className="divide-y divide-divisor-fino">
      {novedades.map((n) => (
        <a
          key={n.link}
          href={n.link}
          target="_blank"
          rel="noreferrer"
          className="block px-[18px] py-2.5 hover:bg-chip/60 transition-colors group"
        >
          <div className="flex items-baseline gap-2.5">
            <span className="text-[10px] text-meta-suave tabular-nums w-12 shrink-0">
              {fecha(n.fecha)}
            </span>
            <span
              className={`text-[9.5px] px-1.5 py-px rounded-badge border shrink-0 ${TONO[n.tipo]}`}
            >
              {ETIQUETA[n.tipo]}
            </span>
            <span className="text-[12.5px] text-cuerpo group-hover:text-titulo transition-colors min-w-0">
              {n.orador && <span className="text-secundario font-medium">{n.orador}: </span>}
              {n.titulo}
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}
