"use client";

import { useState, useTransition } from "react";
import type { ClassMaterial, MaterialKind } from "@/lib/types";
import { buildClaudePrompt } from "@/lib/materials";
import { updateMaterialSummary } from "@/app/actions";

interface Props {
  material: ClassMaterial;
  subjectName: string;
  claudeProjectUrl: string | null;
}

export default function AskClaudeButton({ material, subjectName, claudeProjectUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(() => buildClaudePrompt(material.kind, material.filename, subjectName));
  const [copied, setCopied] = useState(false);

  const handleOpenClaude = async () => {
    // 1. Copy prompt to clipboard
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* ignore */ }

    // 2. Open the file in a new tab so the user can drag it into Claude
    window.open(`/api/materials/${material.id}`, "_blank", "noopener");

    // 3. Open Claude.ai — try project URL first, fallback to /new?q=<prompt>
    const claudeUrl = claudeProjectUrl
      ? claudeProjectUrl
      : `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
    window.open(claudeUrl, "_blank", "noopener");
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Preguntar a Claude sobre este material"
        className="text-[10px] px-1.5 py-0.5 rounded text-slate-500 hover:text-violet-300 hover:bg-violet-950/30 transition-colors flex items-center gap-1"
      >
        ◆ Preguntar
      </button>

      {open && (
        <AskClaudeModal
          filename={material.filename}
          prompt={prompt}
          setPrompt={setPrompt}
          copied={copied}
          claudeProjectUrl={claudeProjectUrl}
          onOpenClaude={handleOpenClaude}
          onClose={() => setOpen(false)}
          materialId={material.id}
          initialSummary={material.summary}
        />
      )}
    </>
  );
}

function AskClaudeModal({
  filename,
  prompt,
  setPrompt,
  copied,
  claudeProjectUrl,
  onOpenClaude,
  onClose,
  materialId,
  initialSummary,
}: {
  filename: string;
  prompt: string;
  setPrompt: (p: string) => void;
  copied: boolean;
  claudeProjectUrl: string | null;
  onOpenClaude: () => void;
  onClose: () => void;
  materialId: number;
  initialSummary: string | null;
}) {
  const [tab, setTab] = useState<"ask" | "save">(initialSummary ? "save" : "ask");
  const [summaryDraft, setSummaryDraft] = useState(initialSummary ?? "");
  const [, startTransition] = useTransition();
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");

  const handleSave = () => {
    setSaved("saving");
    startTransition(async () => {
      await updateMaterialSummary(materialId, summaryDraft);
      setSaved("saved");
      setTimeout(() => onClose(), 800);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl mx-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Preguntar a Claude</p>
            <h3 className="text-[14px] text-slate-100 truncate">{filename}</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-lg leading-none">✕</button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-3 border-b border-slate-800 flex gap-1 shrink-0">
          <TabButton active={tab === "ask"} onClick={() => setTab("ask")}>Generar prompt</TabButton>
          <TabButton active={tab === "save"} onClick={() => setTab("save")}>
            Guardar resumen {initialSummary && <span className="text-emerald-400 ml-1">●</span>}
          </TabButton>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === "ask" ? (
            <>
              <p className="text-[12px] text-slate-400 leading-relaxed mb-3">
                Al hacer click en <span className="text-slate-200 font-medium">Abrir Claude</span> vamos a:
                {" "}1) copiar este prompt al clipboard, 2) abrir el archivo en una pestaña nueva (arrastralo al chat), 3) abrir{" "}
                {claudeProjectUrl ? <span className="text-violet-300">tu proyecto de Claude</span> : <span className="text-violet-300">claude.ai/new</span>}.
              </p>
              <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">Prompt</label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                rows={14}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-[12.5px] text-slate-200 font-mono leading-relaxed outline-none focus:border-slate-500"
              />
              <p className="text-[10px] text-slate-600 mt-2">
                Editalo si querés. La próxima vez vuelve a aparecer la versión por defecto.
              </p>
            </>
          ) : (
            <>
              <p className="text-[12px] text-slate-400 leading-relaxed mb-3">
                Pegá acá la respuesta de Claude para guardarla. Va a aparecer en este material y en la tarjeta de la clase para que la veas a un click.
              </p>
              <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">Resumen</label>
              <textarea
                value={summaryDraft}
                onChange={e => setSummaryDraft(e.target.value)}
                rows={16}
                placeholder="Pegá la respuesta de Claude acá…"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-[12.5px] text-slate-200 leading-relaxed outline-none focus:border-slate-500"
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[10px] text-slate-600">
            {tab === "ask" && copied && <span className="text-emerald-400">✓ prompt copiado al clipboard</span>}
            {tab === "save" && saved === "saved" && <span className="text-emerald-400">✓ guardado</span>}
          </div>
          {tab === "ask" ? (
            <button
              onClick={onOpenClaude}
              className="px-4 py-2 rounded-lg text-[12px] font-medium text-slate-100 bg-violet-700/40 hover:bg-violet-700/60 border border-violet-700/60 transition-colors flex items-center gap-1.5"
            >
              ◆ Abrir Claude + archivo
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saved === "saving"}
              className="px-4 py-2 rounded-lg text-[12px] font-medium text-slate-100 bg-slate-700 hover:bg-slate-600 border border-slate-600 transition-colors disabled:opacity-50"
            >
              {saved === "saving" ? "Guardando…" : "Guardar resumen"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[11px] px-3 py-1.5 rounded-t-md transition-colors ${
        active
          ? "bg-slate-800 text-slate-100 border-t border-x border-slate-700"
          : "text-slate-500 hover:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

export function makeKindPrompt(kind: MaterialKind, filename: string, subject: string): string {
  return buildClaudePrompt(kind, filename, subject);
}
