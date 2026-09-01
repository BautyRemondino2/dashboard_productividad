import { GRUPO_LABEL, type Grupo, type Radiografia as Lectura, type Tono } from "@/lib/finviz-lectura";

/**
 * La radiografía: qué está pasando con el papel, arriba de todo en la ficha.
 *
 * El orden no es casual y es el argumento del panel entero:
 *
 *  1. **Qué está pasando** — dos o tres oraciones. Si sólo se lee esto, alcanza.
 *  2. **Tensiones** — los cruces que no cierran. Es lo que un panel de métricas
 *     sueltas nunca muestra y lo único que de verdad es un hallazgo.
 *  3. **De qué depende** — en qué mirar para saber si la lectura se sostiene.
 *     Es el borrador de los kill criteria, que se escriben más abajo.
 *  4. **Las señales**, plegadas. Están para verificar de dónde salió cada
 *     frase, no para leerlas de corrido.
 *
 * Lo que el panel **no** dice es qué hacer. Eso es la postura, que se elige en
 * la sección 9 y la firma el analista: una máquina de reglas con umbrales fijos
 * no puede recomendar una posición y un asesor no puede firmar lo que no
 * entiende.
 */

const TONO_TEXTO: Record<Tono, string> = {
  bueno: "text-sube",
  malo: "text-baja",
  atencion: "text-amber-400/90",
  neutro: "text-cuerpo",
};

const TONO_BORDE: Record<Tono, string> = {
  bueno: "border-l-[color:var(--color-sube)]",
  malo: "border-l-[color:var(--color-baja)]",
  atencion: "border-l-amber-500/70",
  neutro: "border-l-separador",
};

const ORDEN_GRUPOS: Grupo[] = [
  "valuacion",
  "crecimiento",
  "calidad",
  "balance",
  "posicionamiento",
  "tape",
  "consenso",
];

export default function Radiografia({ lectura }: { lectura: Lectura }) {
  const { veredicto, tensiones, deQueDepende, señales } = lectura;

  return (
    <div className="space-y-5">
      {/* ── Qué está pasando ─────────────────────────────────────────── */}
      {veredicto.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-tenue">
            Qué está pasando
          </div>
          <div className="font-serif text-[13.5px] leading-[1.65] text-cuerpo max-w-[92ch] space-y-1.5">
            {veredicto.map((v, i) => (
              <p key={i}>{v}</p>
            ))}
          </div>
        </div>
      )}

      {/* ── Tensiones ────────────────────────────────────────────────── */}
      {tensiones.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-tenue">
            Tensiones · lo que no cierra
          </div>
          <div className="grid lg:grid-cols-2 gap-2">
            {tensiones.map((t) => (
              <div
                key={t.titulo}
                className={`border-l-2 ${TONO_BORDE[t.tono]} bg-boton/40 rounded-r-card pl-3 pr-3.5 py-2.5`}
              >
                <div className={`text-[12px] font-medium ${TONO_TEXTO[t.tono]}`}>{t.titulo}</div>
                <p className="text-[11.5px] text-secundario leading-relaxed mt-1">{t.detalle}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── De qué depende ───────────────────────────────────────────── */}
      {deQueDepende.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-tenue">
            De qué depende
          </div>
          <ul className="space-y-1.5">
            {deQueDepende.map((d, i) => (
              <li key={i} className="text-[11.5px] text-secundario leading-relaxed flex gap-2.5">
                <span className="text-tenue shrink-0">·</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Las señales, para verificar ──────────────────────────────── */}
      <details className="group">
        <summary className="cursor-pointer list-none text-[11px] text-meta hover:text-cuerpo transition-colors select-none">
          <span className="group-open:hidden">▸ ver las {señales.length} señales de las que sale esto</span>
          <span className="hidden group-open:inline">▾ ocultar las señales</span>
        </summary>

        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-px bg-divisor border border-divisor rounded-card overflow-hidden mt-3">
          {ORDEN_GRUPOS.map((g) => {
            const delGrupo = señales.filter((s) => s.grupo === g);
            if (delGrupo.length === 0) return null;
            return (
              <div key={g} className="bg-card px-3.5 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-tenue mb-2">
                  {GRUPO_LABEL[g]}
                </div>
                <div className="space-y-2.5">
                  {delGrupo.map((s) => (
                    <div key={s.label}>
                      <div className="flex items-baseline gap-2">
                        <span className="text-[11px] text-label min-w-0">{s.label}</span>
                        <span
                          className={`text-[12px] tabular-nums ml-auto text-right ${TONO_TEXTO[s.tono]}`}
                        >
                          {s.valor}
                        </span>
                      </div>
                      {s.lectura && (
                        <p className="text-[10.5px] text-meta leading-snug mt-0.5">{s.lectura}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </details>

      <p className="text-[10.5px] text-meta-suave leading-relaxed">
        Los umbrales son generales: deuda sobre patrimonio de 2 es mucho para una empresa de
        software y normal para una utility, y un P/E de 25 no significa lo mismo en un banco que
        en una de software. Dónde cae contra sus pares está en el bloque de múltiplos de la
        sección 8. Las dos cosas se leen juntas.
      </p>
    </div>
  );
}
