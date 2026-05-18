"use client";

import { useState, useTransition } from "react";
import type { ClassMaterial, MaterialKind, ClassItem } from "@/lib/types";
import {
  MATERIAL_KIND_LABEL,
  MATERIAL_KIND_STYLE,
  formatBytes,
} from "@/lib/materials";
import {
  deleteMaterial,
  assignMaterialToClass,
  updateMaterialKind,
  summarizeMaterial,
} from "@/app/actions";

interface Props {
  material: ClassMaterial;
  classes: ClassItem[];
}

const KIND_OPTIONS: MaterialKind[] = ["slide", "ejercicio", "excel", "lectura", "notas", "imagen", "otro"];

export default function MaterialItem({ material, classes }: Props) {
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<"none" | "summarize" | "delete">("none");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localSummary, setLocalSummary] = useState<string | null>(material.summary);

  const handleSummarize = () => {
    setBusy("summarize");
    setError(null);
    startTransition(async () => {
      const r = await summarizeMaterial(material.id);
      setBusy("none");
      if (r.ok && r.summary) {
        setLocalSummary(r.summary);
        setSummaryOpen(true);
      } else {
        setError(r.message ?? "Error al resumir");
      }
    });
  };

  const handleDelete = () => {
    if (!confirm(`¿Eliminar "${material.filename}"? No se puede deshacer.`)) return;
    setBusy("delete");
    startTransition(async () => {
      await deleteMaterial(material.id);
    });
  };

  const handleKindChange = (k: MaterialKind) => {
    startTransition(async () => {
      await updateMaterialKind(material.id, k);
    });
  };

  const handleAssign = (classId: number | null) => {
    setPickerOpen(false);
    startTransition(async () => {
      await assignMaterialToClass(material.id, classId);
    });
  };

  return (
    <div className="group flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800/40 transition-colors">
      {/* Kind chip (clickable to change) */}
      <KindSelector kind={material.kind} onChange={handleKindChange} />

      {/* Filename + size */}
      <div className="min-w-0 flex-1">
        <a
          href={`/api/materials/${material.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12.5px] text-slate-200 hover:text-white hover:underline truncate block"
          title={material.filename}
        >
          {material.filename}
        </a>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-600 tabular">
          <span>{formatBytes(material.size_bytes)}</span>
          {localSummary && (
            <button
              onClick={() => setSummaryOpen(true)}
              className="text-emerald-400/80 hover:text-emerald-300 underline decoration-dotted"
            >
              · ver resumen
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {!localSummary && ["pdf", "txt", "md"].includes(material.filename.toLowerCase().split(".").pop() ?? "") && (
          <button
            onClick={handleSummarize}
            disabled={busy !== "none"}
            title="Resumir con IA"
            className="text-[10px] px-1.5 py-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {busy === "summarize" ? "…" : "Resumir"}
          </button>
        )}
        <button
          onClick={() => setPickerOpen(o => !o)}
          title="Cambiar de clase"
          className="text-[10px] px-1.5 py-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          Mover
        </button>
        <button
          onClick={handleDelete}
          disabled={busy !== "none"}
          title="Eliminar"
          className="text-[10px] px-1.5 py-0.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-950/30 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Class picker dropdown */}
      {pickerOpen && (
        <ClassPicker classes={classes} currentClassId={material.class_id} onPick={handleAssign} onClose={() => setPickerOpen(false)} />
      )}

      {error && (
        <span className="absolute right-2 top-2 text-[10px] text-red-400">{error}</span>
      )}

      {/* Summary modal */}
      {summaryOpen && localSummary && (
        <SummaryModal
          filename={material.filename}
          summary={localSummary}
          onClose={() => setSummaryOpen(false)}
        />
      )}
    </div>
  );
}

function KindSelector({ kind, onChange }: { kind: MaterialKind; onChange: (k: MaterialKind) => void }) {
  const [open, setOpen] = useState(false);
  const baseStyle = MATERIAL_KIND_STYLE[kind];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded border tabular uppercase tracking-wider transition-colors ${baseStyle} hover:brightness-125`}
        title="Cambiar tipo"
      >
        {MATERIAL_KIND_LABEL[kind]}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-1 min-w-[120px]">
            {KIND_OPTIONS.map(k => (
              <button
                key={k}
                onClick={() => { onChange(k); setOpen(false); }}
                className={`block w-full text-left text-[11px] px-2 py-1 rounded transition-colors ${
                  k === kind ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                {MATERIAL_KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ClassPicker({
  classes,
  currentClassId,
  onPick,
  onClose,
}: {
  classes: ClassItem[];
  currentClassId: number | null;
  onPick: (id: number | null) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-12 top-8 z-50 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-1 min-w-[200px] max-h-[280px] overflow-y-auto">
        <button
          onClick={() => onPick(null)}
          className={`block w-full text-left text-[11px] px-2 py-1.5 rounded transition-colors ${
            currentClassId === null ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          📥 Inbox (sin asignar)
        </button>
        <div className="my-1 h-px bg-slate-800" />
        {classes.length === 0 ? (
          <p className="text-[11px] text-slate-600 italic px-2 py-1">Sin clases todavía</p>
        ) : (
          classes.map(c => (
            <button
              key={c.id}
              onClick={() => onPick(c.id)}
              className={`block w-full text-left text-[11px] px-2 py-1.5 rounded transition-colors ${
                currentClassId === c.id ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <span className="tabular text-slate-500 mr-2">S{c.week}</span>
              <span className="truncate">{c.title || "(sin título)"}</span>
            </button>
          ))
        )}
      </div>
    </>
  );
}

function SummaryModal({
  filename,
  summary,
  onClose,
}: {
  filename: string;
  summary: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl mx-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-800 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Resumen IA</p>
            <h3 className="text-[14px] text-slate-100 truncate">{filename}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="prose prose-invert prose-sm max-w-none text-[13px] text-slate-200 leading-relaxed whitespace-pre-wrap">
            {summary}
          </div>
        </div>
      </div>
    </div>
  );
}
