import Card from "@/components/Card";
import { feriadosDe, MERCADO_LABEL, type FeriadoMercado } from "@/lib/feriados-mercado";

/**
 * El calendario de feriados de mercado, con el porqué de cada uno.
 *
 * La página de efemérides ya tenía los feriados argentinos como fechas
 * históricas. Faltaba la otra lectura, que es la que le sirve a quien opera:
 * **qué días no hay rueda y por qué**. No es lo mismo un feriado nacional que
 * un feriado del NYSE — Viernes Santo cierra la bolsa de Nueva York y no es
 * feriado federal; el Día del Maestro no cierra nada.
 *
 * Los de EE.UU. se calculan por regla ("tercer lunes de enero") y no de una
 * lista, así que el año que viene ya está.
 */

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const corta = (fecha: string) => {
  const [, m, d] = fecha.split("-").map(Number);
  return `${d} ${MESES[m - 1].slice(0, 3)}`;
};

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const diaDe = (fecha: string) => DIAS[new Date(`${fecha}T12:00:00Z`).getUTCDay()];

function Fila({ f, hoy }: { f: FeriadoMercado; hoy: string }) {
  const pasado = f.fecha < hoy;
  const esHoy = f.fecha === hoy;

  return (
    <div
      className={`px-4 py-3 ${esHoy ? "bg-encabezado/70" : ""} ${pasado ? "opacity-45" : ""}`}
    >
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <span className="text-[13px] font-medium text-titulo tabular-nums w-[74px] shrink-0">
          {corta(f.fecha)}
          <span className="text-[11px] text-meta-suave ml-1.5">{diaDe(f.fecha)}</span>
        </span>
        <span className="text-[13px] text-cuerpo">{f.nombre}</span>
        <span
          className={`text-[10px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded ${
            f.medioDia
              ? "text-amber-400/90 border border-amber-900/60"
              : "text-baja/90 border border-borde"
          }`}
        >
          {f.medioDia ? "media rueda" : "sin rueda"}
        </span>
        {esHoy && <span className="text-[11px] text-sube font-medium">hoy</span>}
      </div>
      <p className="text-[11.5px] text-secundario leading-relaxed mt-1.5 max-w-[92ch]">{f.porQue}</p>
    </div>
  );
}

export default function FeriadosMercado({ hoy }: { hoy: string }) {
  const año = Number(hoy.slice(0, 4));
  const todos = [...feriadosDe(año), ...feriadosDe(año + 1)];

  const porMercado = (["eeuu", "argentina"] as const).map((m) => ({
    mercado: m,
    // Los que ya pasaron se muestran igual pero apagados: sirve para entender
    // por qué una serie tiene un hueco tres semanas atrás.
    items: todos.filter((f) => f.mercado === m && f.fecha >= `${año}-01-01`),
  }));

  return (
    <Card
      id="mercados"
      titulo="Cuándo no hay rueda"
      nota="Feriados de mercado y medios días · por qué existe cada uno y qué implica para los precios"
      cuerpo={false}
      className="mb-6 scroll-mt-20"
    >
      <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-divisor">
        {porMercado.map(({ mercado, items }) => (
          <div key={mercado} className="min-w-0">
            <div className="px-4 py-2.5 border-b border-divisor bg-encabezado/40">
              <span className="text-[11px] uppercase tracking-[0.12em] text-tenue">
                {MERCADO_LABEL[mercado]}
              </span>
            </div>
            <div className="divide-y divide-divisor-fino max-h-[560px] overflow-y-auto">
              {items.map((f) => (
                <Fila key={`${f.fecha}-${f.nombre}`} f={f} hoy={hoy} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="px-4 py-3 border-t border-divisor text-[10.5px] text-meta-suave leading-relaxed">
        Los feriados del NYSE se calculan por regla —tercer lunes de enero, cuarto jueves de
        noviembre— y no de una lista escrita a mano, que sirve hasta el 1 de enero en que nadie se
        acordó de extenderla. Los que caen sábado o domingo se corren al hábil más cercano. El
        calendario argentino sale de la lista de feriados nacionales: BYMA suele seguirlo pero
        puede cerrar por decisión propia —un feriado cambiario, un paro bancario— y eso no está en
        ninguna fuente pública estable.
      </p>
    </Card>
  );
}
