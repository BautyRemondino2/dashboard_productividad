/**
 * Morning Brief — validación posterior, en código.
 *
 * Claude puede citar mal un id o un alias, o apoyarse en un dato viejo sin
 * darse cuenta. Esto no se corrige solo: se detecta y se muestra como
 * advertencia, en rojo, arriba de todo el brief.
 */
import type { Advertencia, BriefClaude, SnapshotBrief } from "@/lib/morning-brief-tipos";

/** Todos los ids de indicador que el brief cita, de cualquier bloque. */
function idsCitados(brief: BriefClaude): string[] {
  const out: string[] = [];
  for (const paso of brief.cadena) out.push(...paso.evidencia);
  out.push(...brief.argentina.evidencia);
  for (const c of brief.contactos) out.push(...c.evidencia);
  for (const p of brief.predicciones) out.push(p.indicador);
  return out;
}

export function validarBrief(brief: BriefClaude, snapshot: SnapshotBrief): Advertencia[] {
  const advertencias: Advertencia[] = [];
  const indicadoresPorId = new Map(snapshot.indicadores.map((i) => [i.id, i]));
  const aliasClientes = new Set(snapshot.clientes.map((c) => c.alias));

  const vistos = new Set<string>();
  for (const id of idsCitados(brief)) {
    if (vistos.has(id)) continue;
    vistos.add(id);

    const ind = indicadoresPorId.get(id);
    if (!ind) {
      advertencias.push({ tipo: "id_inexistente", mensaje: `Se citó "${id}", que no existe en el snapshot.` });
      continue;
    }
    if (ind.valor == null) {
      advertencias.push({ tipo: "id_sin_valor", mensaje: `"${id}" (${ind.label}) se citó sin tener valor.` });
      continue;
    }
    if (ind.fecha_dato !== snapshot.fecha) {
      advertencias.push({
        tipo: "id_desactualizado",
        mensaje: `"${id}" (${ind.label}) se citó con un dato del ${ind.fecha_dato}, no de hoy (${snapshot.fecha}).`,
      });
    }
  }

  const aliasVistos = new Set<string>();
  for (const c of brief.contactos) {
    if (aliasVistos.has(c.alias)) continue;
    aliasVistos.add(c.alias);
    if (!aliasClientes.has(c.alias)) {
      advertencias.push({ tipo: "alias_inexistente", mensaje: `Se nombró a "${c.alias}", que no existe entre los clientes cargados.` });
    }
  }

  return advertencias;
}
