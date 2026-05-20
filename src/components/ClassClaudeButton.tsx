"use client";

import { useState, useTransition, useMemo } from "react";
import type { ClassMaterial, ClassItem } from "@/lib/types";
import { MATERIAL_KIND_LABEL } from "@/lib/materials";
import { updateClassSummary } from "@/app/actions";

interface Props {
  classItem: ClassItem;
  materials: ClassMaterial[];
  subjectName: string;
  claudeProjectUrl: string | null;
  previousClassTitle: string | null;
  /** If true, button is rendered as an icon-only "edit" button (used in the summary footer). */
  variant?: "primary" | "ghost";
  label?: string;
  initialTab?: "ask" | "save";
}

type Template = "resumen" | "comparar" | "parcial" | "custom";

const TEMPLATES: { id: Template; label: string; description: string }[] = [
  { id: "resumen",  label: "Resumen estándar",       description: "TL;DR + conceptos + fórmulas + checklist examen" },
  { id: "comparar", label: "Comparar con anterior",  description: "Diferencias y continuidad respecto a la clase previa" },
  { id: "parcial",  label: "Preguntas tipo parcial", description: "10 preguntas con dificultad creciente" },
  { id: "custom",   label: "Custom",                  description: "Escribís el prompt vos" },
];

function buildPrompt(
  tpl: Template,
  classItem: ClassItem,
  materials: ClassMaterial[],
  subjectName: string,
  previousClassTitle: string | null,
): string {
  const fileList = materials.length === 0
    ? "(esta clase no tiene archivos cargados — usá lo que sepas)"
    : materials.map(m => `- ${MATERIAL_KIND_LABEL[m.kind]}: ${m.filename}`).join("\n");

  const header = `Materia: ${subjectName}
Clase ${classItem.week}: ${classItem.title}

Archivos de la clase (te los voy a soltar acá al lado):
${fileList}
`;

  switch (tpl) {
    case "resumen":
      return `${header}
Hacé un **resumen unificado** de toda la clase tomando los archivos en conjunto. Estructura:

**TL;DR** (1-2 oraciones que capturen la idea central)
**Conceptos clave** (5-8 bullets — escribir los términos centrales en **negrita** para que pueda chiparlos)
**Fórmulas / expresiones importantes** (en LaTeX inline)
**Aplicaciones / ejemplos numéricos** (2-3 casos concretos)
**Checklist para el examen** (5 ítems puntuales con lo que tengo que dominar)

Sé conciso pero específico — citá modelos, fórmulas exactas, nombres concretos. No agregues intros ni cierres genéricos.`;

    case "comparar":
      return `${header}
${previousClassTitle ? `Clase anterior: ${previousClassTitle}\n` : ""}
Compará este material con la clase anterior. Estructura:

**Continuidad** (qué conceptos retoma y profundiza)
**Diferencias / novedades** (qué se introduce nuevo)
**Cómo se conectan** (puente conceptual entre ambas)
**Riesgos de confusión** (3 puntos donde es fácil mezclar las dos clases en un parcial)

Citá nombres y conceptos exactos, sin generalidades.`;

    case "parcial":
      return `${header}
Armame **10 preguntas tipo parcial** sobre el material de esta clase, con dificultad creciente:

1-3: Conceptuales (definiciones, identificar conceptos)
4-6: Aplicación (resolver caso simple, identificar el modelo correcto)
7-9: Análisis (comparar dos enfoques, justificar elección, derivar fórmula)
10: Integradora (problema con múltiples conceptos)

Por cada pregunta:
- Enunciado
- Respuesta esperada (2-4 oraciones)
- Dificultad estimada (★ a ★★★★★)

Sé exigente — quiero prepararme bien.`;

    case "custom":
      return `${header}
[Escribí tu pregunta acá]`;
  }
}

export default function ClassClaudeButton({
  classItem,
  materials,
  subjectName,
  claudeProjectUrl,
  previousClassTitle,
  variant = "primary",
  label,
  initialTab,
}: Props) {
  const [open, setOpen] = useState(false);
  const [tpl, setTpl] = useState<Template>("resumen");
  const [prompt, setPrompt] = useState(() => buildPrompt("resumen", classItem, materials, subjectName, previousClassTitle));
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"ask" | "save">(initialTab ?? (classItem.summary ? "save" : "ask"));
  const [summaryDraft, setSummaryDraft] = useState(classItem.summary ?? "");
  const [, startTransition] = useTransition();
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");

  const switchTemplate = (t: Template) => {
    setTpl(t);
    setPrompt(buildPrompt(t, classItem, materials, subjectName, previousClassTitle));
  };

  const handleOpenClaude = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* ignore */ }

    // Open each material in a tab so the user can drag them all into the chat
    for (const m of materials) {
      window.open(`/api/materials/${m.id}`, "_blank", "noopener");
    }
    const url = claudeProjectUrl
      ? claudeProjectUrl
      : `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
    window.open(url, "_blank", "noopener");
  };

  const handleSave = () => {
    setSaved("saving");
    startTransition(async () => {
      await updateClassSummary(classItem.id, summaryDraft);
      setSaved("saved");
      setTimeout(() => { setOpen(false); setSaved("idle"); }, 700);
    });
  };

  const buttonClasses = useMemo(() => {
    if (variant === "ghost") {
      return "px-2.5 py-1 rounded text-[11px] text-slate-500 hover:text-slate-200 hover:bg-slate-900 transition-colors";
    }
    return "px-4 py-2 rounded-lg bg-slate-100 hover:bg-white text-slate-900 text-[13px] font-medium transition-colors inline-flex items-center gap-2";
  }, [variant]);

  return (
    <>
      <button onClick={() => setOpen(true)} className={buttonClasses}>
        {variant === "primary" && (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l1.8 4.7L18 8l-4.2 1.3L12 14l-1.8-4.7L6 8l4.2-1.3L12 2z" />
          </svg>
        )}
        {label ?? (variant === "ghost" ? "Editar resumen" : "Resumir clase con Claude")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-3xl mx-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">Clase {classItem.week} · {subjectName}</p>
                <h3 className="text-[15px] text-slate-100 truncate">{classItem.title}</h3>
                <p className="text-[10px] text-slate-600 mt-0.5">
                  {materials.length} archivo{materials.length !== 1 ? "s" : ""} se van a abrir en pestañas
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-200 text-lg leading-none">✕</button>
            </div>

            {/* Tabs */}
            <div className="px-6 pt-3 border-b border-slate-800 flex gap-1 shrink-0">
              <TabButton active={tab === "ask"} onClick={() => setTab("ask")}>
                Generar prompt
              </TabButton>
              <TabButton active={tab === "save"} onClick={() => setTab("save")}>
                Guardar resumen
                {classItem.summary && <span className="text-emerald-400 ml-1">●</span>}
              </TabButton>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {tab === "ask" ? (
                <>
                  <p className="text-[12px] text-slate-400 mb-3">
                    Al hacer click en <span className="text-slate-200 font-medium">Abrir Claude + archivos</span>:
                    {" "}copio el prompt al clipboard, abro los {materials.length} archivos en pestañas y abro{" "}
                    {claudeProjectUrl ? <span className="text-violet-300">tu proyecto Claude</span> : <span className="text-violet-300">claude.ai/new</span>}.
                  </p>

                  {/* Template selector */}
                  <div className="mb-4">
                    <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-2">Template</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {TEMPLATES.map(t => (
                        <button
                          key={t.id}
                          onClick={() => switchTemplate(t.id)}
                          className={`text-left p-2.5 rounded-lg border transition-colors ${
                            tpl === t.id
                              ? "bg-slate-800 border-slate-600 text-slate-100"
                              : "border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                          }`}
                        >
                          <p className="text-[12px] font-medium">{t.label}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{t.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">Prompt</label>
                  <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    rows={14}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-[12px] text-slate-200 font-mono leading-relaxed outline-none focus:border-slate-500"
                  />
                </>
              ) : (
                <>
                  <p className="text-[12px] text-slate-400 leading-relaxed mb-3">
                    Pegá acá la respuesta de Claude. Va a aparecer en la pestaña <span className="text-slate-200">Resumen</span> de esta clase
                    {classItem.summary && " (reemplaza el resumen actual)"}.
                  </p>
                  <p className="text-[10px] text-slate-600 mb-2">
                    Tip: si Claude pone los conceptos clave en <code className="px-1 rounded bg-slate-800 text-slate-300">**negrita**</code>, van a aparecer como chips clickeables.
                  </p>
                  <textarea
                    value={summaryDraft}
                    onChange={e => setSummaryDraft(e.target.value)}
                    rows={18}
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
                  onClick={handleOpenClaude}
                  className="px-4 py-2 rounded-lg text-[12px] font-medium text-slate-100 bg-violet-700/40 hover:bg-violet-700/60 border border-violet-700/60 transition-colors flex items-center gap-1.5"
                >
                  ◆ Abrir Claude + archivos
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  {classItem.summary && (
                    <button
                      onClick={() => { setSummaryDraft(""); }}
                      className="text-[11px] text-slate-500 hover:text-red-400 transition-colors"
                    >
                      Vaciar
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saved === "saving"}
                    className="px-4 py-2 rounded-lg text-[12px] font-medium text-slate-100 bg-slate-700 hover:bg-slate-600 border border-slate-600 transition-colors disabled:opacity-50"
                  >
                    {saved === "saving" ? "Guardando…" : "Guardar resumen"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-[11px] px-3 py-1.5 rounded-t-md transition-colors ${
        active ? "bg-slate-800 text-slate-100 border-t border-x border-slate-700" : "text-slate-500 hover:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}
