"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import Card from "@/components/Card";
import {
  avanceDe,
  camposHuerfanos,
  type Campo,
  type FichaAnalisis,
  type Seccion,
  type Tabla,
} from "@/lib/equity-ficha";
import {
  alternarCheckFicha,
  guardarCampoFicha,
  guardarTablaFicha,
  reiniciarFicha,
} from "./actions";

/**
 * El editor de la ficha de análisis.
 *
 * Tres decisiones de fondo:
 *
 *  - **Se escribe en el lugar, sin botón de guardar.** Cada campo guarda al
 *    salir del foco. Una ficha de diez secciones con un botón arriba es una
 *    ficha que se pierde a la mitad; y el estado de guardado se muestra siempre,
 *    porque autoguardado sin señal es peor que un botón.
 *  - **El servidor no revalida en cada tecla.** El borrador vive acá y la DB es
 *    el destino: si cada blur revalidara la ruta, la página volvería a pedirle
 *    a Yahoo la serie financiera entera para redibujar un párrafo.
 *  - **Los bloques calculados llegan armados desde el servidor** (`bloques`).
 *    Son componentes de servidor puros que la página inserta donde la sección
 *    los declara: acá no se recalcula nada, sólo se ubica.
 */

type Estado = "limpio" | "guardando" | "guardado" | "error";

const hora = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

// ─── Campos ──────────────────────────────────────────────────────────────────

function CampoEditable({
  campo,
  valor,
  onGuardar,
}: {
  campo: Campo;
  valor: string;
  onGuardar: (valor: string) => void;
}) {
  const [draft, setDraft] = useState(valor);
  const enfocado = useRef(false);

  // El valor de afuera manda mientras no se esté escribiendo: si no, un
  // guardado de otro campo pisa lo que se está tipeando en éste.
  useEffect(() => {
    if (!enfocado.current) setDraft(valor);
  }, [valor]);

  const commit = () => {
    enfocado.current = false;
    if (draft.trim() !== valor.trim()) onGuardar(draft);
  };

  const clases =
    "w-full bg-transparent text-[12.5px] text-cuerpo leading-relaxed rounded-md px-2 py-1.5 " +
    "border border-transparent hover:border-borde focus:border-outline focus:bg-boton " +
    "outline-none transition-colors placeholder:text-slate-700";

  return (
    <div className="grid sm:grid-cols-[190px_minmax(0,1fr)] gap-x-5 gap-y-1 items-baseline py-1">
      <label
        className="text-[11px] text-label leading-snug pt-1.5"
        htmlFor={`campo-${campo.clave}`}
      >
        {campo.label}
      </label>

      <div className="min-w-0">
        {campo.tipo === "area" ? (
          <textarea
            id={`campo-${campo.clave}`}
            value={draft}
            placeholder={campo.pista}
            onFocus={() => (enfocado.current = true)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.blur();
            }}
            rows={Math.max(2, draft.split("\n").length + 1)}
            className={`${clases} resize-y`}
          />
        ) : (
          <input
            id={`campo-${campo.clave}`}
            type="text"
            value={draft}
            placeholder={campo.pista}
            onFocus={() => (enfocado.current = true)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className={clases}
          />
        )}

        {campo.opciones && (
          <div className="flex flex-wrap gap-1.5 mt-1 ml-2">
            {campo.opciones.map((o) => {
              const puesta = draft.trim() === o;
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => {
                    setDraft(o);
                    onGuardar(o);
                  }}
                  className={`text-[10.5px] px-2 py-[3px] rounded-badge border transition-colors ${
                    puesta
                      ? "border-outline bg-chip text-titulo"
                      : "border-borde text-meta hover:text-secundario hover:border-outline"
                  }`}
                >
                  {o}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tablas ──────────────────────────────────────────────────────────────────

function TablaEditable({
  tabla,
  filas,
  onGuardar,
}: {
  tabla: Tabla;
  filas: string[][];
  onGuardar: (filas: string[][]) => void;
}) {
  const columnas = tabla.columnas.length;
  const fijas = tabla.filasFijas;

  // Una tabla de filas fijas siempre tiene las mismas; una libre arranca con
  // las que pide la plantilla y crece con el botón.
  const inicial = useMemo(() => {
    const base = fijas
      ? fijas.map((f, i) => [f, ...Array.from({ length: columnas - 1 }, (_, j) => filas[i]?.[j + 1] ?? "")])
      : filas.length > 0
        ? filas
        : Array.from({ length: tabla.filasIniciales ?? 3 }, () => Array(columnas).fill(""));
    return base;
  }, [filas, fijas, columnas, tabla.filasIniciales]);

  const [datos, setDatos] = useState<string[][]>(inicial);
  const editando = useRef(false);

  useEffect(() => {
    if (!editando.current) setDatos(inicial);
  }, [inicial]);

  const escribir = (i: number, j: number, v: string) => {
    setDatos((prev) => prev.map((f, fi) => (fi === i ? f.map((c, ci) => (ci === j ? v : c)) : f)));
  };

  const celda =
    "w-full bg-transparent text-[12px] text-cuerpo tabular-nums px-2 py-1.5 border border-transparent " +
    "hover:border-borde focus:border-outline focus:bg-boton outline-none rounded transition-colors " +
    "placeholder:text-slate-700";

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-[0.12em] text-tenue">{tabla.label}</div>
      <div className="overflow-x-auto border border-divisor rounded-card">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-encabezado border-b border-divisor">
              {tabla.columnas.map((c) => (
                <th
                  key={c}
                  className="text-left text-[10px] uppercase tracking-[0.1em] text-meta font-normal px-2.5 py-1.5 whitespace-nowrap"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-divisor-fino">
            {datos.map((fila, i) => (
              <tr key={i}>
                {fila.map((valor, j) => {
                  const bloqueada = Boolean(fijas) && j === 0;
                  return (
                    <td key={j} className={bloqueada ? "px-2.5 py-1.5 whitespace-nowrap" : "p-0"}>
                      {bloqueada ? (
                        <span className="text-[12px] text-label">{valor}</span>
                      ) : (
                        <input
                          type="text"
                          value={valor}
                          onFocus={() => (editando.current = true)}
                          onChange={(e) => escribir(i, j, e.target.value)}
                          onBlur={() => {
                            editando.current = false;
                            onGuardar(datos);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                          }}
                          className={celda}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!fijas && (
        <button
          type="button"
          onClick={() => setDatos((prev) => [...prev, Array(columnas).fill("")])}
          className="text-[10.5px] text-meta hover:text-secundario transition-colors"
        >
          + fila
        </button>
      )}
    </div>
  );
}

// ─── Checklist ───────────────────────────────────────────────────────────────

function Checklist({
  items,
  marcados,
  onAlternar,
}: {
  items: string[];
  marcados: Record<string, boolean>;
  onAlternar: (item: string, valor: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => {
        const puesto = Boolean(marcados[i]);
        return (
          <button
            key={i}
            type="button"
            onClick={() => onAlternar(i, !puesto)}
            className={`text-[11.5px] px-2.5 py-1 rounded-badge border transition-colors ${
              puesto
                ? "border-outline bg-chip text-titulo"
                : "border-borde text-meta hover:text-secundario hover:border-outline"
            }`}
          >
            <span className="mr-1.5 text-[10px]">{puesto ? "✓" : "○"}</span>
            {i}
          </button>
        );
      })}
    </div>
  );
}

// ─── La ficha ────────────────────────────────────────────────────────────────

export default function FichaClient({
  ticker,
  inicial,
  bloques,
  secciones,
}: {
  ticker: string;
  inicial: FichaAnalisis;
  /** Los cuadros calculados, ya renderizados en el servidor. */
  bloques: Partial<Record<string, ReactNode>>;
  /** La plantilla ya resuelta para este papel: cambia según qué clase de negocio es. */
  secciones: Seccion[];
}) {
  const [campos, setCampos] = useState(inicial.campos);
  const [tablas, setTablas] = useState(inicial.tablas);
  const [checks, setChecks] = useState(inicial.checks);

  const [estado, setEstado] = useState<Estado>("limpio");
  const [error, setError] = useState<string | null>(null);
  const [ultimo, setUltimo] = useState<Date | null>(
    inicial.actualizado ? new Date(inicial.actualizado.replace(" ", "T") + "Z") : null
  );
  const [, iniciar] = useTransition();
  const [activa, setActiva] = useState(secciones[0].id);

  const avance = useMemo(
    () => avanceDe({ ...inicial, campos, tablas, checks }, secciones),
    [inicial, campos, tablas, checks, secciones]
  );

  // Lo que se escribió cuando la ficha usaba otra plantilla. Se calcula sobre
  // `inicial` y no sobre el borrador: si se calculara sobre lo que se está
  // tipeando, un campo aparecería acá abajo mientras se escribe arriba.
  const huerfanos = useMemo(
    () => camposHuerfanos({ ...inicial, campos: inicial.campos }, secciones),
    [inicial, secciones]
  );

  /** Manda el cambio y deja el sello. Un error se muestra y no se traga. */
  const enviar = useCallback((fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setEstado("guardando");
    iniciar(async () => {
      const r = await fn();
      if (r.ok) {
        setEstado("guardado");
        setError(null);
        setUltimo(new Date());
      } else {
        setEstado("error");
        setError(r.error ?? "No se pudo guardar");
      }
    });
  }, []);

  const guardarCampo = (clave: string, valor: string) => {
    setCampos((p) => ({ ...p, [clave]: valor }));
    enviar(() => guardarCampoFicha(ticker, clave, valor));
  };

  const guardarTabla = (clave: string, filas: string[][]) => {
    setTablas((p) => ({ ...p, [clave]: filas }));
    enviar(() => guardarTablaFicha(ticker, clave, filas));
  };

  const alternar = (clave: string, valor: boolean) => {
    setChecks((p) => ({ ...p, [clave]: valor }));
    enviar(() => alternarCheckFicha(ticker, clave, valor));
  };

  const reiniciar = () => {
    if (!confirm(`¿Borrar toda la ficha de ${ticker}? No se puede deshacer.`)) return;
    setCampos({});
    setTablas({});
    setChecks({});
    enviar(() => reiniciarFicha(ticker));
  };

  // Qué sección se está mirando, para marcarla en el índice.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entradas) => {
        const visible = entradas.filter((e) => e.isIntersecting).sort(
          (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
        )[0];
        if (visible?.target.id) setActiva(visible.target.id);
      },
      { rootMargin: "-72px 0px -65% 0px" }
    );
    for (const s of secciones) {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [secciones]);

  const sello =
    estado === "guardando"
      ? "guardando…"
      : estado === "error"
        ? error ?? "error al guardar"
        : ultimo
          ? `guardado ${hora(ultimo)}`
          : "sin guardar todavía";

  return (
    <div className="grid xl:grid-cols-[176px_minmax(0,1fr)] gap-6 items-start">
      {/* ── Índice ──────────────────────────────────────────────────── */}
      <nav className="hidden xl:block sticky top-[72px] space-y-px">
        {secciones.map((s) => {
          const conAlgo = avance.seccionesConAlgo.includes(s.id);
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={`flex items-baseline gap-2 text-[11.5px] px-2 py-[5px] rounded transition-colors ${
                activa === s.id
                  ? "bg-chip text-titulo"
                  : "text-meta hover:text-secundario hover:bg-divisor-fino"
              }`}
            >
              <span className="tabular-nums text-tenue w-3.5 shrink-0">{s.numero}</span>
              <span className="min-w-0 truncate">{s.titulo}</span>
              <span
                className={`ml-auto w-1.5 h-1.5 rounded-full shrink-0 self-center ${
                  conAlgo ? "bg-sube/70" : "bg-separador"
                }`}
                title={conAlgo ? "tiene algo escrito" : "vacía"}
              />
            </a>
          );
        })}

        <div className="pt-3 mt-2 border-t border-divisor space-y-2">
          <div className="text-[10px] text-meta-suave tabular-nums">
            {avance.completos} de {avance.total} del núcleo
          </div>
          {avance.opcionales > 0 && (
            <div className="text-[10px] text-meta-suave tabular-nums">
              + {avance.opcionales} opcionales
            </div>
          )}
          <div className="h-[3px] rounded-full bg-divisor overflow-hidden">
            <div
              className="h-full rounded-full bg-sube/70 transition-all duration-300"
              style={{ width: `${avance.porcentaje}%` }}
            />
          </div>
          <button
            type="button"
            onClick={reiniciar}
            className="text-[10px] text-meta-suave hover:text-baja transition-colors"
          >
            borrar la ficha
          </button>
        </div>
      </nav>

      {/* ── Secciones ───────────────────────────────────────────────── */}
      <div className="space-y-4 min-w-0">
        {/* El sello de guardado va arriba y pegado: autoguardar sin decirlo es
            pedirle al que escribe que confíe sin evidencia. */}
        <div className="sticky top-[52px] z-10 flex items-center gap-3 px-3 py-1.5 rounded-card border border-borde bg-card/95 backdrop-blur">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              estado === "guardando"
                ? "bg-amber-400/80 animate-pulse"
                : estado === "error"
                  ? "bg-baja"
                  : "bg-sube/70"
            }`}
          />
          <span className={`text-[11px] ${estado === "error" ? "text-baja" : "text-meta"}`}>
            {sello}
          </span>
          <span
            className="ml-auto text-[11px] text-meta-suave tabular-nums"
            title={`El porcentaje va sobre el núcleo: los ${avance.total} campos sin los cuales la ficha no dice nada. Los otros ${avance.totalOpcionales} suman prolijidad.`}
          >
            {avance.porcentaje}% · {avance.completos}/{avance.total} del núcleo
          </span>
        </div>

        {secciones.map((s) => {
          // El núcleo se ve; lo demás arranca plegado. Diez secciones de campos
          // vacíos son una ficha que no se empieza: lo que está a la vista tiene
          // que ser lo que hay que contestar sí o sí.
          const nucleo = s.campos.filter((c) => c.nucleo);
          const opcionales = s.campos.filter((c) => !c.nucleo);
          const escritosOpcionales = opcionales.filter(
            (c) => (campos[c.clave] ?? "").trim().length > 0
          ).length;

          const editables = (lista: Campo[]) => (
            <div className="divide-y divide-divisor-fino">
              {lista.map((c) => (
                <CampoEditable
                  key={c.clave}
                  campo={c}
                  valor={campos[c.clave] ?? ""}
                  onGuardar={(v) => guardarCampo(c.clave, v)}
                />
              ))}
            </div>
          );

          return (
            <Card
              key={s.id}
              id={s.id}
              titulo={`${s.numero}. ${s.titulo}`}
              nota={s.bajada}
              serif
              className="scroll-mt-[104px]"
            >
              <div className="space-y-4">
                {s.auto && bloques[s.auto]}

                {s.tablas?.map((t) => (
                  <TablaEditable
                    key={t.clave}
                    tabla={t}
                    filas={tablas[t.clave] ?? []}
                    onGuardar={(filas) => guardarTabla(t.clave, filas)}
                  />
                ))}

                {s.checklist && (
                  <Checklist items={s.checklist} marcados={checks} onAlternar={alternar} />
                )}

                {nucleo.length > 0 && editables(nucleo)}

                {opcionales.length > 0 && (
                  <details className="group" open={escritosOpcionales > 0}>
                    <summary className="cursor-pointer list-none text-[11px] text-meta hover:text-cuerpo transition-colors select-none">
                      <span className="group-open:hidden">
                        ▸ {opcionales.length} {opcionales.length === 1 ? "campo" : "campos"} más
                        {escritosOpcionales > 0 && ` · ${escritosOpcionales} con algo escrito`}
                      </span>
                      <span className="hidden group-open:inline">▾ ocultar los opcionales</span>
                    </summary>
                    <div className="mt-2">{editables(opcionales)}</div>
                  </details>
                )}
              </div>
            </Card>
          );
        })}

        {huerfanos.length > 0 && (
          <Card
            titulo="Escrito con otra plantilla"
            nota={`Esta ficha ahora usa la plantilla de otro tipo de negocio y estos ${
              huerfanos.length === 1 ? "campo ya no se pregunta" : "campos ya no se preguntan"
            }. Nada se borró: se puede leer, editar o vaciar acá.`}
            serif
          >
            <div className="divide-y divide-divisor-fino">
              {huerfanos.map((c) => (
                <CampoEditable
                  key={c.clave}
                  campo={c}
                  valor={campos[c.clave] ?? ""}
                  onGuardar={(v) => guardarCampo(c.clave, v)}
                />
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
