import { Contenedor, EncabezadoPagina } from "@/components/Card";
import RefreshButton from "@/app/mercado/RefreshButton";
import { cargarPanel } from "@/lib/panel-datos";
import { hoyEnArgentina } from "@/lib/rava";
import { construirIndicadores, getAdrs, getLecapCorta, termometro, type IndicadorBrief, type Termometro } from "@/lib/morning-brief-datos";
import { getAgenda } from "@/lib/morning-brief-agenda";
import BloqueIndicadores from "./Bloques";
import Adrs from "./Adrs";
import Agenda from "./Agenda";

export const metadata = { title: "Morning Brief · Dashboard" };
export const dynamic = "force-dynamic";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function fechaLarga(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

const TERMOMETRO_ESTILO: Record<Termometro, { texto: string; clase: string }> = {
  "risk-on": { texto: "risk-on", clase: "border-emerald-800/70 text-sube" },
  "risk-off": { texto: "risk-off", clase: "border-red-900/70 text-baja" },
  mixto: { texto: "señales mixtas", clase: "border-outline text-secundario" },
};

function Termometro({ valor }: { valor: Termometro | null }) {
  if (!valor) return null;
  const e = TERMOMETRO_ESTILO[valor];
  return (
    <span
      className={`text-[11px] px-2 py-0.5 rounded-chip border ${e.clase}`}
      title="Tres votos: futuros del S&P, futuros del Nasdaq y el VIX dado vuelta. Gana el que saque dos."
    >
      {e.texto}
    </span>
  );
}

/**
 * Morning Brief — el pantallazo de las nueve de la mañana.
 *
 * Seis bloques en el orden de la rutina: qué pasó mientras dormías, la tasa
 * que fija el tono, si el mercado le cree, los commodities, la agenda del día
 * y recién al final Argentina, que es la traducción de todo lo anterior.
 *
 * Es sólo dato: no hay nada que completar ni nada que esperar. La mitad de los
 * números ya los tiene el dashboard en `market_series` y se leen de ahí; el
 * resto se baja en vivo y se cachea diez minutos.
 */
export default async function MorningBriefPage() {
  const hoy = hoyEnArgentina();

  const [indicadores, adrs, eventos, lecap] = await Promise.all([
    construirIndicadores(),
    getAdrs().catch(() => []),
    getAgenda(hoy).catch(() => []),
    getLecapCorta(),
  ]);

  const panel = cargarPanel();
  const porBloque = (b: string): IndicadorBrief[] => indicadores.filter((i) => i.bloque === b);
  // La Lecap corta no sale del motor de series (ver getLecapCorta), pero se
  // lee junto a las otras tasas en pesos.
  const argentina = lecap ? [...porBloque("argentina"), lecap] : porBloque("argentina");

  const inusuales = indicadores.filter((i) => i.inusual).length;

  return (
    <Contenedor ancho={1180}>
      <EncabezadoPagina
        titulo="Morning Brief"
        bajada={
          inusuales > 0
            ? `${fechaLarga(hoy)} · ${inusuales} ${inusuales === 1 ? "movimiento inusual" : "movimientos inusuales"}, marcados en ámbar`
            : `${fechaLarga(hoy)} · sin movimientos fuera de lo normal`
        }
        derecha={
          <RefreshButton lastUpdate={panel.lastUpdate} needsBackfill={panel.needsBackfill} />
        }
      />

      <div className="space-y-4">
        <BloqueIndicadores bloque="nocturno" indicadores={porBloque("nocturno")} gruposEnFila />

        {/* `items-start`: sin esto los dos cards se estiran al alto del más
            alto y el más corto queda con una franja vacía abajo. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <BloqueIndicadores bloque="tasas_dolar" indicadores={porBloque("tasas_dolar")} tope={4} />
          <BloqueIndicadores
            bloque="riesgo"
            indicadores={porBloque("riesgo")}
            tope={3}
            derecha={<Termometro valor={termometro(indicadores)} />}
          />
        </div>

        <BloqueIndicadores bloque="commodities" indicadores={porBloque("commodities")} gruposEnFila />

        <Agenda eventos={eventos} hoy={hoy} />

        <BloqueIndicadores bloque="argentina" indicadores={argentina} tope={5}>
          {adrs.length > 0 && <Adrs adrs={adrs} />}
        </BloqueIndicadores>
      </div>
    </Contenedor>
  );
}
