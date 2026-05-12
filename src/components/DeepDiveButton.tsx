"use client";

import { useState } from "react";

interface Props {
  subjectName: string;
  summarySnippet: string; // first ~600 chars of the summary
}

export default function DeepDiveButton({ subjectName, summarySnippet }: Props) {
  const [copied, setCopied] = useState(false);

  const prompt = `Quiero profundizar en los temas de la materia "${subjectName}" que cubrimos en esta clase.

Resumen de lo que estudiamos:
${summarySnippet}

Me gustaría que me ayudes a entender más en profundidad los conceptos clave, resolver dudas y ver aplicaciones prácticas. ¿Por dónde empezamos?`;

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Clipboard failed silently — still open the tab
    }
    window.open("https://claude.ai/new", "_blank", "noopener,noreferrer");
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-200 text-sm rounded-lg transition-colors"
    >
      <span className="text-base">✦</span>
      {copied ? "Prompt copiado → pegalo en Claude" : "Profundizar en Claude"}
    </button>
  );
}
