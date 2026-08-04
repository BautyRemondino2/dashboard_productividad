"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CrmMetricas from "./CrmMetricas";
import ClienteDrawer from "./ClienteDrawer";
import {
  ETAPAS, FUENTES, URGENCIAS, URGENCIA_LABEL,
  clientesToCsv, diasRelativos, formatUSD, hoyISO, nombreCompleto, urgenciaDe,
  type Cliente, type ClienteInput, type Etapa, type Fuente, type Urgencia,
} from "@/lib/crm";
import { BADGE_BASE, ETAPA_CLASS, URGENCIA_CLASS } from "@/lib/crm-ui";

type CampoOrden =
  | "apellido" | "etapa" | "fuente" | "ticket_estimado"
  | "perfil_riesgo" | "fecha_proxima_accion" | "ultima_interaccion";

interface Orden { campo: CampoOrden; dir: "asc" | "desc" }

const ORDEN_ETAPA = new Map(ETAPAS.map((e, i) => [e, i]));

const control =
  "bg-slate-900/60 border border-slate-800 rounded-md px-2 py-1 text-[11px] text-slate-300 " +
  "focus:outline-none focus:border-slate-600 transition-colors";

export default function CrmClient({ clientesIniciales, hoyServidor }: {
  clientesIniciales: Cliente[];
  hoyServidor: string;
}) {
  const [clientes, setClientes] = useState<Cliente[]>(clientesIniciales);
  const [hoy, setHoy] = useState(hoyServidor);

  const [q, setQ] = useState("");
  const [fEtapa, setFEtapa] = useState<Etapa | "">("");
  const [fFuente, setFFuente] = useState<Fuente | "">("");
  const [fUrgencia, setFUrgencia] = useState<Urgencia | "">("");
  const [orden, setOrden] = useState<Orden>({ campo: "fecha_proxima_accion", dir: "asc" });

  const [drawer, setDrawer] = useState<{ cliente: Cliente | null } | null>(null);
  const [guardandoIds, setGuardandoIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  // El servidor puede estar en otra zona horaria (en Vercel corre en UTC):
  // la urgencia se decide con el día local de quien mira la pantalla.
  useEffect(() => {
    const local = hoyISO();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (local !== hoyServidor) setHoy(local);
  }, [hoyServidor]);

  /** PATCH optimista: pinta el cambio y lo revierte si el server lo rechaza. */
  const patch = useCallback(async (id: number, campos: Partial<ClienteInput>) => {
    const previo = clientes.find((c) => c.id === id);
    if (!previo) return;

    setClientes((prev) => prev.map((c) => (c.id === id ? { ...c, ...campos } : c)));
    setGuardandoIds((prev) => [...prev, id]);
    setError(null);

    try {
      const res = await fetch(`/api/clientes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campos),
      });
      const cuerpo = await res.json().catch(() => ({}));
      if (!res.ok) {
        setClientes((prev) => prev.map((c) => (c.id === id ? previo : c)));
        setError(cuerpo.errores?.join(" · ") ?? cuerpo.error ?? `No se pudo guardar (${res.status})`);
        return;
      }
      setClientes((prev) => prev.map((c) => (c.id === id ? (cuerpo as Cliente) : c)));
    } catch {
      setClientes((prev) => prev.map((c) => (c.id === id ? previo : c)));
      setError("No se pudo conectar con el servidor. El cambio no se guardó.");
    } finally {
      setGuardandoIds((prev) => prev.filter((x) => x !== id));
    }
  }, [clientes]);

  const filtrados = useMemo(() => {
    const texto = q.trim().toLowerCase();
    const lista = clientes.filter((c) => {
      if (fEtapa && c.etapa !== fEtapa) return false;
      if (fFuente && c.fuente !== fFuente) return false;
      if (fUrgencia && urgenciaDe(c.fecha_proxima_accion, hoy) !== fUrgencia) return false;
      if (!texto) return true;
      return (
        nombreCompleto(c).toLowerCase().includes(texto) ||
        (c.email ?? "").toLowerCase().includes(texto)
      );
    });

    const dir = orden.dir === "asc" ? 1 : -1;
    return [...lista].sort((a, b) => {
      const va = valorOrden(a, orden.campo);
      const vb = valorOrden(b, orden.campo);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;   // los vacíos siempre al final
      if (vb === null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb), "es") * dir;
    });
  }, [clientes, q, fEtapa, fFuente, fUrgencia, hoy, orden]);

  function ordenarPor(campo: CampoOrden) {
    setOrden((o) => (o.campo === campo ? { campo, dir: o.dir === "asc" ? "desc" : "asc" } : { campo, dir: "asc" }));
  }

  function exportarCsv() {
    const blob = new Blob([clientesToCsv(filtrados)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crm-clientes-${hoy}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hayFiltros = Boolean(q || fEtapa || fFuente || fUrgencia);

  return (
    <>
      <CrmMetricas clientes={clientes} />

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap mb-3 fade-up fade-up-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o email…"
          className={`${control} flex-1 min-w-[180px] py-1.5 text-[12px]`}
        />
        <select className={control} value={fEtapa} onChange={(e) => setFEtapa(e.target.value as Etapa | "")}>
          <option value="">Todas las etapas</option>
          {ETAPAS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select className={control} value={fFuente} onChange={(e) => setFFuente(e.target.value as Fuente | "")}>
          <option value="">Todas las fuentes</option>
          {FUENTES.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select className={control} value={fUrgencia} onChange={(e) => setFUrgencia(e.target.value as Urgencia | "")}>
          <option value="">Toda prioridad</option>
          {URGENCIAS.map((u) => <option key={u} value={u}>{URGENCIA_LABEL[u]}</option>)}
        </select>

        <div className="flex items-center gap-2 ml-auto">
          {hayFiltros && (
            <button
              onClick={() => { setQ(""); setFEtapa(""); setFFuente(""); setFUrgencia(""); }}
              className="text-[11px] text-slate-600 hover:text-slate-300 transition-colors"
            >
              limpiar
            </button>
          )}
          <button onClick={exportarCsv} disabled={filtrados.length === 0}
            className="text-[11px] font-medium px-2.5 py-1.5 rounded-md border border-slate-700 text-slate-300 hover:text-slate-100 hover:border-slate-500 disabled:opacity-40 transition-colors whitespace-nowrap">
            ↓ CSV
          </button>
          <button onClick={() => setDrawer({ cliente: null })}
            className="text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-slate-100 text-slate-900 hover:bg-white transition-colors whitespace-nowrap">
            + Nuevo
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 flex items-start justify-between gap-3">
          <p className="text-[12px] text-red-300">{error}</p>
          <button onClick={() => setError(null)} className="text-[11px] text-red-400/70 hover:text-red-200 shrink-0">
            cerrar
          </button>
        </div>
      )}

      <p className="text-[11px] text-slate-600 mb-2 tabular">
        {filtrados.length} de {clientes.length} registros
      </p>

      {filtrados.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-10 text-center">
          <p className="text-[13px] text-slate-400">
            {clientes.length === 0 ? "Todavía no hay clientes cargados." : "Ningún registro coincide con los filtros."}
          </p>
        </div>
      ) : (
        <>
          {/* Escritorio */}
          <div className="hidden md:block rounded-xl border border-slate-800 bg-slate-900/40 overflow-x-auto fade-up fade-up-4">
            <table className="w-full min-w-[880px] text-[12px]">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-widest text-slate-600">
                  <Th campo="apellido" orden={orden} onClick={ordenarPor}>Cliente</Th>
                  <Th campo="etapa" orden={orden} onClick={ordenarPor}>Etapa</Th>
                  <Th campo="fuente" orden={orden} onClick={ordenarPor}>Fuente</Th>
                  <Th campo="ticket_estimado" orden={orden} onClick={ordenarPor} align="right">Ticket</Th>
                  <Th campo="perfil_riesgo" orden={orden} onClick={ordenarPor}>Perfil</Th>
                  <Th campo="fecha_proxima_accion" orden={orden} onClick={ordenarPor}>Próxima acción</Th>
                  <Th campo="ultima_interaccion" orden={orden} onClick={ordenarPor}>Últ. contacto</Th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <Fila key={c.id} c={c} hoy={hoy} guardando={guardandoIds.includes(c.id)}
                    onPatch={patch} onAbrir={() => setDrawer({ cliente: c })} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Celular */}
          <div className="md:hidden space-y-2 fade-up fade-up-4">
            {filtrados.map((c) => (
              <Tarjeta key={c.id} c={c} hoy={hoy} guardando={guardandoIds.includes(c.id)}
                onPatch={patch} onAbrir={() => setDrawer({ cliente: c })} />
            ))}
          </div>
        </>
      )}

      {drawer && (
        <ClienteDrawer
          cliente={drawer.cliente}
          onClose={() => setDrawer(null)}
          onSaved={(c, esNuevo) => {
            setClientes((prev) => (esNuevo ? [c, ...prev] : prev.map((x) => (x.id === c.id ? c : x))));
            setDrawer(null);
          }}
          onDeleted={(id) => {
            setClientes((prev) => prev.filter((c) => c.id !== id));
            setDrawer(null);
          }}
        />
      )}
    </>
  );
}

function valorOrden(c: Cliente, campo: CampoOrden): string | number | null {
  if (campo === "etapa") return ORDEN_ETAPA.get(c.etapa) ?? 99;
  if (campo === "ticket_estimado") return c.ticket_estimado;
  if (campo === "apellido") return `${c.apellido} ${c.nombre}`;
  return c[campo];
}

function Th({ campo, orden, onClick, children, align = "left" }: {
  campo: CampoOrden; orden: Orden; onClick: (c: CampoOrden) => void;
  children: React.ReactNode; align?: "left" | "right";
}) {
  const activo = orden.campo === campo;
  return (
    <th className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        onClick={() => onClick(campo)}
        className={`inline-flex items-center gap-1 uppercase tracking-widest transition-colors ${
          activo ? "text-slate-300" : "hover:text-slate-400"
        }`}
      >
        {children}
        <span className={activo ? "text-slate-500" : "text-transparent"}>
          {activo && orden.dir === "desc" ? "▾" : "▴"}
        </span>
      </button>
    </th>
  );
}

// ── Celdas editables ──────────────────────────────────────────────────────────

function EtapaSelect({ c, onPatch }: { c: Cliente; onPatch: Fila["onPatch"] }) {
  return (
    <select
      value={c.etapa}
      onChange={(e) => onPatch(c.id, { etapa: e.target.value as Etapa })}
      title="Cambiar etapa"
      className={`${BADGE_BASE} ${ETAPA_CLASS[c.etapa]} cursor-pointer appearance-none pr-1.5 focus:outline-none focus:ring-1 focus:ring-slate-600`}
    >
      {ETAPAS.map((e) => (
        <option key={e} value={e} className="bg-slate-900 text-slate-200">{e}</option>
      ))}
    </select>
  );
}

/** Texto + fecha de la próxima acción, editables sin abrir el panel. */
function ProximaAccion({ c, hoy, onPatch }: { c: Cliente; hoy: string; onPatch: Fila["onPatch"] }) {
  const [texto, setTexto] = useState(c.proxima_accion ?? "");
  const urgencia = urgenciaDe(c.fecha_proxima_accion, hoy);

  // Si el registro cambia desde el panel, la celda tiene que reflejarlo
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTexto(c.proxima_accion ?? "");
  }, [c.proxima_accion]);

  function guardarTexto() {
    const limpio = texto.trim();
    if (limpio === (c.proxima_accion ?? "")) return;
    onPatch(c.id, { proxima_accion: limpio || null });
  }

  return (
    <div className="min-w-[210px]">
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={guardarTexto}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        placeholder="—"
        title="Editar próxima acción"
        className="w-full bg-transparent border border-transparent rounded px-1 py-0.5 text-[12px] text-slate-200 placeholder:text-slate-700 hover:border-slate-800 focus:border-slate-600 focus:bg-slate-950/60 focus:outline-none transition-colors"
      />
      <div className="flex items-center gap-1.5 mt-0.5 pl-1">
        <input
          type="date"
          value={c.fecha_proxima_accion ?? ""}
          onChange={(e) => onPatch(c.id, { fecha_proxima_accion: e.target.value || null })}
          title="Editar fecha"
          className="bg-transparent text-[10px] text-slate-500 hover:text-slate-300 focus:outline-none cursor-pointer"
        />
        {c.fecha_proxima_accion && (
          <span className={`${BADGE_BASE} ${URGENCIA_CLASS[urgencia]}`}>
            {diasRelativos(c.fecha_proxima_accion, hoy)}
          </span>
        )}
      </div>
    </div>
  );
}

interface Fila {
  c: Cliente;
  hoy: string;
  guardando: boolean;
  onPatch: (id: number, campos: Partial<ClienteInput>) => void;
  onAbrir: () => void;
}

function Fila({ c, hoy, guardando, onPatch, onAbrir }: Fila) {
  return (
    <tr className={`border-b border-slate-900 last:border-0 hover:bg-slate-900/40 transition-colors ${guardando ? "opacity-60" : ""}`}>
      <td className="px-3 py-2">
        <button onClick={onAbrir} className="text-left group">
          <span className="text-[13px] font-medium text-slate-100 group-hover:text-white">{nombreCompleto(c)}</span>
          <span className="block text-[10px] text-slate-600 truncate max-w-[190px]">
            {c.email ?? c.telefono ?? "sin contacto"}
          </span>
        </button>
      </td>
      <td className="px-3 py-2"><EtapaSelect c={c} onPatch={onPatch} /></td>
      <td className="px-3 py-2 text-slate-400">
        {c.fuente}
        {c.referido_por && <span className="block text-[10px] text-slate-600 truncate max-w-[120px]">{c.referido_por}</span>}
      </td>
      <td className="px-3 py-2 text-right tabular text-slate-200">{formatUSD(c.ticket_estimado)}</td>
      <td className="px-3 py-2 text-slate-500">{c.perfil_riesgo ?? "—"}</td>
      <td className="px-3 py-2"><ProximaAccion c={c} hoy={hoy} onPatch={onPatch} /></td>
      <td className="px-3 py-2 text-slate-500 tabular whitespace-nowrap">
        {c.ultima_interaccion ? diasRelativos(c.ultima_interaccion, hoy) : "—"}
      </td>
      <td className="px-2 py-2">
        <button onClick={onAbrir} title="Abrir ficha"
          className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:text-slate-200 hover:bg-slate-800 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </td>
    </tr>
  );
}

function Tarjeta({ c, hoy, guardando, onPatch, onAbrir }: Fila) {
  return (
    <article className={`rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 ${guardando ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <button onClick={onAbrir} className="text-left min-w-0">
          <p className="text-[14px] font-medium text-slate-100 truncate">{nombreCompleto(c)}</p>
          <p className="text-[11px] text-slate-600 truncate">
            {c.fuente}
            {c.perfil_riesgo && ` · ${c.perfil_riesgo}`}
          </p>
        </button>
        <span className="text-[13px] font-semibold tabular text-slate-200 shrink-0">{formatUSD(c.ticket_estimado)}</span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <EtapaSelect c={c} onPatch={onPatch} />
      </div>

      <div className="mt-2 pt-2 border-t border-slate-900">
        <ProximaAccion c={c} hoy={hoy} onPatch={onPatch} />
      </div>
    </article>
  );
}
