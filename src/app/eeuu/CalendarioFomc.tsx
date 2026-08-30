import { getProximasReuniones } from "@/lib/fed";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function diasHasta(iso: string): number {
  const hoy = new Date();
  const a = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - a) / 86_400_000);
}

/** "15–16 de septiembre" (o "30 de abril – 1 de mayo" si cruza de mes). */
function rango(inicio: string, fin: string): string {
  const [, mi, di] = inicio.split("-").map(Number);
  const [, mf, df] = fin.split("-").map(Number);
  if (mi === mf) return `${di}–${df} de ${MESES[mf - 1]}`;
  return `${di} de ${MESES[mi - 1]} – ${df} de ${MESES[mf - 1]}`;
}

/**
 * El calendario del FOMC, del calendario oficial de la Fed.
 *
 * Las reuniones con proyecciones —cuatro por año— son las que traen el *dot
 * plot*: dónde ve cada miembro del comité la tasa a fin de año y en el largo
 * plazo. Suelen mover más al mercado que la decisión de tasa en sí, que
 * generalmente ya está descontada.
 */
export default async function CalendarioFomc() {
  let reuniones: Awaited<ReturnType<typeof getProximasReuniones>> = [];
  try {
    reuniones = await getProximasReuniones(8);
  } catch {
    return null;
  }
  if (reuniones.length === 0) return null;

  return (
    <div className="divide-y divide-divisor-fino">
      {reuniones.map((r, i) => {
        const dias = diasHasta(r.fecha);
        return (
          <div key={r.fecha} className="px-[18px] py-2 flex items-baseline gap-2.5">
            <span
              className={`text-[12px] ${i === 0 ? "text-titulo font-medium" : "text-cuerpo"} min-w-0`}
            >
              {rango(r.fechaInicio, r.fecha)}
              <span className="text-meta-suave ml-1.5 text-[10px]">
                {new Date(r.fecha + "T12:00:00Z").getUTCFullYear()}
              </span>
            </span>
            {r.conProyecciones && (
              <span
                className="text-[9.5px] px-1.5 py-px rounded-badge border border-outline text-secundario shrink-0"
                title="Se publica el Summary of Economic Projections (dot plot)"
              >
                dot plot
              </span>
            )}
            <span className="text-[10px] text-meta-suave tabular-nums ml-auto shrink-0">
              {dias <= 0 ? "hoy" : `en ${dias} d`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
