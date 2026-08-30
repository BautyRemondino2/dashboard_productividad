import Card from "@/components/Card";
import { getInflacionUsa } from "@/lib/eeuu";
import InflacionChart from "./InflacionChart";
import LinkGlosario from "./LinkGlosario";

/** El mes del dato en castellano: "julio 2026". */
function mesLargo(iso: string | null): string {
  if (!iso) return "—";
  const [a, m] = iso.split("-").map(Number);
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return `${meses[m - 1]} ${a}`;
}

function Dato({
  label,
  valor,
  sub,
  destacado = false,
}: {
  label: string;
  valor: number | null;
  sub: React.ReactNode;
  destacado?: boolean;
}) {
  // Contra la meta del 2%: arriba tiñe, abajo o en línea queda neutro. Es la
  // única lectura que importa de un número de inflación en EE.UU.
  const lejos = valor != null && valor >= 3;
  return (
    <div className="min-w-[128px] flex-1">
      <div className="text-[10px] uppercase tracking-[0.1em] text-tenue">{label}</div>
      <div
        className={`${destacado ? "text-[23px]" : "text-[19px]"} font-semibold tabular-nums mt-1 leading-none ${
          lejos ? "text-baja" : "text-num"
        }`}
      >
        {valor == null
          ? "—"
          : `${valor.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
      </div>
      <div className="text-[10.5px] text-meta mt-1.5">{sub}</div>
    </div>
  );
}

/**
 * La inflación de EE.UU., que es la variable que decide la tasa.
 *
 * Cuatro lecturas y no una: el IPC que titulan los diarios, el núcleo que saca
 * alimentos y energía, el PCE núcleo —sobre el que está definida la meta del 2%,
 * y que sale un mes más tarde— y el breakeven de los TIPS, que no es un dato
 * pasado sino lo que el mercado *paga* hoy por cubrirse de la inflación futura.
 * Cuando el breakeven se despega del 2% es cuando la Fed se pone nerviosa.
 */
export default async function PanelInflacion() {
  const inf = await getInflacionUsa().catch(() => null);
  if (!inf) return null;

  return (
    <Card
      titulo="Inflación en EE.UU."
      nota="Interanual · la meta de la Fed es 2% sobre el PCE núcleo"
      acento="#fb923c"
      derecha={<span>IPC de {mesLargo(inf.fechaCpi)}</span>}
    >
      <div className="flex gap-5 flex-wrap pb-4 mb-1 border-b border-divisor-fino">
        <Dato
          label="IPC"
          valor={inf.cpiIa}
          destacado
          sub={
            inf.cpiMensual != null
              ? `${inf.cpiMensual > 0 ? "+" : ""}${inf.cpiMensual.toLocaleString("es-AR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}% en el mes`
              : "interanual"
          }
        />
        <Dato label="IPC núcleo" valor={inf.coreIa} sub="sin alimentos ni energía" />
        <Dato
          label="PCE núcleo"
          valor={inf.pceCoreIa}
          sub={
            <>
              <LinkGlosario termino="PCE núcleo">la meta de la Fed</LinkGlosario> ·{" "}
              {mesLargo(inf.fechaPce)}
            </>
          }
        />
        <Dato
          label="Breakeven 10a"
          valor={inf.breakeven10}
          sub={
            <LinkGlosario termino="Breakeven de inflación">
              lo que descuentan los TIPS
            </LinkGlosario>
          }
        />
        <Dato label="Forward 5a5a" valor={inf.forward5y5y} sub="el ancla de largo plazo" />
      </div>

      <InflacionChart filas={inf.grafico} />
    </Card>
  );
}
