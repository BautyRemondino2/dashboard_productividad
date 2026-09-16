/**
 * Morning Brief — arma el snapshot que se le manda a Claude.
 *
 * Es el único input del modelo (ver `morning-brief-claude.ts`): fecha, hora,
 * indicadores ya calculados, agenda de hoy y clientes activos. Nada de esto
 * lo busca Claude.
 */
import { construirIndicadores } from "@/lib/morning-brief-datos";
import { listarAgenda, listarClientes } from "@/lib/morning-brief-db";
import { hoyEnArgentina } from "@/lib/rava";
import type { AgendaSnapshot, ClienteSnapshot, SnapshotBrief } from "@/lib/morning-brief-tipos";

/** Hora actual en Buenos Aires, HH:mm — misma zona que `hoyEnArgentina()`. */
function horaEnArgentina(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export async function construirSnapshot(): Promise<SnapshotBrief> {
  const fecha = hoyEnArgentina();

  const [indicadores, agendaHoy, clientes] = await Promise.all([
    construirIndicadores(),
    Promise.resolve(listarAgenda(fecha)),
    Promise.resolve(listarClientes(true)),
  ]);

  const agenda: AgendaSnapshot[] = agendaHoy.map((a) => ({
    hora_art: a.hora_art,
    evento: a.evento,
    consenso: a.consenso,
    anterior: a.anterior,
    dato: a.dato,
  }));

  const clientesSnapshot: ClienteSnapshot[] = clientes.map((c) => ({
    alias: c.alias,
    perfil: c.perfil,
    tenencias: c.tenencias,
    eventos: c.eventos,
  }));

  return {
    fecha,
    hora: horaEnArgentina(),
    indicadores,
    agenda,
    clientes: clientesSnapshot,
  };
}
