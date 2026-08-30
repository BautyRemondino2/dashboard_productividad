import Card from "@/components/Card";
import { getCurvaTesoro } from "@/lib/eeuu";
import CurvaTesoroChart from "./CurvaTesoroChart";
import { fmtFecha } from "@/lib/equity-formato";
import LinkGlosario from "./LinkGlosario";

function Spread({
  label,
  valor,
  nota,
}: {
  label: string;
  valor: number | null;
  nota: React.ReactNode;
}) {
  const invertida = valor != null && valor < 0;
  return (
    <div className="flex-1 min-w-[150px]">
      <div className="text-[10px] uppercase tracking-[0.1em] text-tenue">{label}</div>
      <div
        className={`text-[19px] font-semibold tabular-nums mt-1 leading-none ${
          invertida ? "text-baja" : "text-num"
        }`}
      >
        {valor == null
          ? "—"
          : `${valor > 0 ? "+" : ""}${valor.toLocaleString("es-AR", { maximumFractionDigits: 0 })} pb`}
      </div>
      <p className="text-[10.5px] text-meta mt-1.5 leading-relaxed">{nota}</p>
    </div>
  );
}

/**
 * La curva del Tesoro: el precio del dinero libre de riesgo en dólares.
 *
 * Para un asesor argentino no es un dato de color. La TIR de un Global menos la
 * del Tesoro al mismo plazo **es** el spread de riesgo del bono: si la curva de
 * EE.UU. sube 50 pb y el Global no se mueve, el spread se comprimió 50 sin que
 * cambiara nada de Argentina. La misma cuenta vale para las ONs hard dollar.
 */
export default async function PanelCurva() {
  const curva = await getCurvaTesoro().catch(() => null);
  if (!curva) return null;

  return (
    <Card
      titulo="Curva del Tesoro de EE.UU."
      nota="La tasa libre de riesgo contra la que se mide todo lo demás"
      acento="#a78bfa"
      derecha={<span>al {fmtFecha(curva.fecha)}</span>}
    >
      <CurvaTesoroChart puntos={curva.puntos} />

      <div className="flex gap-6 flex-wrap mt-4 pt-4 border-t border-divisor-fino">
        <Spread
          label="Pendiente 10a − 2a"
          valor={curva.spread10y2y}
          nota={
            <>
              Negativa ={" "}
              <LinkGlosario termino="Curva invertida">curva invertida</LinkGlosario>: el mercado
              espera recortes por enfriamiento.
            </>
          }
        />
        <Spread
          label="Pendiente 10a − 3m"
          valor={curva.spread10y3m}
          nota="La versión que mejor anticipó recesiones en EE.UU. desde 1970."
        />
      </div>
    </Card>
  );
}
