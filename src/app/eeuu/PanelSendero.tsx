import Card from "@/components/Card";
import { getSenderoFed } from "@/lib/fed";
import SenderoChart, { type FilaSendero } from "./SenderoChart";
import { fmtFecha } from "@/lib/equity-formato";

const fmtPb = (v: number) =>
  `${v > 0 ? "+" : ""}${v.toLocaleString("es-AR", { maximumFractionDigits: 0 })} pb`;

/**
 * Qué tiene descontado el mercado para cada reunión del FOMC.
 *
 * Es la respuesta a "¿qué espera la Fed?" que se puede defender frente a un
 * cliente: no la opinión de nadie, sino lo que hoy se está pagando en los
 * futuros de fondos federales. Si el mercado descuenta 15 pb para septiembre y
 * la reunión sale con 25, el movimiento del bono largo ya estaba a medias en el
 * precio; eso es lo que hace útil el número por adelantado.
 *
 * El color sigue la lógica del tenedor de bonos, no la del signo: una suba de
 * tasa —que hace caer los precios— va en rojo.
 */
export default async function PanelSendero() {
  const sendero = await getSenderoFed().catch(() => null);
  if (!sendero) return null;

  const porMes = new Map(sendero.reuniones.map((r) => [r.fecha.slice(0, 7), r]));
  const filas: FilaSendero[] = sendero.puntos.map((p) => {
    const r = porMes.get(p.mes);
    return {
      mes: p.mes,
      tasaImplicita: p.tasaImplicita,
      cambioPb: r ? r.cambioPb : null,
      conProyecciones: r?.conProyecciones ?? false,
    };
  });

  const acumulado = sendero.acumuladoPb;
  const direccion = Math.abs(acumulado) < 5 ? "sin cambios" : acumulado > 0 ? "subas" : "recortes";

  return (
    <Card
      titulo="Lo que descuenta el mercado"
      nota="Futuros de fondos federales · la misma cuenta que el FedWatch de CME"
      acento="#38bdf8"
      cuerpo={false}
      derecha={
        <span className="tabular-nums">
          {fmtPb(acumulado)} en {sendero.reuniones.length} reuniones
        </span>
      }
    >
      <div className="px-[18px] pt-3">
        <SenderoChart filas={filas} effrHoy={sendero.effrHoy} />
      </div>

      <div className="border-t border-divisor mt-1">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-[18px] py-2 border-b border-divisor-fino text-[10px] font-semibold uppercase tracking-[0.1em] text-tenue">
          <span>Reunión</span>
          <span className="text-right">Movimiento</span>
          <span className="text-right">Prob. 25 pb</span>
          <span className="text-right">Tasa</span>
        </div>
        <div className="divide-y divide-divisor-fino">
          {sendero.reuniones.map((r) => (
            <div
              key={r.fecha}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-[18px] py-[7px] items-baseline"
            >
              <span className="text-[12px] text-cuerpo">
                {fmtFecha(r.fecha)}
                {r.conProyecciones && (
                  <span
                    className="ml-2 text-[9.5px] text-meta border border-outline rounded-badge px-1 py-px"
                    title="Reunión con Summary of Economic Projections: se publica el dot plot"
                  >
                    proyecciones
                  </span>
                )}
              </span>
              <span
                className={`text-[12px] tabular-nums text-right ${
                  r.direccion === "suba"
                    ? "text-baja"
                    : r.direccion === "baja"
                      ? "text-sube"
                      : "text-meta"
                }`}
              >
                {fmtPb(r.cambioPb)}
              </span>
              <span className="text-[12px] tabular-nums text-right text-secundario">
                {Math.round(r.probabilidad25 * 100)}%
              </span>
              <span className="text-[12px] tabular-nums text-right text-titulo">
                {r.tasaEsperada.toLocaleString("es-AR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                %
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-[18px] py-2.5 border-t border-divisor bg-encabezado">
        <p className="text-[10.5px] text-meta leading-relaxed">
          El mercado descuenta {direccion} por {fmtPb(acumulado)} hasta{" "}
          {fmtFecha(sendero.reuniones[sendero.reuniones.length - 1]?.fecha ?? null)}
          {sendero.rangoFinal && (
            <>
              , que dejarían el rango objetivo en{" "}
              {sendero.rangoFinal.bajo.toLocaleString("es-AR", { minimumFractionDigits: 2 })}–
              {sendero.rangoFinal.alto.toLocaleString("es-AR", { minimumFractionDigits: 2 })}%
            </>
          )}
          . La probabilidad supone un único movimiento de 25 pb por reunión.
        </p>
      </div>
    </Card>
  );
}
