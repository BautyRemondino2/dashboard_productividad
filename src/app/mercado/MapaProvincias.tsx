"use client";

import { useMemo, useState } from "react";
import Fuente from "@/components/Fuente";
import { CREDITOS } from "@/lib/fuentes-credito";
import { MAPA_ALTO, MAPA_ANCHO, PROVINCIAS, type Orientacion, type Provincia } from "@/lib/provincias";
import { RUBRO_LABEL, VIGENCIA, type DatosProvincia } from "@/lib/macro-provincias";

/**
 * Mapa de las 24 jurisdicciones.
 *
 * Se colorea por una métrica continua, nunca por partido: cinco colores
 * categóricos no se pueden separar en un mapa —el lector compara provincias que
 * no se tocan, vía la leyenda, y ningún set de cinco pasa ese umbral para
 * daltonismo—. El bloque político va como etiqueta en el panel, que además es
 * más honesto: "Provincial" y "Peronismo" no son puntos de una escala.
 *
 * La orientación sí es un eje ordenado (izquierda → derecha), así que va con
 * una rampa divergente y la leyenda nombra cada paso.
 */

type Metrica = "empleo" | "exportaciones" | "poblacion" | "orientacion";

const METRICAS: { id: Metrica; label: string; nota: string }[] = [
  { id: "empleo", label: "Empleo privado", nota: "variación interanual de asalariados registrados" },
  { id: "exportaciones", label: "Exportaciones", nota: "millones de dólares del último año cerrado" },
  { id: "poblacion", label: "Población", nota: "Censo Nacional 2022" },
  { id: "orientacion", label: "Orientación", nota: "del gobierno provincial, en el eje izquierda-derecha" },
];

// ─── Escalas ────────────────────────────────────────────────────────────────

/**
 * Sin dato: casi el fondo del card, para que se lea como hueco y no como valor.
 *
 * Antes era un gris medio y quedaba muy cerca del gris del centro de la rampa
 * divergente, que significa "no se movió". Dos cosas distintas del mismo color.
 */
const SIN_DATO = "#131f33";

/** Secuencial de una sola tonalidad. En fondo oscuro, más claro = más. */
const AZUL = ["#0d366b", "#184f95", "#256abf", "#3987e5", "#5598e7", "#86b6ef", "#cde2fb"];

/** Divergente con gris al medio: el cero tiene que leerse como "nada". */
const EMPLEO = ["#9f1239", "#e11d48", "#fb7185", "#64748b", "#34d399", "#10b981", "#047857"];

/** Eje ordenado, sin colores de partido: la leyenda nombra cada paso. */
const ORIENTACION: Record<Orientacion, string> = {
  izquierda: "#7c3aed",
  centroizquierda: "#a78bfa",
  centro: "#64748b",
  centroderecha: "#fbbf24",
  derecha: "#d97706",
};

/** Un tono por rubro exportador. Cuatro categorías, separables entre sí. */
const RUBRO: Record<string, string> = {
  pp: "#c98500",
  moa: "#199e70",
  moi: "#3987e5",
  cye: "#d95926",
};

const ORDEN_ORIENTACION: Orientacion[] = [
  "izquierda", "centroizquierda", "centro", "centroderecha", "derecha",
];

const fmt = (v: number, dec = 0) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

const fmtPct = (v: number | null, dec = 1) =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${fmt(v, dec)}%`;

// ─── Componente ─────────────────────────────────────────────────────────────

export default function MapaProvincias({ datos }: { datos: Record<string, DatosProvincia> }) {
  const [metrica, setMetrica] = useState<Metrica>("empleo");
  const [activa, setActiva] = useState<string | null>(null);
  const [fijada, setFijada] = useState<string | null>(null);

  // Lo que se resalta en el mapa sólo cambia por interacción…
  const seleccionada = fijada ?? activa;
  // …pero el panel siempre muestra algo: vacío desperdicia media pantalla y no
  // deja ver de qué va la sección hasta que el lector adivina que hay que pasar
  // el mouse.
  const provincia =
    PROVINCIAS.find((p) => p.iso === seleccionada) ??
    PROVINCIAS.find((p) => p.iso === "AR-B")!;

  /** El valor crudo de cada provincia para la métrica elegida. */
  const valores = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const p of PROVINCIAS) {
      const d = datos[p.iso];
      m.set(
        p.iso,
        metrica === "empleo" ? d?.empleo?.interanual ?? null
        : metrica === "exportaciones" ? d?.exportaciones?.monto ?? null
        : metrica === "poblacion" ? p.poblacion
        : ORDEN_ORIENTACION.indexOf(p.orientacion)
      );
    }
    return m;
  }, [datos, metrica]);

  /**
   * El color de cada provincia, resuelto de una. Se calcula un mapa en vez de
   * devolver una función: el compilador de React no puede memoizar un `useMemo`
   * que devuelve closures distintas según condiciones.
   */
  const colores = useMemo(() => {
    const salida = new Map<string, string>();
    const nums = [...valores.values()].filter((v): v is number => v != null);

    for (const p of PROVINCIAS) {
      const v = valores.get(p.iso);

      if (metrica === "orientacion") {
        salida.set(p.iso, ORIENTACION[p.orientacion]);
      } else if (v == null || nums.length === 0) {
        salida.set(p.iso, SIN_DATO);
      } else if (metrica === "empleo") {
        // Divergente y simétrica alrededor de cero: si no, un +1% se pintaría
        // del mismo verde que un +6% según cómo haya venido el año
        const tope = Math.max(...nums.map(Math.abs)) || 1;
        const t = (v / tope + 1) / 2; // 0 = peor · 0,5 = cero · 1 = mejor
        salida.set(p.iso, EMPLEO[Math.min(EMPLEO.length - 1, Math.floor(t * EMPLEO.length))]);
      } else {
        // Secuencial en escala logarítmica: Buenos Aires exporta veinte veces
        // la mediana y en escala lineal el resto del mapa queda todo igual.
        const log = (x: number) => Math.log10(Math.max(x, 1));
        const min = Math.min(...nums.map(log));
        const max = Math.max(...nums.map(log));
        const t = (log(v) - min) / (max - min || 1);
        salida.set(p.iso, AZUL[Math.min(AZUL.length - 1, Math.floor(t * AZUL.length))]);
      }
    }
    return salida;
  }, [valores, metrica]);

  /** Totales del país, para calcular cuánto pesa cada provincia. */
  const nacional = useMemo(() => {
    let empleo = 0, expo = 0, poblacion = 0;
    for (const p of PROVINCIAS) {
      empleo += datos[p.iso]?.empleo?.nivel ?? 0;
      expo += datos[p.iso]?.exportaciones?.monto ?? 0;
      poblacion += p.poblacion ?? 0;
    }
    return { empleo, expo, poblacion };
  }, [datos]);

  const activaMeta = METRICAS.find((m) => m.id === metrica)!;

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/20 overflow-hidden">
      <header className="px-4 py-3 border-b border-slate-800/80 flex items-baseline gap-3 flex-wrap">
        <h2 className="text-[13px] font-semibold text-slate-200">Las provincias</h2>
        <span className="text-[10px] text-slate-600">{activaMeta.nota}</span>

        <div className="flex items-center gap-1 ml-auto">
          {METRICAS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMetrica(m.id)}
              className={`text-[11px] px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${
                metrica === m.id
                  ? "bg-slate-800 text-slate-100"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid md:grid-cols-[240px_1fr] gap-6 p-4 items-start">
        {/* ── El mapa ────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-3">
          <svg
            viewBox={`0 0 ${MAPA_ANCHO} ${MAPA_ALTO}`}
            className="w-full max-w-[240px] h-auto"
            role="img"
            aria-label="Mapa de las provincias argentinas"
            onMouseLeave={() => setActiva(null)}
          >
            {PROVINCIAS.map((p) => {
              const esta = seleccionada === p.iso;
              return (
                <path
                  key={p.iso}
                  d={p.d}
                  fill={colores.get(p.iso) ?? SIN_DATO}
                  // El borde del color del fondo separa provincias vecinas del
                  // mismo tono: sin esto se leen como una sola mancha
                  stroke={esta ? "#e2e8f0" : "#020617"}
                  strokeWidth={esta ? 1.6 : 0.7}
                  className="cursor-pointer transition-[stroke,opacity]"
                  opacity={seleccionada && !esta ? 0.55 : 1}
                  onMouseEnter={() => setActiva(p.iso)}
                  onClick={() => setFijada(fijada === p.iso ? null : p.iso)}
                >
                  <title>{p.nombre}</title>
                </path>
              );
            })}
          </svg>

          {/* Leyenda: la identidad nunca depende sólo del color */}
          <div className="w-full max-w-[240px]">
            {metrica === "orientacion" ? (
              <div className="grid grid-cols-1 gap-1">
                {ORDEN_ORIENTACION.map((o) => (
                  <div key={o} className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ background: ORIENTACION[o] }}
                    />
                    <span className="text-[10px] text-slate-500 capitalize">{o}</span>
                    <span className="text-[10px] text-slate-700 ml-auto">
                      {PROVINCIAS.filter((p) => p.orientacion === o).length}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Escala metrica={metrica} valores={valores} />
            )}
          </div>
        </div>

        {/* ── El detalle ─────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-5">
          <Detalle
            provincia={provincia}
            datos={datos[provincia.iso] ?? null}
            fijada={fijada === provincia.iso}
            interactuando={Boolean(seleccionada)}
            nacional={nacional}
          />

          <Ranking
            metrica={metrica}
            valores={valores}
            activa={provincia.iso}
            onElegir={(iso) => setFijada(iso)}
          />
        </div>
      </div>

      <p className="px-4 pb-4 -mt-1 text-[10px] text-slate-600 leading-relaxed">
        Empleo: asalariados registrados del sector privado (SSPM), mes{" "}
        {VIGENCIA.mesEmpleo.slice(5, 7)}/{VIGENCIA.mesEmpleo.slice(0, 4)}. Exportaciones:
        INDEC, año {VIGENCIA.anioExportaciones}. Población: Censo Nacional 2022.
        {/* La fecha de generación va a la vista: estos datos están en el repo y
            sin este renglón envejecerían sin que se note. */}
        <br />
        Bajados el {VIGENCIA.generado.slice(8)}/{VIGENCIA.generado.slice(5, 7)}/
        {VIGENCIA.generado.slice(0, 4)} · se actualizan con{" "}
        <code className="text-meta">node scripts/generar-datos-provincias.mjs</code>.
        <br />
        No hay producto bruto geográfico ni empleo público por provincia: Argentina no los
        publica de forma regular ni comparable entre jurisdicciones, y estimarlos sería
        inventarlos.
      </p>
      <div className="px-4 py-3 border-t border-slate-800/80">
        <Fuente
          creditos={[CREDITOS.indec]}
          extra="Exportaciones y población del INDEC, vía la API de series de datos.gob.ar. El empleo privado sale del Ministerio de Trabajo."
        />
      </div>
    </section>
  );
}

// ─── Leyenda de escala ──────────────────────────────────────────────────────

function Escala({ metrica, valores }: { metrica: Metrica; valores: Map<string, number | null> }) {
  const nums = [...valores.values()].filter((v): v is number => v != null);
  if (nums.length === 0) return null;

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const sinDato = PROVINCIAS.filter((p) => valores.get(p.iso) == null).length;

  const etiqueta = (v: number) =>
    metrica === "empleo" ? fmtPct(v)
    : metrica === "exportaciones" ? `US$${fmt(v / 1000, 1)} mil M`
    : `${fmt(v / 1e6, 1)} M`;

  /**
   * La rampa divergente se dibuja simétrica porque así se pinta el mapa: el
   * cero tiene que caer en el centro, si no un +1% se vería del mismo verde que
   * un +6% según cómo haya venido el año.
   *
   * Eso deja tramos de la barra sin datos que los ocupen —acá el empleo cae
   * hasta -12% pero sólo sube hasta +4%—, así que los extremos reales van
   * marcados sobre la barra. Antes la barra decía "+4,0%" en la punta derecha,
   * que es donde estaría un +12,3% que no existe.
   */
  if (metrica === "empleo") {
    const tope = Math.max(...nums.map(Math.abs)) || 1;
    const pos = (v: number) => ((v / tope + 1) / 2) * 100;

    return (
      <div>
        <div className="relative">
          <div className="flex h-2 rounded-sm overflow-hidden">
            {EMPLEO.map((c) => (
              <div key={c} className="flex-1" style={{ background: c }} />
            ))}
          </div>
          {/* Hasta dónde llegan los datos de verdad */}
          {[min, max].map((v) => (
            <div
              key={v}
              className="absolute -top-[3px] -bottom-[3px] w-px bg-cuerpo"
              style={{ left: `${pos(v)}%` }}
            />
          ))}
        </div>

        <div className="relative h-4 mt-1">
          {[min, max].map((v, i) => (
            <span
              key={v}
              className="absolute text-[10px] text-label tabular-nums whitespace-nowrap"
              style={{ left: `${pos(v)}%`, transform: i === 0 ? "translateX(-6px)" : "translateX(-100%)" }}
            >
              {etiqueta(v)}
            </span>
          ))}
        </div>

        <div className="flex justify-between text-[9px] uppercase tracking-[0.1em] text-tenue">
          <span>cae</span>
          <span>sin cambio</span>
          <span>crece</span>
        </div>

        {sinDato > 0 && <SinDato n={sinDato} />}
      </div>
    );
  }

  return (
    <div>
      <div className="flex h-2 rounded-sm overflow-hidden">
        {AZUL.map((c) => (
          <div key={c} className="flex-1" style={{ background: c }} />
        ))}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-label tabular-nums">{etiqueta(min)}</span>
        <span className="text-[10px] text-label tabular-nums">{etiqueta(max)}</span>
      </div>
      {metrica === "exportaciones" && (
        <p className="text-[9px] text-meta-suave mt-1 leading-relaxed">
          Escala logarítmica: Buenos Aires exporta veinte veces la mediana.
        </p>
      )}
      {sinDato > 0 && <SinDato n={sinDato} />}
    </div>
  );
}

/** El hueco se nombra: en gris sin más, se confunde con un valor bajo. */
function SinDato({ n }: { n: number }) {
  return (
    <div className="flex items-center gap-2 mt-2">
      <span
        className="w-3 h-3 rounded-sm border border-borde shrink-0"
        style={{ background: SIN_DATO }}
      />
      <span className="text-[10px] text-tenue">
        {n === 1 ? "1 provincia sin dato" : `${n} provincias sin dato`}
      </span>
    </div>
  );
}


// ─── Lectura de la provincia ────────────────────────────────────────────────

/**
 * Cómo viene la provincia, escrito a partir de los datos.
 *
 * Se arma con los números en vez de guardar 24 textos fijos: así no queda vieja
 * cuando cambian las cifras, y nunca dice algo que el dato no respalde.
 */
function Lectura({
  provincia,
  empleo,
  expo,
  nacional,
}: {
  provincia: Provincia;
  empleo: DatosProvincia["empleo"] | undefined;
  expo: DatosProvincia["exportaciones"] | undefined;
  nacional: { empleo: number; expo: number; poblacion: number };
}) {
  const frases: string[] = [];

  if (provincia.poblacion && nacional.poblacion) {
    const pobPct = (provincia.poblacion / nacional.poblacion) * 100;
    const empPct = empleo && nacional.empleo ? (empleo.nivel / nacional.empleo) * 100 : null;
    const expPct = expo && nacional.expo ? (expo.monto / nacional.expo) * 100 : null;

    const partes = [`${fmt(pobPct, 1)}% de la población`];
    if (empPct != null) partes.push(`${fmt(empPct, 1)}% del empleo privado registrado`);
    if (expPct != null) partes.push(`${fmt(expPct, 1)}% de las exportaciones`);
    // "el A, el B y el C" — la última va con "y", no con coma
    const ultima = partes.pop()!;
    const listado = partes.length ? `${partes.join(", el ")} y el ${ultima}` : ultima;
    frases.push(`Concentra el ${listado} del país.`);
  }

  if (expo?.composicion.length) {
    const top = expo.composicion[0];
    const destino = expo.destinos[0];

    frases.push(
      top.peso >= 60
        ? `Su comercio exterior depende casi por completo de ${RUBRO_LABEL[top.rubro].toLowerCase()}: ${fmt(top.peso, 0)}% del total.`
        : `Lo que más exporta son ${RUBRO_LABEL[top.rubro].toLowerCase()} (${fmt(top.peso, 0)}%), sobre una base más repartida.`
    );

    // El rubro solo puede engañar: el INDEC mete oro y plata dentro de las
    // manufacturas industriales, así que una provincia minera aparece como
    // industrial. El destino lo delata — Suiza es refinación de oro.
    if (top.rubro === "moi" && top.peso >= 60 && /suiza/i.test(destino?.pais ?? "")) {
      frases.push(
        `Ojo con ese rubro: su primer destino es ${destino.pais} (${fmt(destino.peso, 0)}%), que compra oro para refinar. El INDEC clasifica los metales preciosos como manufactura industrial, así que acá "industria" es minería.`
      );
    } else if (destino) {
      frases.push(`Su principal destino es ${destino.pais}, con ${fmt(destino.peso, 0)}% del total.`);
    }
  }

  if (empleo?.interanual != null) {
    const v = empleo.interanual;
    frases.push(
      v > 2 ? `El empleo privado crece con fuerza: ${fmtPct(v)} interanual.`
      : v > 0.3 ? `El empleo privado crece despacio, ${fmtPct(v)} interanual.`
      : v > -0.3 ? "El empleo privado está estancado."
      // Sin el signo: "cae +2,4%" se contradice a sí mismo
      : v > -3 ? `El empleo privado cae ${fmt(Math.abs(v), 1)}% interanual.`
      : `El empleo privado se está desplomando: cae ${fmt(Math.abs(v), 1)}% interanual.`
    );
  }

  if (empleo && provincia.poblacion) {
    frases.push(
      `Hay ${fmt((empleo.nivel * 1000 * 100) / provincia.poblacion, 1)} asalariados privados registrados cada 100 habitantes.`
    );
  }

  if (frases.length === 0) return null;

  return <p className="text-[11px] text-slate-400 leading-relaxed mt-4">{frases.join(" ")}</p>;
}

// ─── Ranking ────────────────────────────────────────────────────────────────

/**
 * Las que más y las que menos, según la métrica elegida.
 *
 * El mapa muestra el patrón geográfico; esto responde la otra pregunta, que es
 * quién puntea y quién queda último. Buscar una provincia chica en el mapa por
 * su color es incómodo — acá está la lista.
 */
function Ranking({
  metrica,
  valores,
  activa,
  onElegir,
}: {
  metrica: Metrica;
  valores: Map<string, number | null>;
  activa: string;
  onElegir: (iso: string) => void;
}) {
  const orden = useMemo(() => {
    return PROVINCIAS
      .map((p) => ({ p, v: valores.get(p.iso) }))
      .filter((x): x is { p: Provincia; v: number } => x.v != null)
      .sort((a, b) => b.v - a.v);
  }, [valores]);

  if (orden.length < 6) return null;

  const etiqueta = (v: number) =>
    metrica === "empleo" ? fmtPct(v)
    : metrica === "exportaciones" ? `US$${fmt(v)} M`
    : metrica === "poblacion" ? fmt(v)
    : ORDEN_ORIENTACION[v] ?? "—";

  const arriba = orden.slice(0, 5);
  const abajo = orden.slice(-5).reverse();

  const fila = ({ p, v }: { p: Provincia; v: number }, i: number) => (
    <button
      key={p.iso}
      onClick={() => onElegir(p.iso)}
      className={`flex items-center gap-2 w-full text-left px-1.5 py-1 rounded transition-colors ${
        p.iso === activa ? "bg-slate-800/60" : "hover:bg-slate-900/60"
      }`}
    >
      <span className="text-[10px] text-slate-700 tabular-nums w-3 shrink-0">{i + 1}</span>
      <span className="text-[11px] text-slate-300 truncate flex-1">{p.nombre}</span>
      <span className="text-[11px] text-slate-400 tabular-nums shrink-0">{etiqueta(v)}</span>
    </button>
  );

  return (
    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 pt-4 border-t border-slate-800/60">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-600 mb-1.5">
          {metrica === "empleo" ? "Las que más crecen" : "Las de arriba"}
        </p>
        {arriba.map(fila)}
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-600 mb-1.5">
          {metrica === "empleo" ? "Las que más caen" : "Las de abajo"}
        </p>
        {abajo.map(fila)}
      </div>
    </div>
  );
}

// ─── Panel de detalle ───────────────────────────────────────────────────────

function Dato({ label, valor, nota }: { label: string; valor: string; nota?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-600">{label}</p>
      <p className="text-[15px] text-slate-200 tabular-nums mt-0.5">{valor}</p>
      {nota && <p className="text-[10px] text-slate-600">{nota}</p>}
    </div>
  );
}

function Detalle({
  provincia,
  datos,
  fijada,
  interactuando,
  nacional,
}: {
  provincia: Provincia;
  datos: DatosProvincia | null;
  fijada: boolean;
  /** False cuando es la provincia por defecto y nadie tocó el mapa todavía. */
  interactuando: boolean;
  /** Totales del país, para expresar cuánto pesa esta provincia. */
  nacional: { empleo: number; expo: number; poblacion: number };
}) {
  const empleo = datos?.empleo;
  const expo = datos?.exportaciones;

  return (
    <div className="min-w-0">
      <div className="flex items-start gap-3">
        {provincia.foto ? (
          // eslint-disable-next-line @next/next/no-img-element -- Wikimedia Commons, sin optimizador
          <img
            src={provincia.foto}
            alt={`${provincia.gobernador}, gobernador de ${provincia.nombre}`}
            width={52}
            height={52}
            loading="lazy"
            className="w-[52px] h-[52px] rounded-lg object-cover object-top border border-slate-800 shrink-0 bg-slate-900"
          />
        ) : (
          <div className="w-[52px] h-[52px] rounded-lg border border-slate-800 bg-slate-900 shrink-0 flex items-center justify-center">
            <span className="text-[13px] text-slate-600">
              {provincia.gobernador.split(" ").map((w) => w[0]).slice(0, 2).join("")}
            </span>
          </div>
        )}

        <div className="min-w-0">
      <div className="flex items-baseline gap-2 flex-wrap">
        <h3 className="text-xl font-semibold text-slate-100 tracking-tight">{provincia.nombre}</h3>
        {fijada ? (
          <span className="text-[10px] text-slate-600">fijada · clic para soltar</span>
        ) : !interactuando ? (
          <span className="text-[10px] text-slate-600">
            pasá el mouse por el mapa · clic para fijar
          </span>
        ) : null}
      </div>

      <p className="text-[13px] text-slate-300 mt-1">{provincia.gobernador}</p>
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        <span className="text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-400">
          {provincia.partido}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded border border-slate-800 text-slate-500">
          {provincia.bloque}
        </span>
        <span className="text-[10px] text-slate-600 capitalize">{provincia.orientacion}</span>
      </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5">
        <Dato
          label="Población"
          valor={provincia.poblacion ? fmt(provincia.poblacion) : "—"}
          nota="Censo 2022"
        />
        <Dato
          label="Empleo privado"
          valor={empleo ? `${fmt(empleo.nivel, 1)} mil` : "—"}
          nota={empleo ? `${fmtPct(empleo.interanual)} interanual` : undefined}
        />
        <Dato
          label="Exportaciones"
          valor={expo ? `US$${fmt(expo.monto)} M` : "—"}
          nota={expo ? `${expo.anio} · ${fmtPct(expo.interanual)}` : undefined}
        />
      </div>

      {expo && expo.composicion.length > 0 && (
        <div className="mt-5">
          <p className="text-[10px] uppercase tracking-wider text-slate-600 mb-2">
            De dónde salen sus dólares
          </p>
          <div className="flex h-2.5 rounded-sm overflow-hidden gap-[2px]">
            {expo.composicion.map((c) => (
              <div
                key={c.rubro}
                style={{ width: `${c.peso}%`, background: RUBRO[c.rubro] }}
                title={`${RUBRO_LABEL[c.rubro]}: ${fmt(c.peso, 1)}%`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {expo.composicion.map((c) => (
              <span key={c.rubro} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm" style={{ background: RUBRO[c.rubro] }} />
                <span className="text-[10px] text-slate-500">{RUBRO_LABEL[c.rubro]}</span>
                <span className="text-[10px] text-slate-400 tabular-nums">{fmt(c.peso, 0)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {expo && expo.destinos.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-600 mb-1.5">
            A dónde van
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {expo.destinos.map((d) => (
              <span key={d.pais} className="flex items-baseline gap-1.5">
                <span className="text-[11px] text-slate-300">{d.pais}</span>
                <span className="text-[11px] text-slate-500 tabular-nums">{fmt(d.peso, 0)}%</span>
              </span>
            ))}
          </div>
          {expo.destinosCubren < 50 && (
            <p className="text-[10px] text-slate-600 mt-1">
              Estos explican {fmt(expo.destinosCubren, 0)}% del total: el resto se reparte
              entre países que el INDEC no desglosa.
            </p>
          )}
        </div>
      )}

      <Lectura provincia={provincia} empleo={empleo} expo={expo} nacional={nacional} />

    </div>
  );
}
