import Card from "@/components/Card";
import { getTasaFed, getSenderoFed, getProximasReuniones, getAutoridadesFed } from "@/lib/fed";
import { fmtNivel } from "@/lib/equity-formato";

/** "mié 16 de septiembre". El día de semana importa: las reuniones cierran miércoles. */
function fechaLarga(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  const dias = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return `${dias[d.getUTCDay()]} ${d.getUTCDate()} de ${meses[d.getUTCMonth()]}`;
}

/** Días entre hoy y una fecha, contados en UTC para que no los corra el huso. */
function diasHasta(iso: string): number {
  const hoy = new Date();
  const a = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - a) / 86_400_000);
}

function Bloque({
  label,
  children,
  nota,
}: {
  label: string;
  children: React.ReactNode;
  nota?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-tenue">{label}</div>
      <div className="mt-2">{children}</div>
      {nota && <div className="text-[11px] text-meta mt-1.5 leading-relaxed">{nota}</div>}
    </div>
  );
}

/**
 * El hero de la página: las cuatro cosas que un asesor tiene que poder contestar
 * sin pensar —en cuánto está la tasa, quién la decide, cuándo se vuelven a
 * reunir y qué está descontando el mercado para esa reunión—.
 *
 * El nombre del presidente de la Fed se lee en vivo de federalreserve.gov. Un
 * dato así parece candidato a constante, pero es justamente el que envejece sin
 * avisar: la presidencia cambió en 2026 y un panel que siguiera diciendo el
 * nombre viejo sería peor que uno que no lo dijera.
 */
export default async function HeroFed() {
  const [tasa, sendero, proximas, autoridades] = await Promise.all([
    getTasaFed().catch(() => null),
    getSenderoFed().catch(() => null),
    getProximasReuniones(1).catch(() => []),
    getAutoridadesFed().catch(() => []),
  ]);

  const proxima = proximas[0];
  const descontada = sendero?.reuniones.find((r) => r.fecha === proxima?.fecha);
  const dias = proxima ? diasHasta(proxima.fecha) : null;

  const presidente = autoridades.find((a) => a.cargo === "Presidente");
  const resto = autoridades.filter((a) => a.cargo !== "Presidente" && a.cargo !== "Gobernador");

  return (
    <Card destacada cuerpo={false}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 divide-y xl:divide-y-0 xl:divide-x md:divide-x divide-divisor">
        <div className="p-[18px]">
          <Bloque
            label="Rango objetivo"
            nota={
              tasa && (
                <>
                  efectiva {fmtNivel(tasa.effr, 2)}
                  {tasa.sofr != null && <> · SOFR {fmtNivel(tasa.sofr, 2)}</>}
                </>
              )
            }
          >
            {tasa ? (
              <div className="text-[30px] font-semibold text-num tabular-nums tracking-[-0.02em] leading-none">
                {fmtNivel(tasa.rangoBajo, 2)}
                <span className="text-meta mx-1.5 font-normal">–</span>
                {fmtNivel(tasa.rangoAlto, 2)}
              </div>
            ) : (
              <div className="text-[22px] text-meta">s/d</div>
            )}
          </Bloque>
        </div>

        <div className="p-[18px]">
          <Bloque
            label="Próxima reunión"
            nota={
              proxima && (
                <>
                  {dias === 0 ? "es hoy" : dias === 1 ? "es mañana" : `faltan ${dias} días`}
                  {proxima.conProyecciones && (
                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-badge border border-outline text-secundario whitespace-nowrap">
                      con proyecciones
                    </span>
                  )}
                </>
              )
            }
          >
            {proxima ? (
              <div className="text-[19px] font-semibold text-num leading-tight">
                {fechaLarga(proxima.fecha)}
              </div>
            ) : (
              <div className="text-[19px] text-meta">s/d</div>
            )}
          </Bloque>
        </div>

        <div className="p-[18px]">
          <Bloque
            label="Descontado para esa reunión"
            nota={
              descontada ? (
                descontada.direccion === "sin cambio" ? (
                  "el mercado no espera movimiento"
                ) : (
                  <>
                    {Math.round(descontada.probabilidad25 * 100)}% de probabilidad de una{" "}
                    {descontada.direccion} de 25 pb
                  </>
                )
              ) : (
                "sin precio de futuros"
              )
            }
          >
            {descontada ? (
              <div
                className={`text-[30px] font-semibold tabular-nums tracking-[-0.02em] leading-none ${
                  descontada.direccion === "suba"
                    ? "text-baja"
                    : descontada.direccion === "baja"
                      ? "text-sube"
                      : "text-num"
                }`}
              >
                {descontada.cambioPb > 0 ? "+" : ""}
                {descontada.cambioPb.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                <span className="text-[15px] font-normal text-meta ml-1">pb</span>
              </div>
            ) : (
              <div className="text-[22px] text-meta">s/d</div>
            )}
          </Bloque>
        </div>

        <div className="p-[18px]">
          <Bloque
            label="Quién decide"
            nota={
              resto.length > 0 && (
                <span className="block leading-relaxed">
                  {resto.map((a) => `${a.cargo}: ${a.nombre}`).join(" · ")}
                </span>
              )
            }
          >
            {presidente ? (
              <a
                href={presidente.link}
                target="_blank"
                rel="noreferrer"
                className="text-[19px] font-semibold text-num leading-tight hover:text-cuerpo transition-colors"
              >
                {presidente.nombre}
              </a>
            ) : (
              <div className="text-[19px] text-meta">s/d</div>
            )}
          </Bloque>
        </div>
      </div>
    </Card>
  );
}
