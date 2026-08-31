import type { Comparacion, Ficha, SerieFinanciera } from "@/lib/equity";
import type { Wacc } from "@/lib/equity-ficha";
import { fmtCap, fmtFecha, fmtNivel, fmtNumero, fmtUsd } from "@/lib/equity-formato";

/**
 * Los bloques que la ficha no pregunta porque ya los sabe.
 *
 * Son componentes de servidor puros: reciben lo que la página ya bajó y no
 * tienen estado. La regla es una sola —si el dato se puede calcular, no se
 * pide—, y el efecto es que lo que queda escrito a mano en la ficha es
 * criterio y no transcripción.
 */

/** Montos con signo: la deuda neta puede ser negativa (caja neta). */
const fmtMonto = (v: number | null): string =>
  v == null ? "—" : v < 0 ? `−${fmtCap(Math.abs(v))}` : fmtCap(v);

const fmtVeces = (v: number | null): string => (v == null ? "—" : `${fmtNumero(v, 1)}×`);

const fmtDias = (v: number | null): string => (v == null ? "—" : `${fmtNumero(v, 0)} d`);

/** Verde si el número es bueno, rojo si es malo, gris si no aplica juzgarlo. */
function tono(valor: number | null, bueno: (v: number) => boolean): string {
  if (valor == null) return "text-slate-500";
  return bueno(valor) ? "text-sube" : "text-baja";
}

// ─── Sección 5: el cuadro de números ─────────────────────────────────────────

interface FilaCuadro {
  label: string;
  ayuda?: string;
  valores: (string | null)[];
  /** Clase por celda, para las filas donde el signo importa. */
  clases?: (string | undefined)[];
  destacada?: boolean;
}

export function BloqueNumeros({
  serie,
  wacc,
}: {
  serie: SerieFinanciera;
  wacc: Wacc | null;
}) {
  const p = serie.periodos;

  if (p.length === 0) {
    return (
      <p className="text-[12px] text-meta leading-relaxed">
        Yahoo no publica estados financieros de este papel. El cuadro hay que armarlo
        del balance.
      </p>
    );
  }

  const col = <T,>(f: (x: (typeof p)[number]) => T) => p.map(f);

  const filas: FilaCuadro[] = [
    { label: "Ventas", valores: col((x) => fmtMonto(x.ventas)), destacada: true },
    {
      label: "Crec. %",
      valores: col((x) => (x.crecimiento == null ? null : fmtNivel(x.crecimiento))),
      clases: col((x) => tono(x.crecimiento, (v) => v > 0)),
    },
    { label: "Margen bruto", valores: col((x) => (x.margenBruto == null ? null : fmtNivel(x.margenBruto))) },
    { label: "Margen EBITDA", valores: col((x) => (x.margenEbitda == null ? null : fmtNivel(x.margenEbitda))) },
    { label: "Margen EBIT", valores: col((x) => (x.margenEbit == null ? null : fmtNivel(x.margenEbit))) },
    { label: "Res. neto", valores: col((x) => fmtMonto(x.neto)) },
    { label: "FCO", ayuda: "Flujo de caja operativo", valores: col((x) => fmtMonto(x.fco)), destacada: true },
    { label: "Capex", valores: col((x) => fmtMonto(x.capex)) },
    { label: "FCF", ayuda: "Caja libre: FCO menos capex", valores: col((x) => fmtMonto(x.fcf)), destacada: true },
    {
      label: "FCO / EBITDA",
      ayuda: "Cuánto del margen se convierte en caja de verdad",
      valores: col((x) => (x.fcoSobreEbitda == null ? null : fmtNivel(x.fcoSobreEbitda))),
      clases: col((x) => tono(x.fcoSobreEbitda, (v) => v >= 70)),
    },
    { label: "Deuda neta", valores: col((x) => fmtMonto(x.deudaNeta)) },
    {
      label: "DN / EBITDA",
      valores: col((x) => fmtVeces(x.dnSobreEbitda)),
      clases: col((x) => tono(x.dnSobreEbitda, (v) => v < 3)),
    },
    {
      label: "Cobertura intereses",
      ayuda: "EBIT sobre intereses pagados",
      valores: col((x) => fmtVeces(x.coberturaIntereses)),
      clases: col((x) => tono(x.coberturaIntereses, (v) => v > 3)),
    },
    {
      label: "ROIC",
      ayuda: "NOPAT sobre capital invertido",
      valores: col((x) => (x.roic == null ? null : fmtNivel(x.roic))),
      clases: col((x) => (wacc ? tono(x.roic, (v) => v > wacc.wacc) : undefined)),
      destacada: true,
    },
    { label: "ROE", valores: col((x) => (x.roe == null ? null : fmtNivel(x.roe))) },
    {
      label: "Ciclo de conversión",
      ayuda: "Días de inventario + de cobro − de pago",
      valores: col((x) => fmtDias(x.cicloConversion)),
    },
  ];

  const ultimoRoic = [...p].reverse().find((x) => x.roic != null)?.roic ?? null;
  const veredicto =
    wacc && ultimoRoic != null
      ? ultimoRoic > wacc.wacc
        ? { texto: `ROIC ${fmtNivel(ultimoRoic)} > WACC ${fmtNivel(wacc.wacc)}: crea valor`, clase: "text-sube" }
        : { texto: `ROIC ${fmtNivel(ultimoRoic)} < WACC ${fmtNivel(wacc.wacc)}: destruye valor`, clase: "text-baja" }
      : null;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="border-b border-borde">
              <th className="text-left font-normal text-[10px] uppercase tracking-[0.12em] text-tenue py-2 pr-3 min-w-[150px]">
                Serie anual
              </th>
              {p.map((x) => (
                <th
                  key={x.periodo}
                  className={`text-right font-medium py-2 px-2.5 whitespace-nowrap ${
                    x.esUdm ? "text-cuerpo" : "text-secundario"
                  }`}
                >
                  {x.periodo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-divisor-fino">
            {filas.map((f) => (
              <tr key={f.label} className="hover:bg-chip/40 transition-colors">
                <td
                  className={`py-[7px] pr-3 whitespace-nowrap ${
                    f.destacada ? "text-cuerpo font-medium" : "text-label"
                  }`}
                  title={f.ayuda}
                >
                  {f.label}
                  {f.ayuda && <span className="text-tenue"> ·</span>}
                </td>
                {f.valores.map((v, i) => (
                  <td
                    key={i}
                    className={`text-right tabular-nums py-[7px] px-2.5 whitespace-nowrap ${
                      v == null ? "text-slate-700" : f.clases?.[i] ?? "text-cuerpo"
                    }`}
                  >
                    {v ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]">
        {wacc && (
          <span className="text-secundario">
            WACC estimado{" "}
            <span className="text-titulo font-medium tabular-nums">{fmtNivel(wacc.wacc)}</span>
            <span
              className="text-meta-suave"
              title={`CAPM: tasa libre ${fmtNivel(wacc.tasaLibre)} (Tesoro 10 años) + beta ${fmtNumero(
                wacc.beta,
                2
              )} × prima de mercado ${fmtNivel(wacc.primaMercado)}${
                wacc.kd != null
                  ? `. Costo de deuda después de impuestos ${fmtNivel(wacc.kd)}, ${fmtNivel(
                      wacc.pesoDeuda
                    )} del capital.`
                  : ". Sin intereses informados: se pondera sólo el capital propio."
              }`}
            >
              {" "}
              · ke {fmtNivel(wacc.ke)}
              {wacc.kd != null && ` · kd ${fmtNivel(wacc.kd)}`} ⓘ
            </span>
          </span>
        )}
        {veredicto && <span className={veredicto.clase}>{veredicto.texto}</span>}
      </div>

      <p className="text-[10.5px] text-meta-suave leading-relaxed">
        Yahoo publica hasta cinco ejercicios ({serie.ejercicios} acá): para los ocho o diez años de
        la plantilla —y para reexpresar a moneda homogénea, que en una empresa argentina cambia
        todo— hay que ir a los balances. El WACC es una estimación de hoy, no una serie: la
        columna por año no existiría sin inventarla.
      </p>
    </div>
  );
}

// ─── Sección 6: contexto de deuda ────────────────────────────────────────────

export function BloqueDeuda({ serie }: { serie: SerieFinanciera }) {
  const ultimo = [...serie.periodos].reverse().find((p) => p.deudaNeta != null || p.dnSobreEbitda != null);

  const datos: { label: string; valor: string; ayuda?: string }[] = [
    { label: "Deuda total", valor: fmtMonto(serie.deudaTotal), ayuda: "Último balance anual" },
    { label: "Deuda neta", valor: fmtMonto(ultimo?.deudaNeta ?? null) },
    { label: "DN / EBITDA", valor: fmtVeces(ultimo?.dnSobreEbitda ?? null) },
    { label: "Cobertura intereses", valor: fmtVeces(ultimo?.coberturaIntereses ?? null) },
    {
      label: "Costo implícito",
      valor:
        serie.interesesPagados != null && serie.deudaTotal
          ? fmtNivel((Math.abs(serie.interesesPagados) / serie.deudaTotal) * 100)
          : "—",
      ayuda: "Intereses pagados sobre deuda total del último ejercicio",
    },
  ];

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-divisor border border-divisor rounded-card overflow-hidden">
        {datos.map((d) => (
          <div key={d.label} className="bg-card px-3.5 py-2.5" title={d.ayuda}>
            <div className="text-[10px] uppercase tracking-[0.12em] text-tenue">{d.label}</div>
            <div className="text-[14px] text-cuerpo tabular-nums mt-1">{d.valor}</div>
          </div>
        ))}
      </div>
      <p className="text-[10.5px] text-meta-suave leading-relaxed">
        El perfil de vencimientos no lo publica ninguna API: sale de la nota de deuda del balance
        y se carga a mano acá abajo. Lo de arriba es el agregado, que sirve de control: si los
        montos cargados no suman la deuda total, falta un tramo.
      </p>
    </div>
  );
}

// ─── Sección 8: múltiplos ────────────────────────────────────────────────────

export function BloqueMultiplos({
  ficha,
  serie,
  comparacion,
}: {
  ficha: Ficha;
  serie: SerieFinanciera;
  comparacion: Comparacion | null;
}) {
  const f = ficha.fundamentals;
  const udm = [...serie.periodos].reverse().find((p) => p.esUdm) ?? serie.periodos[serie.periodos.length - 1];
  const fcfYield =
    udm?.fcf != null && f.capitalizacion ? (udm.fcf / f.capitalizacion) * 100 : null;

  const medianaDe = (clave: string) =>
    comparacion?.metricas.find((m) => m.clave === clave)?.mediana ?? null;

  const filas: { label: string; valor: string; par: number | null; propio: number | null; caroAlto: boolean }[] = [
    { label: "EV / EBITDA", valor: fmtVeces(f.evSobreEbitda), par: null, propio: f.evSobreEbitda, caroAlto: true },
    { label: "P / E", valor: fmtVeces(f.perTrailing), par: medianaDe("perTrailing"), propio: f.perTrailing, caroAlto: true },
    { label: "P / BV", valor: fmtVeces(f.priceToBook), par: medianaDe("priceToBook"), propio: f.priceToBook, caroAlto: true },
    {
      label: "FCF yield",
      valor: fcfYield == null ? "—" : fmtNivel(fcfYield),
      par: null,
      propio: fcfYield,
      caroAlto: false,
    },
  ];

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-divisor border border-divisor rounded-card overflow-hidden">
        {filas.map((m) => {
          const dif = m.par != null && m.propio != null ? (m.propio / m.par - 1) * 100 : null;
          return (
            <div key={m.label} className="bg-card px-3.5 py-2.5">
              <div className="text-[10px] uppercase tracking-[0.12em] text-tenue">{m.label}</div>
              <div className="text-[16px] text-num tabular-nums mt-1 leading-none">{m.valor}</div>
              {dif != null && (
                <div
                  className={`text-[10px] tabular-nums mt-1.5 ${
                    m.caroAlto ? tono(dif, (v) => v < 0) : tono(dif, (v) => v > 0)
                  }`}
                  title={`Mediana de ${comparacion?.grupo}: ${fmtNumero(m.par, 1)}×`}
                >
                  {dif > 0 ? "+" : ""}
                  {fmtNumero(dif, 0)}% vs. pares
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10.5px] text-meta-suave leading-relaxed">
        Múltiplos de hoy contra la mediana de {comparacion?.pares.length ?? 0} pares de{" "}
        {comparacion?.grupo ?? "su sector"}. El FCF yield va sobre la caja libre de los últimos doce
        meses y la capitalización de hoy: es el rendimiento que compra el que entra al precio
        actual, antes de cualquier proyección.
      </p>
    </div>
  );
}

// ─── Sección 10: seguimiento ─────────────────────────────────────────────────

export function BloqueSeguimiento({ ficha }: { ficha: Ficha }) {
  const { earnings } = ficha;
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-[12px]">
      <span className="text-label">
        Próximo balance:{" "}
        <span className="text-cuerpo tabular-nums">{fmtFecha(earnings.fecha)}</span>
        {earnings.estimada && <span className="text-meta-suave"> (estimada)</span>}
      </span>
      {earnings.epsEsperado != null && (
        <span className="text-label">
          EPS esperado: <span className="text-cuerpo tabular-nums">{fmtUsd(earnings.epsEsperado)}</span>
        </span>
      )}
      {earnings.ventasEsperadas != null && (
        <span className="text-label">
          Ventas esperadas:{" "}
          <span className="text-cuerpo tabular-nums">{fmtCap(earnings.ventasEsperadas)}</span>
        </span>
      )}
    </div>
  );
}
