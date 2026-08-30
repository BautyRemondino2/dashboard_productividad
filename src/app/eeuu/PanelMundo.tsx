import Card from "@/components/Card";
import { getTasasMundo } from "@/lib/eeuu";
import { fmtFecha } from "@/lib/equity-formato";

const pct = (v: number | null) =>
  v == null
    ? "—"
    : `${v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/**
 * El precio del dinero en los cuatro bloques que mueven el capital global.
 *
 * La columna del diferencial es la que justifica el panel: contra el Tesoro
 * norteamericano se lee de un vistazo cuánto más —o menos— paga cada bloque por
 * plazo largo, que es lo que orienta hacia dónde se mueve el capital y, por esa
 * vía, el dólar.
 */
export default async function PanelMundo() {
  const filas = await getTasasMundo().catch(() => []);
  if (filas.length === 0) return null;

  return (
    <Card
      titulo="Tasas en el mundo"
      nota="Tasa de política y bono a 10 años de cada bloque"
      acento="#60a5fa"
      cuerpo={false}
    >
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-[18px] py-2 border-b border-divisor-fino text-[10px] font-semibold uppercase tracking-[0.1em] text-tenue">
        <span></span>
        <span className="text-right">Corta</span>
        <span className="text-right">10 años</span>
        <span className="text-right">vs Tesoro</span>
      </div>

      <div className="divide-y divide-divisor-fino">
        {filas.map((f) => (
          <div
            key={f.pais}
            className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-[18px] py-2 items-baseline"
          >
            <span className="min-w-0">
              <span className="text-[12.5px] text-cuerpo">{f.pais}</span>
              <span className="text-[10px] text-meta-suave ml-2">{f.etiquetaCorta}</span>
            </span>
            <span
              className="text-[12.5px] tabular-nums text-right text-titulo"
              title={f.fechaCorta ? `Dato del ${fmtFecha(f.fechaCorta)}` : undefined}
            >
              {pct(f.corta)}
            </span>
            <span
              className="text-[12.5px] tabular-nums text-right text-titulo"
              title={f.fechaLarga ? `Dato del ${fmtFecha(f.fechaLarga)}` : undefined}
            >
              {pct(f.larga)}
            </span>
            <span
              className={`text-[12px] tabular-nums text-right ${
                f.vsTesoro == null
                  ? "text-meta"
                  : f.vsTesoro > 0
                    ? "text-cuerpo"
                    : "text-meta"
              }`}
            >
              {f.vsTesoro == null
                ? "—"
                : `${f.vsTesoro > 0 ? "+" : ""}${Math.round(f.vsTesoro)} pb`}
            </span>
          </div>
        ))}
      </div>

      <div className="px-[18px] py-2.5 border-t border-divisor bg-encabezado">
        <p className="text-[10.5px] text-meta leading-relaxed">
          Las tasas largas de Europa y Japón se publican con frecuencia mensual: la fecha de cada
          dato está al pasar el mouse. El diferencial contra el Tesoro es de lo que más explica el
          movimiento del dólar, y el 10 años japonés importa porque a medida que rinde más, el
          ahorro que Japón venía exportando al mundo vuelve a casa y empuja las tasas largas de
          todos lados.
        </p>
      </div>
    </Card>
  );
}
