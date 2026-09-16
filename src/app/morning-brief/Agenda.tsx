import Card from "@/components/Card";
import type { EventoAgenda } from "@/lib/morning-brief-agenda";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const COLOR: Record<EventoAgenda["tipo"], string> = {
  fomc: "#f87171",
  balance: "#fbbf24",
  feriado: "#38bdf8",
};

function etiquetaDia(iso: string, hoy: string): string {
  if (iso === hoy) return "Hoy";
  const d = new Date(`${iso}T12:00:00Z`);
  const manana = new Date(`${hoy}T12:00:00Z`);
  manana.setUTCDate(manana.getUTCDate() + 1);
  if (iso === manana.toISOString().slice(0, 10)) return "Mañana";
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

/**
 * Qué viene esta semana, para saber a qué hora puede haber volatilidad.
 *
 * Sale de lo que el dashboard ya sabe: el calendario del FOMC, la fecha del
 * próximo balance de cada papel del universo y los feriados de los dos
 * mercados. El calendario de datos macro (CPI, empleo) no tiene fuente
 * abierta —está probado y documentado en SKILL.md—, así que no se promete.
 */
export default function Agenda({ eventos, hoy }: { eventos: EventoAgenda[]; hoy: string }) {
  return (
    <Card
      titulo="Agenda"
      nota="los próximos siete días · FOMC, balances y días sin rueda"
      cuerpo={false}
    >
      {eventos.length === 0 ? (
        <p className="px-[18px] py-3 text-[12px] text-meta-suave">
          Nada en el calendario de acá a una semana: ni reunión de la Fed, ni balances de los papeles
          del universo, ni feriados.
        </p>
      ) : (
        <div className="divide-y divide-divisor-fino">
          {eventos.map((e, i) => (
            <div key={`${e.fecha}-${e.tipo}-${i}`} className="px-[18px] py-2 flex items-baseline gap-2.5">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0 self-center"
                style={{ background: COLOR[e.tipo] }}
              />
              <span className="text-[11px] text-meta-suave w-[132px] shrink-0">
                {etiquetaDia(e.fecha, hoy)}
                {e.horaArt && <span className="text-cuerpo tabular-nums ml-1.5">{e.horaArt}</span>}
              </span>
              <span className="text-[12.5px] text-titulo font-medium shrink-0">{e.titulo}</span>
              <span className="text-[11.5px] text-secundario leading-snug">{e.detalle}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
