/**
 * Morning Brief — la agenda del día: a qué hora puede haber volatilidad.
 *
 * Todo sale de fuentes que el dashboard ya tiene, sin pedirle al usuario que
 * cargue nada a mano:
 *  - FOMC: `getProximasReuniones()` de `@/lib/fed` (el calendario oficial).
 *  - Balances: el `proximoEarnings` que `getTablero()` de `@/lib/equity` ya
 *    trae en el mismo lote de quotes que alimenta el ranking. Sale gratis.
 *  - Feriados: `proximosFeriados()` de `@/lib/feriados-mercado`, calculado por
 *    regla. Un día sin rueda cambia cómo se lee todo lo demás.
 *
 * **No hay calendario abierto de publicaciones macro** (CPI, empleo): el BLS
 * bloquea bots con cualquier user-agent y el calendario de FRED no responde.
 * Está verificado y documentado en SKILL.md, así que acá no se intenta: lo que
 * se muestra es lo que de verdad se puede saber.
 */

import { getProximasReuniones } from "@/lib/fed";
import { getTablero } from "@/lib/equity";
import { proximosFeriados } from "@/lib/feriados-mercado";

export interface EventoAgenda {
  fecha: string;
  tipo: "fomc" | "balance" | "feriado";
  titulo: string;
  detalle: string;
  /** Hora de Buenos Aires, cuando se sabe. Es el punto de la agenda. */
  horaArt?: string;
  /** Empresas que reportan ese día, para el tipo "balance". */
  tickers?: string[];
}

/**
 * Una hora de Nueva York pasada a la de Buenos Aires, para la fecha dada.
 *
 * No alcanza con restar una constante: entre marzo y noviembre Nueva York está
 * en horario de verano y la diferencia cambia de dos horas a una. Se deduce
 * comparando, para ese mismo instante, qué hora marca cada zona.
 */
function horaArtDesdeNY(fechaIso: string, horaNY: number): string {
  const instante = new Date(`${fechaIso}T18:00:00Z`);
  const enZona = (tz: string) =>
    Number(
      new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hour12: false }).format(instante)
    );
  const diferencia = enZona("America/Argentina/Buenos_Aires") - enZona("America/New_York");
  const hora = (horaNY + diferencia + 24) % 24;
  return `${String(hora).padStart(2, "0")}:00`;
}

const DIAS_VISTA = 7;

function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Lo que viene en los próximos siete días, ordenado por fecha.
 *
 * La ventana es de una semana y no de un día a propósito: saber el lunes que
 * el miércoles habla la Fed cambia cómo se arma la semana; enterarse el
 * miércoles a las nueve no sirve de nada.
 */
export async function getAgenda(hoy: string): Promise<EventoAgenda[]> {
  const hasta = sumarDias(hoy, DIAS_VISTA);

  const [reuniones, tablero, feriados] = await Promise.all([
    getProximasReuniones(3).catch(() => []),
    getTablero().catch(() => []),
    Promise.resolve().then(() => {
      try {
        return proximosFeriados(hoy, 6);
      } catch {
        return [];
      }
    }),
  ]);

  const eventos: EventoAgenda[] = [];

  for (const r of reuniones) {
    if (r.fecha < hoy || r.fecha > hasta) continue;
    eventos.push({
      fecha: r.fecha,
      tipo: "fomc",
      titulo: "Decisión de la Fed",
      // El comunicado sale siempre a las 15:00 de Nueva York; la conferencia
      // de prensa, media hora después.
      horaArt: horaArtDesdeNY(r.fecha, 15),
      detalle: r.conProyecciones
        ? "con proyecciones económicas y dot plot — el día de mayor volatilidad del trimestre"
        : "comunicado, y conferencia de prensa media hora después",
    });
  }

  // Los balances se agrupan por día: cinco líneas sueltas de cinco empresas
  // que reportan el mismo martes no son cinco eventos, son uno.
  const porDia = new Map<string, string[]>();
  for (const f of tablero) {
    const fecha = f.proximoEarnings;
    if (!fecha || fecha < hoy || fecha > hasta) continue;
    const lista = porDia.get(fecha) ?? [];
    lista.push(f.ticker);
    porDia.set(fecha, lista);
  }
  for (const [fecha, tickers] of porDia) {
    const orden = tickers.sort();
    eventos.push({
      fecha,
      tipo: "balance",
      titulo: orden.length === 1 ? `Balance de ${orden[0]}` : `${orden.length} balances`,
      detalle: orden.slice(0, 8).join(", ") + (orden.length > 8 ? ` y ${orden.length - 8} más` : ""),
      tickers: orden,
    });
  }

  for (const f of feriados) {
    if (f.fecha < hoy || f.fecha > hasta) continue;
    eventos.push({
      fecha: f.fecha,
      tipo: "feriado",
      titulo: `${f.nombre}${f.medioDia ? " (media rueda)" : " — sin rueda"}`,
      detalle: f.consecuencia,
    });
  }

  return eventos.sort((a, b) => a.fecha.localeCompare(b.fecha));
}
