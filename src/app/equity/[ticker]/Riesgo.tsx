import type { Riesgo } from "@/lib/equity-riesgo";
import { leerRiesgo } from "@/lib/equity-riesgo";
import { colorRetorno, fmtFecha, fmtNivel, fmtNumero, fmtPct } from "@/lib/equity-formato";

/**
 * Riesgo del papel: la otra mitad de la tabla de retornos.
 *
 * El orden de los recuadros no es alfabético ni por familia de métrica: es el
 * de las preguntas que uno se hace. Cuánto se mueve, cuánto se puede perder,
 * cuánto pagó ese riesgo, de qué depende. Debajo, la misma lectura en prosa
 * para el que no quiere traducir seis números de cabeza.
 */

function Dato({
  label,
  valor,
  nota,
  clase,
  ayuda,
}: {
  label: string;
  valor: string;
  nota?: string;
  clase?: string;
  ayuda?: string;
}) {
  return (
    <div className="bg-card px-3.5 py-2.5" title={ayuda}>
      <div className="text-[10px] uppercase tracking-[0.12em] text-tenue leading-snug">{label}</div>
      <div className={`text-[15px] tabular-nums mt-1 leading-none ${clase ?? "text-cuerpo"}`}>
        {valor}
      </div>
      {nota && <div className="text-[10px] text-meta-suave mt-1.5 leading-snug">{nota}</div>}
    </div>
  );
}

export default function PanelRiesgo({ riesgo }: { riesgo: Riesgo | null }) {
  if (!riesgo) {
    return (
      <p className="text-[12px] text-meta leading-relaxed">
        No hay suficientes ruedas para calcular volatilidad ni beta. Pasa con papeles que salieron
        a bolsa hace poco: hacen falta al menos tres meses de cotización.
      </p>
    );
  }

  const r = riesgo;
  const dd = r.peorCaida;

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-divisor border border-divisor rounded-card overflow-hidden">
        <Dato
          label="Volatilidad anual"
          valor={fmtNivel(r.volatilidad)}
          nota={r.indice ? `S&P ${fmtNivel(r.indice.volatilidad)}` : undefined}
          ayuda="Desvío de las variaciones diarias, anualizado. Cuánto se mueve el papel, para arriba y para abajo."
        />
        <Dato
          label="Peor caída"
          valor={dd ? fmtNivel(dd.caida) : "—"}
          clase="text-baja"
          nota={dd ? `${fmtFecha(dd.pico)} → ${fmtFecha(dd.valle)}` : undefined}
          ayuda="La caída punta a punta más grande de la ventana: lo que hubo que aguantar comprando en el peor momento."
        />
        <Dato
          label="Beta"
          valor={fmtNumero(r.beta, 2)}
          nota={r.r2 != null ? `el S&P explica ${fmtNivel(r.r2, 0)}` : undefined}
          ayuda="Sensibilidad al índice, calculada sobre esta ventana de ruedas diarias. No es la beta de 5 años de Yahoo."
        />
        <Dato
          label="Retorno anualizado"
          valor={fmtPct(r.retornoAnualizado)}
          clase={colorRetorno(r.retornoAnualizado)}
          nota={r.indice ? `S&P ${fmtPct(r.indice.retornoAnualizado)}` : undefined}
          ayuda="Lo que rindió por año en la ventana, sin contar dividendos."
        />
        <Dato
          label="Sharpe"
          valor={fmtNumero(r.sharpe, 2)}
          nota={r.sortino != null ? `Sortino ${fmtNumero(r.sortino, 2)}` : undefined}
          clase={r.sharpe == null ? undefined : r.sharpe > 1 ? "text-sube" : r.sharpe < 0 ? "text-baja" : undefined}
          ayuda="Retorno por encima del Tesoro a 10 años dividido por la volatilidad. Arriba de 1 es bueno; negativo es haber arriesgado para perder."
        />
        <Dato
          label="Alfa anual"
          valor={fmtPct(r.alfa)}
          clase={colorRetorno(r.alfa)}
          nota={
            r.capturaAlza != null && r.capturaBaja != null
              ? `captura ${fmtNivel(r.capturaAlza, 0)} / ${fmtNivel(r.capturaBaja, 0)}`
              : undefined
          }
          ayuda="Lo que rindió por encima de lo que su exposición al índice explica. Debajo, cuánto captura de las subas y de las bajas del S&P."
        />
      </div>

      <div className="font-serif text-[13px] leading-[1.65] text-cuerpo max-w-[92ch] space-y-1">
        {leerRiesgo(r).map((linea, i) => (
          <p key={i}>{linea}</p>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[10.5px] text-meta-suave">
        <span>
          {r.ruedas} ruedas · {fmtFecha(r.desde)} a {fmtFecha(r.hasta)}
        </span>
        <span>{fmtNivel(r.ruedasPositivas, 0)} de las ruedas cerraron en verde</span>
        {r.mejorMes && r.peorMes && (
          <span>
            mejor mes {fmtPct(r.mejorMes.retorno)} · peor {fmtPct(r.peorMes.retorno)}
          </span>
        )}
        {r.volatilidadReciente != null && (
          <span>
            últimas 60 ruedas {fmtNivel(r.volatilidadReciente)}
            {r.volatilidadReciente > r.volatilidad * 1.25
              ? " — más nervioso que su promedio"
              : r.volatilidadReciente < r.volatilidad * 0.75
                ? " — más calmo que su promedio"
                : ""}
          </span>
        )}
      </div>

      <p className="text-[10.5px] text-meta-suave leading-relaxed">
        Sobre cierres diarios sin ajustar por dividendos: en un papel que paga, el retorno de acá
        queda por debajo del que cobró el que lo tuvo. La volatilidad y la beta no se ven afectadas.
        Todo es historia — describe cómo se comportó, no cómo se va a comportar.
      </p>
    </div>
  );
}
