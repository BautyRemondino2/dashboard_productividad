import Card from "@/components/Card";
import { getPosturaFed } from "@/lib/eeuu";
import PosturaChart from "./PosturaChart";
import LinkGlosario from "./LinkGlosario";

const pct = (v: number, dec = 2) =>
  `${v.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec })}%`;

/** La lectura en castellano de dónde cae la tasa real. */
function lectura(real: number): { texto: string; tono: string } {
  if (real < 0)
    return {
      texto: "negativa: la política monetaria está estimulando, no frenando",
      tono: "text-sube",
    };
  if (real < 0.75)
    return {
      texto: "cerca de cero: expansiva pese a un nivel nominal que parece alto",
      tono: "text-sube",
    };
  if (real < 1.5)
    return { texto: "en torno a neutral: ni frena ni estimula", tono: "text-cuerpo" };
  if (real < 2.5)
    return { texto: "restrictiva: está enfriando la actividad a propósito", tono: "text-baja" };
  return { texto: "muy restrictiva: pocas veces se sostuvo tanto tiempo", tono: "text-baja" };
}

function Termino({
  valor,
  label,
  grande = false,
  tono = "text-num",
}: {
  valor: string;
  label: React.ReactNode;
  grande?: boolean;
  tono?: string;
}) {
  return (
    <span className="flex flex-col">
      <span
        className={`${grande ? "text-[27px] tracking-[-0.02em]" : "text-[19px]"} font-semibold tabular-nums leading-none ${tono}`}
      >
        {valor}
      </span>
      <span className="text-[10px] text-meta-suave mt-1.5">{label}</span>
    </span>
  );
}

const Operador = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[15px] text-meta pb-[22px]">{children}</span>
);

/**
 * La postura de la Fed — la cuenta que explica el resto de la página.
 *
 * Un asesor que sólo mira el nivel nominal se pierde lo importante: una tasa
 * de 3,63% con inflación núcleo de 3,3% no aprieta nada. Esta resta es la que
 * explica por qué el mercado puede estar descontando subas con una tasa que a
 * primera vista suena alta, y es lo que hay que poder contestar cuando un
 * cliente pregunta si la Fed "ya terminó".
 */
export default async function PanelPostura() {
  const p = await getPosturaFed().catch(() => null);
  if (!p) return null;

  const { texto, tono } = lectura(p.real);

  return (
    <Card
      titulo="Postura de la Fed"
      nota="Tasa real = efectiva − PCE núcleo · el nivel nominal solo no dice nada"
      acento="#38bdf8"
    >
      {/* Cada término lleva su etiqueta debajo, en la misma columna: alinearlas
          con márgenes fijos se rompe en cuanto un número cambia de ancho. */}
      <div className="flex items-end gap-3 flex-wrap">
        <Termino valor={pct(p.nominal)} label="efectiva" />
        <Operador>−</Operador>
        <Termino
          valor={pct(p.inflacionNucleo)}
          label={<LinkGlosario termino="PCE núcleo">inflación núcleo</LinkGlosario>}
        />
        <Operador>=</Operador>
        <Termino
          valor={`${p.real > 0 ? "+" : ""}${pct(p.real)}`}
          label="tasa real"
          grande
          tono={tono}
        />
        <span className="text-[11.5px] text-secundario leading-relaxed pb-1 min-w-[180px] flex-1">
          {texto}
        </span>
      </div>

      <div className="mt-4 pt-3 border-t border-divisor-fino">
        <PosturaChart filas={p.serie} />
        <p className="text-[10.5px] text-meta leading-relaxed mt-2">
          Cinco años de tasa real. Como regla de bolsillo, cerca de cero es expansivo y arriba de
          1,5% restrictivo — pero la tasa neutral no se observa y cada modelo estima una distinta,
          así que el número se lee mejor contra su propia historia que contra un umbral fijo.
        </p>
      </div>
    </Card>
  );
}
