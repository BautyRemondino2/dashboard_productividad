import { PROVINCIAS } from "@/lib/provincias";

/**
 * Quién gobierna: el Ejecutivo nacional y el reparto de las 24 provincias.
 *
 * Los indicadores macro —inflación, actividad, reservas, empleo— ya están en
 * los tiles de arriba, así que acá no se repiten. Lo que suma es el mapa
 * político: cuántas jurisdicciones responde cada espacio y cuánta población y
 * empleo privado concentra, que es lo que define el peso real de cada bloque.
 */
export default function Gobierno() {
  const porBloque = new Map<string, { provincias: number; poblacion: number }>();
  for (const p of PROVINCIAS) {
    const acc = porBloque.get(p.bloque) ?? { provincias: 0, poblacion: 0 };
    acc.provincias += 1;
    acc.poblacion += p.poblacion ?? 0;
    porBloque.set(p.bloque, acc);
  }

  const poblacionTotal = [...porBloque.values()].reduce((s, b) => s + b.poblacion, 0);
  const bloques = [...porBloque.entries()].sort((a, b) => b[1].poblacion - a[1].poblacion);

  return (
    <section className="rounded-card border border-borde bg-card overflow-hidden">
      <header className="px-4 py-3 border-b border-borde flex items-baseline gap-3">
        <h2 className="text-[13px] font-semibold text-cuerpo">Quién gobierna</h2>
        <span className="text-[10px] text-meta-suave">Ejecutivo nacional y las 24 jurisdicciones</span>
      </header>

      <div className="p-4 grid sm:grid-cols-[220px_1fr] gap-6">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-meta-suave">Presidente</p>
          <p className="text-[17px] font-semibold text-titulo mt-0.5">Javier Milei</p>
          <p className="text-[12px] text-secundario">La Libertad Avanza</p>
          <p className="text-[11px] text-meta-suave mt-1">Mandato 2023 – 2027</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-outline text-secundario">
              Derecha liberal
            </span>
          </div>
          <p className="text-[10px] text-meta-suave leading-relaxed mt-3">
            Sin gobernación propia: La Libertad Avanza no ganó ninguna provincia en
            2023, así que gobierna con acuerdos.
          </p>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-meta-suave mb-2">
            Las 24 jurisdicciones, por espacio
          </p>
          <div className="space-y-2">
            {bloques.map(([bloque, b]) => {
              const pct = (b.poblacion / poblacionTotal) * 100;
              return (
                <div key={bloque} className="flex items-center gap-3">
                  <span className="text-[11px] text-secundario w-20 shrink-0">{bloque}</span>
                  <span className="text-[11px] text-meta-suave tabular-nums w-8 shrink-0">
                    {b.provincias}
                  </span>
                  <div className="h-[3px] flex-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[11px] text-secundario tabular-nums w-24 text-right shrink-0">
                    {(b.poblacion / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M hab.
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-meta-suave mt-3">
            La barra es población, no cantidad de provincias: Formosa y Buenos Aires
            pesan un voto cada una en el Senado pero cuarenta y cinco veces distinto en
            la economía.
          </p>
        </div>
      </div>
    </section>
  );
}
