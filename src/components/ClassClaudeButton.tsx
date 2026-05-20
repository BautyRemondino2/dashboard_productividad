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
Necesito un **resumen académico riguroso** de esta clase, estilo apunte de cátedra universitario (similar a un resumen LaTeX de UdeSA). No es un resumen ejecutivo — es un documento de estudio exhaustivo.

# Formato de salida (estricto)

Usá **Markdown extendido** con esta sintaxis exacta:

- Headings jerárquicos: \`## Sección\` y \`### Subsección\`
- Cajas semánticas (cada una en su propia línea, abre y cierra con \`:::\`):

\`\`\`
::: definicion
Texto formal y preciso de la definición. Negrita en **el término definido**.
:::

::: nota
Observación práctica, contexto, conexión con otra clase, intuición.
:::

::: warning
Errores típicos, puntos donde es fácil confundirse en un parcial.
:::

::: ejemplo
Caso concreto con números o derivación paso a paso.
:::

::: teorema
Enunciado formal de un teorema o resultado importante.
:::

::: codigo Stata
arima y, arima(1,0,1)
:::
\`\`\`

- Fórmulas inline: \`$y = \\rho x + \\epsilon$\`
- Fórmulas display (centradas, en su propia línea):
\`\`\`
$$
y_t = c + \\sum_{i=1}^{p} \\rho_i \\, y_{t-i} + \\epsilon_t
$$
\`\`\`
- Tablas markdown estándar (con pipes \`|\`)
- Bloques de código con fence triple y lenguaje
- Listas anidadas con bullets o números

# Estructura obligatoria

## Tabla de contenidos
Lista numerada de las secciones que vas a desarrollar (yo después la auto-genero, pero ponela vos también).

## Sección 1 — [Primer concepto principal]
Desarrollá con definiciones formales en cajas \`::: definicion\`, fórmulas en display, ejemplos numéricos en \`::: ejemplo\`, advertencias en \`::: warning\`, y notas de conexión en \`::: nota\`. Profundizá.

## Sección 2 — [Segundo concepto principal]
Igual.

(Cuantas secciones haga falta — no abrevies por brevedad. Mejor exhaustivo.)

## Tabla resumen
Tabla markdown final con dos columnas: \`Concepto\` y \`Definición / Propiedad clave\`. Una fila por término importante.

## Checklist para el examen
5-7 ítems puntuales con lo que tengo que dominar de esta clase.

# Reglas estrictas

- **Negrita en TODOS los términos clave** — van a chiparse automáticamente al final del documento.
- **Fórmulas siempre en LaTeX** con \`\\dfrac\`, \`\\sum\`, \`\\int\`, subíndices, etc. No escribas "y_t = c + ..." en texto plano.
- **Citá literatura** cuando aplique (autor + año entre paréntesis).
- **Nada de preámbulos ni cierres genéricos** — entrá directo al contenido.
- **Tono académico**, no conversacional.
- Si hay derivaciones o demostraciones en los archivos, **reproducilas paso a paso** en cajas \`::: ejemplo\`.
- Si hay comandos de Stata/Python/R/Excel, va en \`::: codigo <lenguaje>\` o en \`\`\`<lenguaje>.
- **No abrevies por miedo a ser largo** — un buen resumen tiene 8-15 secciones cuando la clase es densa.`;

    case "comparar":
      return `${header}
${previousClassTitle ? `Clase anterior: ${previousClassTitle}\n` : ""}
Compará este material con la clase anterior — formato académico riguroso, mismo estilo que un resumen de cátedra UdeSA.

# Formato

Usá Markdown extendido con headings \`##\`, cajas semánticas \`::: tipo ... :::\` (definicion / nota / warning / ejemplo / teorema), fórmulas LaTeX en \`$...$\` y \`$$...$$\`, tablas markdown.

# Estructura

## Continuidad
Qué conceptos de la clase anterior **se retoman y profundizan**. Una caja \`::: definicion\` por cada concepto importante; \`::: nota\` con la conexión específica.

## Novedades
Conceptos **nuevos** que se introducen. Mismo formato — definiciones formales y ejemplos.

## Puente conceptual
Cómo encaja la lógica de las dos clases en un mismo marco mayor. Si hay una fórmula que generaliza, mostrala en \`$$...$$\`.

## Errores típicos
Caja \`::: warning\` por cada confusión común entre los dos materiales.

## Tabla comparativa
Markdown table con tres columnas: \`Aspecto\`, \`Clase anterior\`, \`Esta clase\`.

# Reglas

Negrita en términos clave. Fórmulas siempre en LaTeX. Citá conceptos exactos, no generalidades. Tono académico, no conversacional.`;

    case "parcial":
      return `${header}
Armame **10 preguntas tipo parcial** sobre esta clase, con dificultad creciente. Formato académico estilo UdeSA.

# Formato

Markdown extendido. Para cada pregunta usá esta estructura:

\`\`\`
## Pregunta N · [Dificultad ★/★★/★★★/★★★★/★★★★★]

**Enunciado:** texto del problema con fórmulas en LaTeX \`$...$\` si corresponde.

::: definicion
Respuesta esperada — 2-4 oraciones. Incluí fórmulas, derivaciones, valores numéricos.
:::

::: nota
Pista para reconocer este tipo de problema en el parcial real (qué señales lo identifican).
:::
\`\`\`

# Distribución de dificultad

- Preguntas 1-3 (★): Conceptuales — definiciones, identificar conceptos
- Preguntas 4-6 (★★): Aplicación — resolver caso simple, elegir el modelo correcto
- Preguntas 7-9 (★★★): Análisis — comparar enfoques, justificar elección, derivar fórmula
- Pregunta 10 (★★★★/★★★★★): Integradora — problema con múltiples conceptos

# Reglas

Sé **exigente** — quiero prepararme bien. Fórmulas siempre en LaTeX. Si la respuesta involucra una derivación, mostrala paso a paso. Citá los archivos cuando hagas referencia ("en la slide X de Y").`;

    case "custom":
      return `${header}
[Escribí tu pregunta acá]

---

**Si querés que la respuesta tenga formato académico (compatible con el renderer del dashboard), pedile a Claude que use:**

- Headings: \`## Sección\` / \`### Subsección\`
- Cajas semánticas: \`::: definicion\` / \`::: nota\` / \`::: warning\` / \`::: ejemplo\` / \`::: teorema\` / \`::: codigo <lang>\`
- Fórmulas LaTeX: \`$x^2$\` inline, \`$$y = x^2$$\` display
- Tablas markdown
- Negrita en términos clave (se chipean automáticamente)`;
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
