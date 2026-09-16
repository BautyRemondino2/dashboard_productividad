import Card from "@/components/Card";
import type { BriefClaude, DireccionPrediccion } from "@/lib/morning-brief-tipos";

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] px-1.5 py-px rounded-badge bg-chip text-secundario tabular-nums">
      {children}
    </span>
  );
}

function Evidencia({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
      {ids.map((id) => (
        <Chip key={id}>{id}</Chip>
      ))}
    </div>
  );
}

const DIRECCION_LABEL: Record<DireccionPrediccion, string> = {
  sube: "↑ sube",
  baja: "↓ baja",
  estable: "→ estable",
};

const DIRECCION_COLOR: Record<DireccionPrediccion, string> = {
  sube: "text-sube",
  baja: "text-baja",
  estable: "text-secundario",
};

/** El brief de Claude entero: régimen, cadena de 8 pasos, Argentina, agenda, contactos y predicciones. */
export default function BriefResultado({
  brief,
  tesisPropia,
}: {
  brief: BriefClaude;
  tesisPropia: string;
}) {
  return (
    <div className="space-y-4">
      <Card
        titulo={brief.titular}
        nota={`régimen: ${brief.regimen}`}
        cuerpo={false}
      >
        <div className="divide-y divide-divisor-fino">
          {brief.cadena.map((paso, i) => (
            <div key={i} className="px-[18px] py-3">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-tenue mb-1">
                {paso.paso}
              </p>
              <p className="text-[12.5px] text-cuerpo leading-relaxed">{paso.lectura}</p>
              <Evidencia ids={paso.evidencia} />
            </div>
          ))}
        </div>
      </Card>

      <Card titulo="Argentina" nota="lo global traducido a lo local">
        <p className="text-[12.5px] text-cuerpo leading-relaxed">{brief.argentina.lectura}</p>
        <Evidencia ids={brief.argentina.evidencia} />
      </Card>

      {brief.agenda.length > 0 && (
        <Card titulo="Agenda de hoy" cuerpo={false}>
          <div className="divide-y divide-divisor-fino">
            {brief.agenda.map((a, i) => (
              <div key={i} className="px-[18px] py-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] text-meta-suave tabular-nums shrink-0">{a.hora_art}</span>
                  <h3 className="text-[12.5px] font-medium text-titulo">{a.evento}</h3>
                </div>
                <p className="text-[12px] text-secundario leading-relaxed mt-1">{a.por_que_importa}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {brief.contactos.length > 0 && (
        <Card titulo="Contactos sugeridos" nota="para informar, no es una orden de compra o venta" cuerpo={false}>
          <div className="divide-y divide-divisor-fino">
            {brief.contactos.map((c, i) => (
              <div key={i} className="px-[18px] py-3">
                <h3 className="text-[12.5px] font-medium text-titulo">{c.alias}</h3>
                <p className="text-[12px] text-secundario leading-relaxed mt-1">{c.motivo}</p>
                <Evidencia ids={c.evidencia} />
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card titulo="Tu tesis" acento="#38bdf8">
          <p className="text-[12.5px] text-cuerpo leading-relaxed whitespace-pre-wrap">{tesisPropia}</p>
        </Card>
        <Card titulo="Tesis de Claude" acento="#a78bfa">
          <p className="text-[12.5px] text-cuerpo leading-relaxed whitespace-pre-wrap">{brief.tesis}</p>
        </Card>
      </div>

      <Card titulo="Predicciones" nota="verificables al cierre" cuerpo={false}>
        <div className="divide-y divide-divisor-fino">
          {brief.predicciones.map((p, i) => (
            <div key={i} className="px-[18px] py-2.5 flex items-baseline gap-2.5">
              <span className={`text-[11.5px] font-medium shrink-0 ${DIRECCION_COLOR[p.direccion]}`}>
                {DIRECCION_LABEL[p.direccion]}
              </span>
              <p className="text-[12.5px] text-cuerpo leading-snug">{p.enunciado}</p>
              <span className="ml-auto shrink-0">
                <Chip>{p.indicador}</Chip>
              </span>
            </div>
          ))}
        </div>
      </Card>

      {brief.datos_faltantes.length > 0 && (
        <Card titulo="Datos faltantes" nota="no se usaron para afirmar nada">
          <ul className="space-y-1">
            {brief.datos_faltantes.map((d, i) => (
              <li key={i} className="text-[12px] text-meta-suave leading-relaxed">
                {d}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
