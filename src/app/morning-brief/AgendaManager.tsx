"use client";

import { useState, useTransition } from "react";
import Card from "@/components/Card";
import { agregarAgendaAction, borrarAgendaAction, editarAgendaAction } from "./actions";
import type { AgendaItem } from "@/lib/morning-brief-db";
import { localDateStr } from "@/lib/utils";

const CAMPO = "text-[12px] rounded-chip border border-outline bg-boton px-2.5 py-1.5 text-cuerpo placeholder:text-meta-suave outline-none focus:border-separador transition-colors";

interface FormAgenda {
  fecha: string;
  hora_art: string;
  evento: string;
  consenso: string;
  anterior: string;
  dato: string;
}

const VACIO: FormAgenda = { fecha: localDateStr(), hora_art: "", evento: "", consenso: "", anterior: "", dato: "" };

function CamposAgenda({
  valor,
  onChange,
}: {
  valor: FormAgenda;
  onChange: (v: FormAgenda) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
      <input type="date" value={valor.fecha} onChange={(e) => onChange({ ...valor, fecha: e.target.value })} className={CAMPO} />
      <input placeholder="hora ART" value={valor.hora_art} onChange={(e) => onChange({ ...valor, hora_art: e.target.value })} className={CAMPO} />
      <input placeholder="evento" value={valor.evento} onChange={(e) => onChange({ ...valor, evento: e.target.value })} className={`${CAMPO} col-span-2 md:col-span-2`} />
      <input placeholder="consenso" value={valor.consenso} onChange={(e) => onChange({ ...valor, consenso: e.target.value })} className={CAMPO} />
      <input placeholder="anterior" value={valor.anterior} onChange={(e) => onChange({ ...valor, anterior: e.target.value })} className={CAMPO} />
      <input placeholder="dato (si ya salió)" value={valor.dato} onChange={(e) => onChange({ ...valor, dato: e.target.value })} className={CAMPO} />
    </div>
  );
}

function FilaAgenda({ item }: { item: AgendaItem }) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<FormAgenda>({
    fecha: item.fecha,
    hora_art: item.hora_art,
    evento: item.evento,
    consenso: item.consenso ?? "",
    anterior: item.anterior ?? "",
    dato: item.dato ?? "",
  });
  const [pendiente, iniciar] = useTransition();

  if (editando) {
    return (
      <div className="px-[18px] py-2.5 space-y-2 bg-boton/40">
        <CamposAgenda valor={form} onChange={setForm} />
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              iniciar(async () => {
                await editarAgendaAction(item.id, form);
                setEditando(false);
              })
            }
            disabled={pendiente}
            className="text-[11px] px-2.5 py-1 rounded-chip border border-outline text-cuerpo hover:text-titulo hover:border-separador transition-colors"
          >
            Guardar
          </button>
          <button onClick={() => setEditando(false)} className="text-[11px] text-meta hover:text-cuerpo transition-colors">
            cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-[18px] py-2.5 flex items-baseline gap-2.5 flex-wrap">
      <span className="text-[11px] text-meta-suave tabular-nums shrink-0">{item.fecha} · {item.hora_art}</span>
      <span className="text-[12.5px] text-titulo font-medium">{item.evento}</span>
      {item.consenso && <span className="text-[11px] text-secundario">consenso {item.consenso}</span>}
      {item.anterior && <span className="text-[11px] text-meta-suave">ant. {item.anterior}</span>}
      {item.dato && <span className="text-[11px] text-sube">dato {item.dato}</span>}
      <span className="ml-auto flex items-center gap-2 shrink-0">
        <button onClick={() => setEditando(true)} className="text-[11px] text-meta hover:text-cuerpo transition-colors">
          editar
        </button>
        <button
          onClick={() => iniciar(() => borrarAgendaAction(item.id))}
          className="text-[11px] text-meta hover:text-red-400 transition-colors"
        >
          borrar
        </button>
      </span>
    </div>
  );
}

/** Agenda cargada a mano: hora ART, evento, consenso, anterior y —cuando ya salió— el dato. */
export default function AgendaManager({ items }: { items: AgendaItem[] }) {
  const [abierta, setAbierta] = useState(false);
  const [form, setForm] = useState<FormAgenda>(VACIO);
  const [pendiente, iniciar] = useTransition();

  return (
    <Card titulo="Agenda" nota="cargada a mano, desde hoy en adelante" cuerpo={false}>
      <div className="divide-y divide-divisor-fino">
        {items.length === 0 && <p className="px-[18px] py-3 text-[12px] text-meta-suave">Sin eventos cargados.</p>}
        {items.map((item) => (
          <FilaAgenda key={item.id} item={item} />
        ))}
      </div>
      <div className="px-[18px] py-3 border-t border-divisor">
        {!abierta ? (
          <button onClick={() => setAbierta(true)} className="text-[11px] text-meta hover:text-cuerpo transition-colors">
            + agregar evento
          </button>
        ) : (
          <div className="space-y-2">
            <CamposAgenda valor={form} onChange={setForm} />
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  iniciar(async () => {
                    await agregarAgendaAction(form);
                    setForm(VACIO);
                    setAbierta(false);
                  })
                }
                disabled={pendiente || !form.evento.trim()}
                className="text-[11px] px-2.5 py-1 rounded-chip border border-outline text-cuerpo hover:text-titulo hover:border-separador disabled:opacity-50 transition-colors"
              >
                Agregar
              </button>
              <button onClick={() => setAbierta(false)} className="text-[11px] text-meta hover:text-cuerpo transition-colors">
                cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
