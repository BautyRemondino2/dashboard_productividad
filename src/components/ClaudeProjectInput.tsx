"use client";

import { useState, useTransition } from "react";
import { setSubjectClaudeProject } from "@/app/actions";

interface Props {
  subjectId: number;
  currentUrl: string | null;
}

export default function ClaudeProjectInput({ subjectId, currentUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(currentUrl ?? "");
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = (next: string | null) => {
    setError(null);
    startTransition(async () => {
      const r = await setSubjectClaudeProject(subjectId, next);
      if (r.ok) {
        setSaved(true);
        setTimeout(() => { setSaved(false); setOpen(false); }, 900);
      } else {
        setError(r.message ?? "Error");
      }
    });
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[11px] text-slate-500 hover:text-violet-300 transition-colors flex items-center gap-1.5"
        title={currentUrl ? "Proyecto Claude conectado" : "Conectá un Proyecto de Claude.ai"}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${currentUrl ? "bg-violet-400" : "bg-slate-700"}`} />
        {currentUrl ? "Proyecto Claude" : "Conectar proyecto Claude"}
      </button>
    );
  }

  return (
    <div className="absolute left-0 mt-2 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 w-[380px] max-w-[calc(100vw-2rem)]">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-[12px] font-medium text-slate-100">Proyecto de Claude.ai</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Si conectás un Proyecto, &ldquo;Preguntar a Claude&rdquo; abre ese chat (con tu knowledge base). Si no, abre claude.ai/new.
          </p>
        </div>
        <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-200 text-sm leading-none shrink-0">✕</button>
      </div>
      <input
        type="text"
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="https://claude.ai/project/..."
        className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-[12px] text-slate-200 placeholder-slate-600 outline-none focus:border-slate-500 font-mono"
      />
      {error && <p className="text-[10px] text-red-400 mt-1.5">{error}</p>}
      {saved && <p className="text-[10px] text-emerald-400 mt-1.5">✓ guardado</p>}
      <div className="flex justify-between items-center mt-3">
        {currentUrl ? (
          <button
            onClick={() => { setUrl(""); save(null); }}
            className="text-[11px] text-red-400/80 hover:text-red-300 transition-colors"
          >
            Desconectar
          </button>
        ) : <span />}
        <button
          onClick={() => save(url || null)}
          className="text-[11px] font-medium px-3 py-1 rounded-md text-slate-100 bg-violet-700/40 hover:bg-violet-700/60 border border-violet-700/60 transition-colors"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}
