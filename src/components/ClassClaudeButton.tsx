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
    ? "(esta clase no tiene archivos cargados — basate solo en el título)"
    : materials.map(m => `- ${MATERIAL_KIND_LABEL[m.kind]}: ${m.filename}`).join("\n");

  // Format syntax cheatsheet — shared across templates, deliberately content-neutral.
  // Placeholders like [...] are descriptions, not real examples, so the model doesn't
  // copy them or get biased toward a particular discipline.
  const SYNTAX = `# Formato de salida (Markdown extendido)

Vas a escribir el resumen usando exactamente esta sintaxis — un renderer custom la entiende y la muestra bonita.

**Headings jerárquicos:**
\`## Sección principal\`
\`### Subsección\`

**Cajas semánticas** (abren y cierran con \`:::\` en su propia línea, opcional título después del tipo):

\`\`\`
::: definicion [Término opcional]
[Definición formal y precisa del concepto. Pon en **negrita** el término que se define.]
:::

::: nota
[Observación práctica, intuición, conexión con otro tema visto previamente.]
:::

::: warning
[Error típico, punto donde es fácil confundirse, advertencia importante.]
:::

::: ejemplo [Título opcional del ejemplo]
[Caso concreto con números, valores específicos o derivación paso a paso.]
:::

::: teorema
[Enunciado formal de un teorema, propiedad o resultado importante.]
:::

::: codigo [lenguaje]
[Bloque de código relevante para la disciplina — si aplica.]
:::
\`\`\`

**Fórmulas matemáticas** (siempre en LaTeX, NUNCA en texto plano):
- Inline: \`$ [expresión] $\`
- Display (centrada, en su propia línea):
\`\`\`
$$
[expresión más larga]
$$
\`\`\`

**Tablas** en Markdown estándar (pipes \`|\` y separador \`|---|---|\`).

**Listas** numeradas (\`1.\`) o con bullets (\`-\`), pueden anidarse.

**Inline:** \`**negrita**\`, \`*itálica*\`, \`\\\`código inline\\\`\`.`;

  const HARD_RULES = `# Reglas estrictas

- **El contenido sale 100% de los archivos adjuntos.** No inventes temas, modelos, autores o ejemplos que no estén en los materiales que te pasé. Si un archivo no contiene cierto detalle, no lo agregues — limitate a lo que está.
- **Materia: ${subjectName}.** Si la clase trata de un tema X, el resumen es sobre X. No mezcles con otras materias ni asumas contenido típico de un curso "tipo X".
- **Negrita en TODOS los términos clave** — el renderer los va a chipear automáticamente como conceptos al final del documento.
- **Fórmulas SIEMPRE en LaTeX.** Si los archivos tienen ecuaciones, transcribilas con \`\\dfrac\`, \`\\sum\`, \`\\int\`, subíndices con \`_\`, superíndices con \`^\`, griegas con \`\\alpha\`, etc. Nunca escribas "y = a*x + b" en texto plano.
- **Tono académico**, no conversacional. Nada de "espero que te sirva", "¡importantísimo!", emojis, ni preámbulos.
- **Empezá directo con el contenido** (la primera línea es un \`##\`).
- **Citá la fuente cuando puedas:** "(slide 12)", "(Cap. 4 — autor)", etc.
- Si hay **derivaciones o demostraciones** en los archivos, reproducílas paso a paso en \`::: ejemplo\`.
- Si hay **código** (Stata, Python, R, Excel, etc.) en los archivos, transcribílo en \`::: codigo <lenguaje>\`.
- **Sin abreviar.** Apuntá a un resumen de ~10 páginas A4 cuando se imprima — entre 10 y 18 secciones \`##\` cuando la clase es densa, varias subsecciones \`###\`, múltiples cajas por sección. Mejor exhaustivo que escueto.`;

  const header = `Materia: ${subjectName}
Clase ${classItem.week}: ${classItem.title}

Archivos adjuntos (te los voy a soltar al chat):
${fileList}
`;

  switch (tpl) {
    case "resumen":
      return `${header}
Quiero un **resumen académico exhaustivo de aproximadamente 10 páginas** de esta clase de **${subjectName}**, escrito como apunte de cátedra universitario.

${SYNTAX}

# Estructura obligatoria del documento

1. \`## Tabla de contenidos\` — lista numerada de las secciones que vas a desarrollar (el renderer la auto-genera también, pero ponela vos como referencia).

2. **Una sección \`##\` por cada tema/concepto principal** que aparezca en los archivos. Por cada sección:
   - Una o más \`::: definicion\` con los términos formales
   - Fórmulas en display \`$$...$$\` cuando corresponda
   - \`::: ejemplo\` con casos concretos del material
   - \`::: nota\` para conexiones, intuiciones, contexto histórico
   - \`::: warning\` para errores típicos o sutilezas
   - \`::: codigo <lenguaje>\` si hay snippets en los archivos
   - Tablas comparativas cuando ayuden a contrastar

3. \`## Tabla resumen\` — al final, tabla markdown con dos columnas (\`Concepto\` / \`Definición / Propiedad clave\`), una fila por término importante de toda la clase.

4. \`## Checklist para el examen\` — 5-8 bullets puntuales con lo que hay que dominar.

${HARD_RULES}`;

    case "comparar":
      return `${header}
${previousClassTitle ? `Clase anterior (semana ${classItem.week - 1}): **${previousClassTitle}**\n` : "(No tengo título de clase anterior — basate en lo que infieras de los archivos sobre qué se vio antes.)\n"}
Compará el material de esta clase con el de la anterior. Materia: **${subjectName}**.

${SYNTAX}

# Estructura obligatoria

1. \`## Continuidad\` — qué conceptos de la clase anterior se **retoman y profundizan**. Una \`::: definicion\` por concepto retomado + \`::: nota\` con la conexión específica.

2. \`## Novedades\` — qué se introduce **nuevo**. Definiciones formales + ejemplos.

3. \`## Puente conceptual\` — cómo encajan las dos clases en un marco mayor. Si hay una fórmula que generaliza, mostrala en \`$$...$$\`.

4. \`## Errores típicos al mezclar las dos\` — \`::: warning\` por cada confusión común.

5. \`## Tabla comparativa\` — markdown con tres columnas (\`Aspecto\` | \`Clase anterior\` | \`Esta clase\`).

${HARD_RULES}`;

    case "parcial":
      return `${header}
Armame **10 preguntas tipo parcial** sobre el material de esta clase. Materia: **${subjectName}**.

${SYNTAX}

# Estructura

Para cada pregunta usá esta plantilla:

\`\`\`
## Pregunta N · ★★★

**Enunciado:** [texto del problema con fórmulas LaTeX si corresponde]

::: definicion
[Respuesta esperada — 2-4 oraciones. Incluí fórmulas, derivaciones, valores numéricos.]
:::

::: nota
[Pista para reconocer este tipo de problema en el parcial real — qué señales lo identifican.]
:::
\`\`\`

# Distribución de dificultad (en este orden)

- **Preguntas 1-3 (★):** Conceptuales — definiciones, identificar conceptos del material.
- **Preguntas 4-6 (★★):** Aplicación — resolver caso simple, elegir el modelo correcto.
- **Preguntas 7-9 (★★★ / ★★★★):** Análisis — comparar enfoques, justificar elección, derivar fórmula.
- **Pregunta 10 (★★★★★):** Integradora — problema con múltiples conceptos de la clase.

${HARD_RULES}

Sé **exigente** — quiero prepararme bien.`;

    case "custom":
      return `${header}
[Escribí tu pregunta acá]

---

**Para que la respuesta se rendere bonita en el dashboard, pedile a Claude que use esta sintaxis:**

- Headings: \`## Sección\` / \`### Subsección\`
- Cajas semánticas: \`::: definicion\` / \`::: nota\` / \`::: warning\` / \`::: ejemplo\` / \`::: teorema\` / \`::: codigo <lang>\`
- Fórmulas LaTeX: \`$x^2$\` inline, \`$$y = x^2$$\` display
- Tablas markdown
- Negrita en términos clave (se chipean automáticamente)

**Recordá:** el contenido es de **${subjectName}** — los archivos que adjunto son la única fuente.`;
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
    // 1. Copy prompt to clipboard (fallback in case ?q= doesn't fill the input)
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 3500);
    } catch { /* ignore */ }

    // 2. Trigger zip download — single zip with every file of the class
    if (materials.length > 0) {
      const a = document.createElement("a");
      a.href = `/api/classes/${classItem.id}/bundle.zip`;
      a.rel = "noopener";
      // The Content-Disposition on the route sets the actual filename
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    // 3. Open Claude — project URL if connected, else /new with prompt pre-filled
    const url = claudeProjectUrl
      ? `${claudeProjectUrl}${claudeProjectUrl.includes("?") ? "&" : "?"}q=${encodeURIComponent(prompt)}`
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
                  {materials.length} archivo{materials.length !== 1 ? "s" : ""} se empaquetan en un solo .zip
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
                  <div className="text-[12px] text-slate-400 mb-3 leading-relaxed">
                    <p className="mb-2">Click en <span className="text-slate-200 font-medium">Abrir Claude + zip</span> y pasan 3 cosas:</p>
                    <ol className="list-decimal pl-5 space-y-0.5 text-[11.5px]">
                      <li>Te bajo <span className="text-slate-200">un solo zip</span> con los {materials.length} archivo{materials.length !== 1 ? "s" : ""} de la clase</li>
                      <li>Abro {claudeProjectUrl ? <span className="text-violet-300">tu Proyecto de Claude</span> : <span className="text-violet-300">claude.ai/new</span>}</li>
                      <li>El prompt queda en el clipboard <span className="text-slate-300">(Cmd+V)</span></li>
                    </ol>
                    {claudeProjectUrl ? (
                      <div className="mt-2.5 px-2.5 py-1.5 rounded-md bg-amber-950/30 border border-amber-900/50 text-amber-300/90 text-[11px] leading-snug">
                        ⚠ Los Proyectos de Claude <span className="font-semibold">no auto-rellenan</span> el input desde la URL. Cuando se abra, click en el input y <span className="font-mono bg-amber-950/60 px-1 rounded">Cmd+V</span> para pegar el prompt.
                      </div>
                    ) : (
                      <p className="mt-2 text-slate-500 text-[11px]">
                        En <code className="text-slate-300">claude.ai/new</code> el prompt aparece solo. Después arrastrás el zip al chat y Enter.
                      </p>
                    )}
                    <p className="mt-2 text-slate-500 text-[11px]">
                      <span className="text-slate-400">Cuando Claude termine</span> → volvé acá, tab <span className="text-slate-300">&ldquo;Guardar resumen&rdquo;</span>, Cmd+V, guardar.
                    </p>
                  </div>

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
                  ◆ Abrir Claude + zip
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
