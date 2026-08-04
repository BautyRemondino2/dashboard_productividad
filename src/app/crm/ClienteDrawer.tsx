"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ETAPAS, FUENTES, PERFILES_RIESGO, nombreCompleto,
  type Cliente, type ClienteInput,
} from "@/lib/crm";

const VACIO: ClienteInput = {
  nombre: "", apellido: "", email: null, telefono: "", fuente: "Otro", referido_por: "",
  etapa: "Prospecto", ticket_estimado: 0, perfil_riesgo: null, productos_interes: "",
  proxima_accion: "", fecha_proxima_accion: null, ultima_interaccion: null, notas: "",
};

const input =
  "w-full bg-slate-950/60 border border-slate-800 rounded-md px-2.5 py-1.5 text-[13px] text-slate-100 " +
  "placeholder:text-slate-600 focus:outline-none focus:border-slate-600 transition-colors";

/**
 * Panel lateral para dar de alta o editar el registro completo. Es el único
 * lugar donde se tocan los campos largos (notas, contacto); lo del día a día
 * —etapa, próxima acción y fecha— se edita directo en la fila.
 */
export default function ClienteDrawer({ cliente, onClose, onSaved, onDeleted }: {
  cliente: Cliente | null;
  onClose: () => void;
  onSaved: (c: Cliente, esNuevo: boolean) => void;
  onDeleted: (id: number) => void;
}) {
  const esNuevo = cliente === null;
  const [form, setForm] = useState<ClienteInput>(() =>
    cliente ? { ...cliente } : { ...VACIO }
  );
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmaBorrado, setConfirmaBorrado] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set<K extends keyof ClienteInput>(campo: K, valor: ClienteInput[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(esNuevo ? "/api/clientes" : `/api/clientes/${cliente.id}`, {
        method: esNuevo ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const cuerpo = await res.json();
      if (!res.ok) {
        setError(cuerpo.errores?.join(" · ") ?? cuerpo.error ?? `Error ${res.status}`);
        return;
      }
      onSaved(cuerpo as Cliente, esNuevo);
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (esNuevo) return;
    setBorrando(true);
    setError(null);
    try {
      const res = await fetch(`/api/clientes/${cliente.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const cuerpo = await res.json().catch(() => ({}));
        setError(cuerpo.error ?? `Error ${res.status}`);
        return;
      }
      onDeleted(cliente.id);
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setBorrando(false);
    }
  }

  // Portal al body: cualquier ancestro con transform (las secciones .fade-up lo
  // dejan aplicado) convertiría el fixed en relativo a ese ancestro.
  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 z-50 w-[460px] max-w-[94vw] bg-slate-900 border-l border-slate-800 flex flex-col">
        <header className="px-5 py-4 border-b border-slate-800 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-slate-600">
              {esNuevo ? "Nuevo registro" : "Editar"}
            </p>
            <h2 className="text-lg font-semibold text-slate-100 truncate">
              {esNuevo ? "Alta de cliente" : nombreCompleto(cliente)}
            </h2>
          </div>
          <button
            onClick={onClose}
            title="Cerrar (Esc)"
            className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <Campo label="Nombre y apellido">
            <div className="grid grid-cols-2 gap-2">
              <input className={input} value={form.nombre} placeholder="Nombre"
                onChange={(e) => set("nombre", e.target.value)} />
              <input className={input} value={form.apellido} placeholder="Apellido"
                onChange={(e) => set("apellido", e.target.value)} />
            </div>
          </Campo>

          <Campo label="Contacto">
            <div className="grid grid-cols-2 gap-2">
              <input className={input} type="email" value={form.email ?? ""} placeholder="Email"
                onChange={(e) => set("email", e.target.value || null)} />
              <input className={input} value={form.telefono ?? ""} placeholder="Teléfono"
                onChange={(e) => set("telefono", e.target.value || null)} />
            </div>
          </Campo>

          <Campo label="Origen">
            <div className="grid grid-cols-2 gap-2">
              <select className={input} value={form.fuente}
                onChange={(e) => set("fuente", e.target.value as ClienteInput["fuente"])}>
                {FUENTES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <input className={input} value={form.referido_por ?? ""} placeholder="Referido por"
                onChange={(e) => set("referido_por", e.target.value || null)} />
            </div>
          </Campo>

          <Campo label="Etapa y ticket">
            <div className="grid grid-cols-2 gap-2">
              <select className={input} value={form.etapa}
                onChange={(e) => set("etapa", e.target.value as ClienteInput["etapa"])}>
                {ETAPAS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-600">US$</span>
                <input className={`${input} pl-9 tabular`} type="number" min={0} step={1000}
                  value={form.ticket_estimado}
                  onChange={(e) => set("ticket_estimado", e.target.value === "" ? 0 : Number(e.target.value))} />
              </div>
            </div>
          </Campo>

          <Campo label="Perfil e intereses">
            <div className="grid grid-cols-2 gap-2">
              <select className={input} value={form.perfil_riesgo ?? ""}
                onChange={(e) => set("perfil_riesgo", (e.target.value || null) as ClienteInput["perfil_riesgo"])}>
                <option value="">Sin definir</option>
                {PERFILES_RIESGO.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input className={input} value={form.productos_interes ?? ""} placeholder="Bonos, FCI, CEDEARs"
                onChange={(e) => set("productos_interes", e.target.value || null)} />
            </div>
          </Campo>

          <Campo label="Próxima acción">
            <div className="space-y-2">
              <input className={input} value={form.proxima_accion ?? ""} placeholder="Qué sigue con este cliente"
                onChange={(e) => set("proxima_accion", e.target.value || null)} />
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[10px] text-slate-600">Fecha próxima acción</span>
                  <input className={input} type="date" value={form.fecha_proxima_accion ?? ""}
                    onChange={(e) => set("fecha_proxima_accion", e.target.value || null)} />
                </label>
                <label className="block">
                  <span className="text-[10px] text-slate-600">Última interacción</span>
                  <input className={input} type="date" value={form.ultima_interaccion ?? ""}
                    onChange={(e) => set("ultima_interaccion", e.target.value || null)} />
                </label>
              </div>
            </div>
          </Campo>

          <Campo label="Notas">
            <textarea className={`${input} resize-none leading-relaxed`} rows={6} value={form.notas ?? ""}
              placeholder="Contexto, objetivos, qué le preocupa…"
              onChange={(e) => set("notas", e.target.value || null)} />
          </Campo>

          {error && (
            <p className="rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2 text-[12px] text-red-300">
              {error}
            </p>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-slate-800 flex items-center justify-between gap-3">
          {esNuevo ? <span /> : confirmaBorrado ? (
            <div className="flex items-center gap-2">
              <button onClick={borrar} disabled={borrando}
                className="text-[11px] font-medium px-2.5 py-1.5 rounded-md border border-red-900/70 text-red-300 hover:bg-red-950/40 disabled:opacity-40 transition-colors">
                {borrando ? "Borrando…" : "Confirmar"}
              </button>
              <button onClick={() => setConfirmaBorrado(false)}
                className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors">
                cancelar
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmaBorrado(true)}
              className="text-[11px] text-slate-600 hover:text-red-300 transition-colors">
              Borrar
            </button>
          )}

          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className="text-[12px] text-slate-400 hover:text-slate-100 px-3 py-1.5 transition-colors">
              Cancelar
            </button>
            <button onClick={guardar} disabled={guardando || !form.nombre.trim() || !form.apellido.trim()}
              className="text-[12px] font-medium px-3 py-1.5 rounded-md bg-slate-100 text-slate-900 hover:bg-white disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors">
              {guardando ? "Guardando…" : esNuevo ? "Crear" : "Guardar"}
            </button>
          </div>
        </footer>
      </aside>
    </>,
    document.body
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-1.5">{label}</p>
      {children}
    </div>
  );
}
