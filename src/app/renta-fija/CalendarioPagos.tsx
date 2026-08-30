import { getCalendarioPagos, type Familia, type Pago } from "@/lib/calendario-pagos";

const TONO: Record<Familia, string> = {
  Soberano: "#3987e5",
  ON: "#199e70",
  "Tasa fija": "#e0912f",
  CER: "#8b5cf6",
  "Dólar linked": "#0891b2",
};

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function fmtMonto(p: Pago): string {
  if (p.moneda === "USD") {
    return `US$${p.monto.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  // En pesos los montos son de miles: los centavos no aportan nada y cuestan ancho
  return `$${p.monto.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

/**
 * Qué cobra un cliente y cuándo — de los mismos cronogramas con los que se
 * calculan las curvas.
 *
 * Estaban en el repo desde que se armaron las curvas, pero se usaban sólo para
 * sacar la TIR: el resto de lo que traen —las fechas y los montos, que es lo
 * que le importa a quien tiene el bono— se descartaba.
 *
 * Todo por cada 100 de valor nominal, que es como se piensa una tenencia. Los
 * pagos de CER y dólar linked van marcados: su monto real usa el índice de la
 * fecha de pago, que todavía no existe, así que lo que se muestra es una
 * estimación con el índice de hoy y va a quedar corta.
 */
export default async function CalendarioPagos() {
  // Noventa días: es el horizonte con el que se hace la pregunta, y con seis
  // meses la lista pasaba de cien filas —las ONs pagan cupón todos los meses—
  // y dejaba de ser algo que se barre de un vistazo.
  const { pagos, referencias } = await getCalendarioPagos(90).catch(() => ({
    pagos: [] as Pago[],
    referencias: null,
  }));

  if (pagos.length === 0) {
    return <p className="px-[18px] py-3 text-[12px] text-meta">No hay pagos en los próximos 90 días.</p>;
  }

  // Agrupado por mes: el calendario se recorre por mes, no por día suelto.
  const porMes = new Map<string, Pago[]>();
  for (const p of pagos) {
    const clave = p.fecha.slice(0, 7);
    (porMes.get(clave) ?? porMes.set(clave, []).get(clave)!).push(p);
  }

  return (
    <div>
      <div className="divide-y divide-divisor">
        {[...porMes.entries()].map(([mes, lista]) => {
          const [a, m] = mes.split("-").map(Number);
          return (
            <div key={mes}>
              <div className="px-[18px] py-1.5 bg-encabezado flex items-baseline gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-tenue">
                  {MESES[m - 1]} {a}
                </span>
                <span className="text-[10px] text-meta-suave ml-auto tabular-nums">
                  {lista.length} {lista.length === 1 ? "pago" : "pagos"}
                </span>
              </div>
              <div className="divide-y divide-divisor-fino">
                {lista.map((p) => (
                  <div
                    key={`${p.ticker}-${p.fecha}`}
                    className="px-[18px] py-[7px] flex items-baseline gap-3"
                  >
                    <span className="text-[11px] text-meta-suave tabular-nums w-6 shrink-0 text-right">
                      {Number(p.fecha.slice(8))}
                    </span>
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0 self-center"
                      style={{ background: TONO[p.familia] }}
                      title={p.familia}
                    />
                    <span className="text-[12px] font-medium text-cuerpo shrink-0">{p.ticker}</span>
                    <span className="text-[10.5px] text-meta-suave truncate min-w-0">{p.nombre}</span>
                    {p.cancela && (
                      <span
                        className="text-[9.5px] px-1.5 py-px rounded-badge border border-outline text-secundario shrink-0"
                        title="Este pago cancela el instrumento"
                      >
                        vence
                      </span>
                    )}
                    <span className="text-[12px] tabular-nums text-titulo ml-auto shrink-0">
                      {fmtMonto(p)}
                      {p.estimado && (
                        <span className="text-meta-suave ml-0.5" title="Estimado con el índice de hoy">
                          *
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-[18px] py-2.5 border-t border-divisor bg-encabezado">
        <p className="text-[10.5px] text-meta leading-relaxed">
          Montos por cada 100 de valor nominal.{" "}
          {referencias ? (
            <>
              Los marcados con <span className="text-secundario">*</span> son estimaciones: un CER o
              un dólar linked paga su cupón por el índice de la fecha de pago, que todavía no
              existe, así que se usó el de hoy (CER{" "}
              {referencias.cer.toLocaleString("es-AR", { maximumFractionDigits: 2 })} · A3500{" "}
              {referencias.fx.toLocaleString("es-AR", { maximumFractionDigits: 2 })}) y el pago real
              va a ser mayor.
            </>
          ) : (
            <>
              El BCRA no respondió, así que los CER y dólar linked quedaron afuera: sin el índice
              del día sus pagos no se pueden expresar en pesos.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
