import Link from "next/link";
import { Contenedor, EncabezadoPagina } from "@/components/Card";
import Card from "@/components/Card";
import { DB_IS_EPHEMERAL } from "@/lib/db";
import {
  conteoPorTema, listarRadar, TEMAS, TEMA_COLOR, TEMA_LABEL, type Tema, type RadarItem,
} from "@/lib/radar";
import CajaPegado from "./CajaPegado";
import AccionesItem from "./AccionesItem";

export const metadata = { title: "Radar · Dashboard" };
export const dynamic = "force-dynamic";

/** "hoy", "ayer" o "jueves 27 de agosto". */
function tituloDia(iso: string): string {
  const hoy = new Date();
  const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(
    hoy.getDate()
  ).padStart(2, "0")}`;
  if (iso === hoyIso) return "Hoy";

  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);
  const ayerIso = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, "0")}-${String(
    ayer.getDate()
  ).padStart(2, "0")}`;
  if (iso === ayerIso) return "Ayer";

  const d = new Date(iso + "T12:00:00Z");
  const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return `${dias[d.getUTCDay()]} ${d.getUTCDate()} de ${meses[d.getUTCMonth()]}`;
}

/**
 * La relevancia como cuatro barras y no como un número.
 *
 * Un "4/5" obliga a leerlo y compararlo; las barras se ordenan solas cuando hay
 * quince items en pantalla, que es el caso de uso real —barrer la columna y
 * frenar donde está lleno—.
 */
function Relevancia({ n }: { n: number }) {
  return (
    <span className="flex items-center gap-[2px] shrink-0" title={`Relevancia ${n} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-full"
          style={{
            height: 9,
            background: i <= n ? (n >= 4 ? "#f87171" : n >= 3 ? "#fbbf24" : "#475569") : "#1e293b",
          }}
        />
      ))}
    </span>
  );
}

function Item({ item }: { item: RadarItem }) {
  const color = TEMA_COLOR[item.tema] ?? TEMA_COLOR.otro;
  return (
    <article className={`px-[18px] py-3 ${item.leido ? "opacity-45" : ""}`}>
      <div className="flex items-baseline gap-2.5">
        <Relevancia n={item.relevancia} />
        <h3 className="text-[13.5px] font-medium text-titulo leading-snug min-w-0">
          {item.titulo}
        </h3>
        <span
          className="text-[9.5px] px-1.5 py-px rounded-badge border shrink-0 ml-auto whitespace-nowrap"
          style={{ borderColor: `${color}55`, color }}
        >
          {TEMA_LABEL[item.tema] ?? item.tema}
        </span>
      </div>

      <p className="text-[12px] text-secundario leading-relaxed mt-1.5">{item.resumen}</p>

      {item.accionable && (
        <p className="text-[11.5px] text-cuerpo leading-relaxed mt-2 pl-2.5 border-l-2 border-divisor">
          {item.accionable}
        </p>
      )}

      <div className="flex items-center gap-2.5 mt-2 flex-wrap">
        {item.tickers.map((t) => (
          <span
            key={t}
            className="text-[10px] px-1.5 py-px rounded-badge bg-chip text-secundario tabular-nums"
          >
            {t}
          </span>
        ))}
        {item.fuente && <span className="text-[10px] text-meta-suave">vía {item.fuente}</span>}
        <span className="ml-auto">
          <AccionesItem id={item.id} leido={item.leido} />
        </span>
      </div>

      {/* El original queda a un clic pero fuera del camino: cuando el resumen no
          alcanza es lo primero que se quiere ver, y el resto del tiempo sólo
          ocuparía lugar. */}
      <details className="mt-2">
        <summary className="text-[10px] text-meta hover:text-cuerpo cursor-pointer list-none [&::-webkit-details-marker]:hidden inline-block transition-colors">
          ver original
        </summary>
        <pre className="text-[10.5px] text-meta-suave whitespace-pre-wrap font-mono leading-relaxed bg-boton rounded-chip p-2.5 border border-divisor-fino mt-1.5">
          {item.original}
        </pre>
      </details>
    </article>
  );
}

function ChipFiltro({
  href,
  activo,
  children,
  color,
}: {
  href: string;
  activo: boolean;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <Link
      href={href}
      className={`text-[11px] px-2.5 py-1 rounded-chip border transition-colors whitespace-nowrap ${
        activo
          ? "border-separador bg-chip text-titulo"
          : "border-outline text-secundario hover:text-titulo"
      }`}
      style={activo && color ? { borderColor: `${color}77` } : undefined}
    >
      {children}
    </Link>
  );
}

/**
 * Radar — el flujo de WhatsApp, filtrado.
 *
 * Un asesor está en seis canales que tiran cien mensajes por día y adentro hay
 * cinco que cambian lo que le dice a un cliente. Esta página es el filtro:
 * entra el volcado crudo, sale un feed ordenado por relevancia, con el ticker
 * involucrado y una línea de qué implica para una cartera.
 *
 * El filtro por tema y por relevancia va por la URL y no por estado local: así
 * "sólo lo de 4 para arriba" es un link que se puede dejar abierto en una
 * pestaña, que es como se termina usando.
 */
export default async function RadarPage({
  searchParams,
}: {
  searchParams: Promise<{ tema?: string; min?: string }>;
}) {
  const sp = await searchParams;
  const tema = TEMAS.includes(sp.tema as Tema) ? (sp.tema as Tema) : undefined;
  const min = sp.min ? Math.min(5, Math.max(1, Number(sp.min) || 1)) : undefined;

  const items = listarRadar({ tema, minRelevancia: min });
  const conteos = conteoPorTema();
  const total = Object.values(conteos).reduce((a, b) => a + b, 0);

  const qs = (cambios: { tema?: string; min?: string }) => {
    const p = new URLSearchParams();
    const t = cambios.tema ?? tema;
    const m = cambios.min ?? (min ? String(min) : undefined);
    if (t) p.set("tema", t);
    if (m) p.set("min", m);
    const s = p.toString();
    return s ? `/radar?${s}` : "/radar";
  };

  // Agrupado por día: el feed se lee de arriba hacia abajo y la fecha es la
  // única separación que hace falta.
  const porDia = new Map<string, RadarItem[]>();
  for (const it of items) {
    const lista = porDia.get(it.fecha) ?? [];
    lista.push(it);
    porDia.set(it.fecha, lista);
  }

  return (
    <Contenedor ancho={980}>
      <EncabezadoPagina
        titulo="Radar"
        bajada={
          total > 0
            ? `${total} noticias filtradas en los últimos 30 días · ordenadas por relevancia`
            : "Lo que llega por los canales, sin el ruido"
        }
      />

      <div className="space-y-4">
        <CajaPegado />

        {DB_IS_EPHEMERAL && (
          <p className="text-[11px] text-amber-500/80 border border-amber-900/50 rounded-chip px-3 py-2">
            Este deploy corre sobre una copia temporal de la base: lo que cargues acá se pierde en
            el próximo arranque en frío. Para que el radar acumule, usalo en el dashboard local.
          </p>
        )}

        {total > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <ChipFiltro href={qs({ tema: "" })} activo={!tema}>
              Todo
            </ChipFiltro>
            {TEMAS.filter((t) => conteos[t] > 0).map((t) => (
              <ChipFiltro key={t} href={qs({ tema: t })} activo={tema === t} color={TEMA_COLOR[t]}>
                {TEMA_LABEL[t]}
                <span className="text-meta-suave ml-1.5 tabular-nums">{conteos[t]}</span>
              </ChipFiltro>
            ))}
            <span className="w-px h-4 bg-separador mx-2" />
            <ChipFiltro href={qs({ min: "" })} activo={!min}>
              Toda relevancia
            </ChipFiltro>
            <ChipFiltro href={qs({ min: "3" })} activo={min === 3}>
              3+
            </ChipFiltro>
            <ChipFiltro href={qs({ min: "4" })} activo={min === 4}>
              Sólo lo importante
            </ChipFiltro>
          </div>
        )}

        {items.length === 0 ? (
          <Card titulo="Sin nada todavía" nota="El radar se llena pegando volcados de los canales">
            <div className="space-y-3 text-[12.5px] text-secundario leading-relaxed">
              <p>
                Copiá un bloque de mensajes de un canal de WhatsApp y pegalo arriba. Claude separa
                las noticias del ruido, las clasifica por tema y les pone una relevancia para un
                asesor argentino, con una línea de qué implica para una cartera.
              </p>
              <p>
                Para que sea un gesto y no una tarea, hay un endpoint que hace lo mismo desde el
                celular: <code className="text-cuerpo">POST /api/radar/ingest</code> con el header{" "}
                <code className="text-cuerpo">x-radar-token</code>. Con un Atajo de iOS en la hoja
                de compartir, seleccionar los mensajes en WhatsApp y tocar &ldquo;Compartir →
                Radar&rdquo; los deja acá ya filtrados.
              </p>
            </div>
          </Card>
        ) : (
          [...porDia.entries()].map(([fecha, lista]) => (
            <Card key={fecha} titulo={tituloDia(fecha)} nota={`${lista.length} noticias`} cuerpo={false}>
              <div className="divide-y divide-divisor-fino">
                {lista.map((it) => (
                  <Item key={it.id} item={it} />
                ))}
              </div>
            </Card>
          ))
        )}
      </div>
    </Contenedor>
  );
}
