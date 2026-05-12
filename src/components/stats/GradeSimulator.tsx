"use client";

import { useState } from "react";
import type { GradeSimSubject, ExamType } from "@/lib/types";

const TYPE_LABEL: Record<ExamType, string> = {
  parcial: "Parcial", final: "Final", tp: "TP", quiz: "Quiz", otro: "Otro",
};

interface Props {
  subjects: GradeSimSubject[];
}

export default function GradeSimulator({ subjects }: Props) {
  const [selectedId, setSelectedId] = useState<number>(subjects[0]?.id ?? 0);
  const [target, setTarget]         = useState<string>("7");

  const subject = subjects.find(s => s.id === selectedId);
  const targetNum = parseFloat(target.replace(",", "."));

  let result: { required: number; possible: boolean; already: boolean } | null = null;

  if (subject && !isNaN(targetNum) && targetNum >= 0 && targetNum <= 10) {
    const graded    = subject.exams.filter(e => e.grade !== null);
    const ungraded  = subject.exams.filter(e => e.grade === null);
    const totalW    = subject.exams.reduce((s, e) => s + e.weight, 0);
    const gradedSum = graded.reduce((s, e) => s + (e.grade! * e.weight), 0);
    const ungradedW = ungraded.reduce((s, e) => s + e.weight, 0);

    if (ungradedW === 0) {
      // All graded — show current average
      const current = totalW > 0 ? gradedSum / totalW : 0;
      result = { required: current, possible: true, already: true };
    } else {
      const required = (targetNum * totalW - gradedSum) / ungradedW;
      result = { required, possible: required <= 10, already: false };
    }
  }

  if (subjects.length === 0) {
    return (
      <div className="text-sm text-slate-600 py-6 text-center">
        No hay materias con exámenes cargados.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[160px]">
          <label className="text-xs text-slate-500 block mb-1">Materia</label>
          <select
            value={selectedId}
            onChange={e => setSelectedId(Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-slate-500"
          >
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="w-28">
          <label className="text-xs text-slate-500 block mb-1">Promedio objetivo</label>
          <input
            type="text"
            value={target}
            onChange={e => setTarget(e.target.value)}
            placeholder="7.0"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-slate-500 tabular-nums"
          />
        </div>
      </div>

      {/* Exam breakdown */}
      {subject && (
        <>
          <div className="space-y-1.5">
            {subject.exams.length === 0 && (
              <p className="text-xs text-slate-600">Sin evaluaciones registradas para esta materia.</p>
            )}
            {subject.exams.map(ex => (
              <div key={ex.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/50">
                <span className="text-[10px] text-slate-500 w-12 shrink-0">
                  {TYPE_LABEL[ex.type]}
                </span>
                <span className="flex-1 text-sm text-slate-300 truncate">{ex.title}</span>
                <span className="text-xs text-slate-600 tabular-nums shrink-0">
                  peso {ex.weight}
                </span>
                {ex.grade !== null ? (
                  <span className={`text-sm font-semibold tabular-nums shrink-0 w-8 text-right ${
                    ex.grade >= 7 ? "text-emerald-400" : ex.grade >= 4 ? "text-amber-400" : "text-red-400"
                  }`}>
                    {ex.grade.toFixed(1)}
                  </span>
                ) : (
                  <span className="text-xs text-slate-700 tabular-nums shrink-0 w-8 text-right italic">
                    —
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Result */}
          {result && (
            <div className={`rounded-xl border px-5 py-4 ${
              result.already
                ? result.required >= targetNum
                  ? "border-emerald-800 bg-emerald-950/30"
                  : "border-amber-800 bg-amber-950/20"
                : result.possible
                  ? result.required <= 6
                    ? "border-emerald-800 bg-emerald-950/30"
                    : result.required <= 8
                      ? "border-amber-800 bg-amber-950/20"
                      : "border-red-800 bg-red-950/20"
                  : "border-red-800 bg-red-950/30"
            }`}>
              {result.already ? (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Promedio actual (todas las notas ingresadas)</p>
                  <p className={`text-3xl font-black tabular-nums ${
                    result.required >= targetNum ? "text-emerald-400" : "text-amber-400"
                  }`}>
                    {result.required.toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {result.required >= targetNum
                      ? `✓ Superás el objetivo de ${targetNum}`
                      : `✗ Por debajo del objetivo de ${targetNum}`}
                  </p>
                </div>
              ) : result.possible ? (
                <div>
                  <p className="text-xs text-slate-500 mb-1">
                    Nota mínima en los {subject.exams.filter(e => e.grade === null).length} exámen{subject.exams.filter(e => e.grade === null).length !== 1 ? "es" : ""} restante{subject.exams.filter(e => e.grade === null).length !== 1 ? "s" : ""}
                  </p>
                  <p className={`text-3xl font-black tabular-nums ${
                    result.required <= 6 ? "text-emerald-400"
                    : result.required <= 8 ? "text-amber-400"
                    : "text-red-400"
                  }`}>
                    {result.required.toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    para llegar a {targetNum} de promedio
                    {result.required > 9 && " — muy ajustado, pero posible"}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-red-400 font-medium mb-1">Objetivo imposible</p>
                  <p className="text-xs text-slate-500">
                    Ni sacando 10 en todos los exámenes restantes llegás a {targetNum} de promedio.
                    Cambiá el objetivo o revisá los pesos.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
