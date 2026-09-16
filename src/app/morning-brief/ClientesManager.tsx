"use client";

import { useState, useTransition } from "react";
import Card from "@/components/Card";
import { borrarClienteAction, guardarClienteAction, toggleClienteAction } from "./actions";
import type { ClienteBrief } from "@/lib/morning-brief-db";
import type { EventoCliente, TenenciaCliente } from "@/lib/morning-brief-tipos";

const CAMPO =
  "text-[12px] rounded-chip border border-outline bg-boton px-2.5 py-1.5 text-cuerpo placeholder:text-meta-suave outline-none focus:border-separador transition-colors";

interface FormCliente {
  alias: string;
  perfil: string;
  tenencias: TenenciaCliente[];
  eventos: EventoCliente[];
}

const VACIO: FormCliente = { alias: "", perfil: "", tenencias: [], eventos: [] };

function ListaEditable<T extends { [K in keyof T]: string }>({
  items,
  campos,
  onChange,
  agregarLabel,
}: {
  items: T[];
  campos: { clave: keyof T; placeholder: string }[];
  onChange: (items: T[]) => void;
  agregarLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          {campos.map((c) => (
            <input
              key={String(c.clave)}
              value={item[c.clave]}
              placeholder={c.placeholder}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...next[i], [c.clave]: e.target.value };
                onChange(next);
              }}
              className={`${CAMPO} flex-1 min-w-0`}
            />
          ))}
          <button
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="text-[11px] text-meta hover:text-red-400 transition-colors shrink-0"
          >
            ×
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, Object.fromEntries(campos.map((c) => [c.clave, ""])) as T])}
        className="text-[11px] text-meta hover:text-cuerpo transition-colors"
      >
        + {agregarLabel}
      </button>
    </div>
  );
}

function FormularioCliente({
  inicial,
  aliasFijo,
  onGuardado,
  onCancelar,
}: {
  inicial: FormCliente;
  aliasFijo: boolean;
  onGuardado: () => void;
  onCancelar?: () => void;
}) {
  const [form, setForm] = useState<FormCliente>(inicial);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await guardarClienteAction(form);
      if (!r.ok) {
        setError(r.error ?? "No se pudo guardar");
        return;
      }
      onGuardado();
    });
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <input
          placeholder="alias (nunca el nombre real)"
          value={form.alias}
          disabled={aliasFijo}
          onChange={(e) => setForm({ ...form, alias: e.target.value })}
          className={`${CAMPO} flex-1 disabled:opacity-60`}
        />
      </div>
      <textarea
        placeholder="perfil: cómo invierte, qué tolera, qué le importa"
        value={form.perfil}
        onChange={(e) => setForm({ ...form, perfil: e.target.value })}
        rows={2}
        className={`${CAMPO} w-full resize-y leading-relaxed`}
      />
      <div>
        <p className="text-[10.5px] uppercase tracking-[0.1em] text-tenue mb-1">Tenencias</p>
        <ListaEditable
          items={form.tenencias}
          campos={[
            { clave: "ticker", placeholder: "ticker" },
            { clave: "descripcion", placeholder: "descripción" },
          ]}
          onChange={(tenencias) => setForm({ ...form, tenencias })}
          agregarLabel="tenencia"
        />
      </div>
      <div>
        <p className="text-[10.5px] uppercase tracking-[0.1em] text-tenue mb-1">Eventos próximos</p>
        <ListaEditable
          items={form.eventos}
          campos={[
            { clave: "fecha", placeholder: "fecha" },
            { clave: "descripcion", placeholder: "vencimiento, cupón…" },
          ]}
          onChange={(eventos) => setForm({ ...form, eventos })}
          agregarLabel="evento"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={guardar}
          disabled={pendiente || !form.alias.trim()}
          className="text-[11px] px-2.5 py-1 rounded-chip border border-outline text-cuerpo hover:text-titulo hover:border-separador disabled:opacity-50 transition-colors"
        >
          Guardar
        </button>
        {onCancelar && (
          <button onClick={onCancelar} className="text-[11px] text-meta hover:text-cuerpo transition-colors">
            cancelar
          </button>
        )}
        {error && <span className="text-[11px] text-red-400">{error}</span>}
      </div>
    </div>
  );
}

function FilaCliente({ cliente }: { cliente: ClienteBrief }) {
  const [editando, setEditando] = useState(false);
  const [pendiente, iniciar] = useTransition();

  if (editando) {
    return (
      <div className="px-[18px] py-3 bg-boton/40">
        <FormularioCliente
          inicial={{ alias: cliente.alias, perfil: cliente.perfil, tenencias: cliente.tenencias, eventos: cliente.eventos }}
          aliasFijo
          onGuardado={() => setEditando(false)}
          onCancelar={() => setEditando(false)}
        />
      </div>
    );
  }

  return (
    <div className={`px-[18px] py-2.5 flex items-baseline gap-2.5 flex-wrap ${cliente.activo ? "" : "opacity-45"}`}>
      <span className="text-[12.5px] text-titulo font-medium">{cliente.alias}</span>
      <span className="text-[11px] text-secundario">
        {cliente.tenencias.length} {cliente.tenencias.length === 1 ? "tenencia" : "tenencias"} ·{" "}
        {cliente.eventos.length} {cliente.eventos.length === 1 ? "evento" : "eventos"}
      </span>
      <span className="ml-auto flex items-center gap-2 shrink-0">
        <button
          onClick={() => setEditando(true)}
          disabled={pendiente}
          className="text-[11px] text-meta hover:text-cuerpo transition-colors disabled:opacity-40"
        >
          editar
        </button>
        <button
          onClick={() => iniciar(() => toggleClienteAction(cliente.id, !cliente.activo))}
          disabled={pendiente}
          className="text-[11px] text-meta hover:text-cuerpo transition-colors disabled:opacity-40"
        >
          {cliente.activo ? "desactivar" : "activar"}
        </button>
        <button
          onClick={() => iniciar(() => borrarClienteAction(cliente.id))}
          disabled={pendiente}
          className="text-[11px] text-meta hover:text-red-400 transition-colors disabled:opacity-40"
        >
          borrar
        </button>
      </span>
    </div>
  );
}

/** Clientes por alias — nunca nombres reales. Sólo los activos entran al snapshot. */
export default function ClientesManager({ clientes }: { clientes: ClienteBrief[] }) {
  const [abierta, setAbierta] = useState(false);

  return (
    <Card titulo="Clientes" nota="por alias — sólo los activos entran al brief" cuerpo={false}>
      <div className="divide-y divide-divisor-fino">
        {clientes.length === 0 && <p className="px-[18px] py-3 text-[12px] text-meta-suave">Sin clientes cargados.</p>}
        {clientes.map((c) => (
          <FilaCliente key={c.id} cliente={c} />
        ))}
      </div>
      <div className="px-[18px] py-3 border-t border-divisor">
        {!abierta ? (
          <button onClick={() => setAbierta(true)} className="text-[11px] text-meta hover:text-cuerpo transition-colors">
            + agregar cliente
          </button>
        ) : (
          <FormularioCliente
            inicial={VACIO}
            aliasFijo={false}
            onGuardado={() => setAbierta(false)}
            onCancelar={() => setAbierta(false)}
          />
        )}
      </div>
    </Card>
  );
}
