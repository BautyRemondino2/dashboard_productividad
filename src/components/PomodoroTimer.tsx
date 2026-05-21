"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { getActiveSubjects, logStudySession } from "@/app/actions";

const WORK_MINUTES  = 25;
const BREAK_MINUTES = 5;

type Mode = "work" | "break";
type SubjectOption = { id: number; name: string; short: string; hue: number };

function pad(n: number) {
  return String(n).padStart(2, "0");
}

const RADIUS = 36;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const STORAGE_KEY = "pomodoro-subject-id";

export default function PomodoroTimer() {
  const pathname = usePathname();
  const [mode,      setMode]      = useState<Mode>("work");
  const [running,   setRunning]   = useState(false);
  const [seconds,   setSeconds]   = useState(WORK_MINUTES * 60);
  const [cycles,    setCycles]    = useState(0);
  const [open,      setOpen]      = useState(false);
  const [subjects,  setSubjects]  = useState<SubjectOption[]>([]);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [lastLog,   setLastLog]   = useState<{ subjectName: string; minutes: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSeconds = (mode === "work" ? WORK_MINUTES : BREAK_MINUTES) * 60;
  const progress     = seconds / totalSeconds;
  const strokeDash   = CIRCUMFERENCE * progress;

  // Load subjects when first opened
  useEffect(() => {
    if (open && subjects.length === 0) {
      getActiveSubjects().then(list => {
        setSubjects(list);
        // Restore last picked subject
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          const n = stored ? parseInt(stored, 10) : NaN;
          if (Number.isFinite(n) && list.find(s => s.id === n)) {
            setSubjectId(n);
          } else if (list.length > 0) {
            setSubjectId(list[0].id);
          }
        } catch {
          if (list.length > 0) setSubjectId(list[0].id);
        }
      });
    }
  }, [open, subjects.length]);

  useEffect(() => {
    if (subjectId !== null) {
      try { localStorage.setItem(STORAGE_KEY, String(subjectId)); } catch { /* ignore */ }
    }
  }, [subjectId]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    stop();
    setSeconds(totalSeconds);
  }, [stop, totalSeconds]);

  const switchMode = useCallback((next: Mode) => {
    stop();
    setMode(next);
    setSeconds((next === "work" ? WORK_MINUTES : BREAK_MINUTES) * 60);
  }, [stop]);

  // Log a completed work cycle
  const logCompletedCycle = useCallback((minutes: number) => {
    if (!subjectId || minutes <= 0) return;
    const subj = subjects.find(s => s.id === subjectId);
    logStudySession(subjectId, minutes).then(() => {
      if (subj) setLastLog({ subjectName: subj.short, minutes });
      // Auto-dismiss the toast after 4s
      setTimeout(() => setLastLog(null), 4000);
    });
  }, [subjectId, subjects]);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          // Session done — log work cycle then switch mode
          const next: Mode = mode === "work" ? "break" : "work";
          if (mode === "work") {
            setCycles(c => c + 1);
            logCompletedCycle(WORK_MINUTES);
          }
          switchMode(next);
          return (next === "work" ? WORK_MINUTES : BREAK_MINUTES) * 60;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, mode, switchMode, logCompletedCycle]);

  // "Save now" — log partial cycle (rounding to minute)
  const saveNow = useCallback(() => {
    if (mode !== "work") return;
    const elapsed = WORK_MINUTES * 60 - seconds;
    const minutes = Math.round(elapsed / 60);
    if (minutes >= 1) logCompletedCycle(minutes);
    reset();
  }, [mode, seconds, logCompletedCycle, reset]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const selectedSubject = subjects.find(s => s.id === subjectId);

  // Hidden on print-only routes
  if (pathname.startsWith("/print/")) return null;

  if (!open) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className={`fixed bottom-6 right-6 z-40 px-3 h-10 rounded-full bg-slate-800 border flex items-center gap-2 hover:bg-slate-700 transition-colors shadow-lg text-[12px] ${
            running ? "border-emerald-700 text-emerald-300" : "border-slate-700 text-slate-400 hover:text-slate-200"
          }`}
          title={running ? "Pomodoro corriendo" : "Pomodoro"}
        >
          {running ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="tabular font-mono">{pad(mins)}:{pad(secs)}</span>
              {selectedSubject && <span className="text-slate-400 text-[10px]">· {selectedSubject.short}</span>}
            </>
          ) : (
            <>⏱<span>Pomodoro</span></>
          )}
        </button>
        {lastLog && (
          <div className="fixed bottom-20 right-6 z-40 bg-emerald-950/90 border border-emerald-800 rounded-lg px-3 py-2 text-[12px] text-emerald-300 shadow-xl flex items-center gap-2 animate-pulse">
            ✓ <span><b>{lastLog.minutes} min</b> guardados en {lastLog.subjectName}</span>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 w-72 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          <button
            onClick={() => switchMode("work")}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${mode === "work" ? "bg-slate-700 text-slate-200" : "text-slate-600 hover:text-slate-400"}`}
          >
            Trabajo
          </button>
          <button
            onClick={() => switchMode("break")}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${mode === "break" ? "bg-slate-700 text-slate-200" : "text-slate-600 hover:text-slate-400"}`}
          >
            Descanso
          </button>
        </div>
        <button
          onClick={() => { stop(); setOpen(false); }}
          className="text-slate-700 hover:text-slate-400 text-xs leading-none"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>

      {/* Subject picker (only for work mode) */}
      {mode === "work" && (
        <div className="mb-3">
          <label className="block text-[9px] uppercase tracking-widest text-slate-600 mb-1">Materia</label>
          {subjects.length === 0 ? (
            <p className="text-[11px] text-slate-600 italic">Sin materias en el semestre activo</p>
          ) : (
            <select
              value={subjectId ?? ""}
              onChange={e => setSubjectId(parseInt(e.target.value, 10))}
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-2 py-1.5 text-[12px] text-slate-200 outline-none focus:border-slate-600"
            >
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* SVG ring + time */}
      <div className="flex flex-col items-center gap-4 mb-3">
        <div className="relative w-24 h-24">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
            <circle cx="44" cy="44" r={RADIUS} strokeWidth="4" stroke="#1e293b" fill="none" />
            <circle
              cx="44" cy="44" r={RADIUS}
              strokeWidth="4"
              stroke={mode === "work" ? "#8b5cf6" : "#10b981"}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${strokeDash} ${CIRCUMFERENCE}`}
              style={{ transition: running ? "stroke-dasharray 1s linear" : "none" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-semibold tabular text-slate-100">
              {pad(mins)}:{pad(secs)}
            </span>
            {cycles > 0 && (
              <span className="text-[9px] text-slate-600 mt-0.5">{cycles} ciclo{cycles !== 1 ? "s" : ""} hoy</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            className="w-8 h-8 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-500 hover:text-slate-300 text-xs transition-colors flex items-center justify-center"
            title="Reiniciar"
          >
            ↺
          </button>
          <button
            onClick={() => setRunning(r => !r)}
            disabled={mode === "work" && !subjectId}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              running
                ? "bg-slate-700 hover:bg-slate-600 text-slate-200"
                : "bg-violet-600 hover:bg-violet-500 text-white"
            }`}
          >
            {running ? "Pausar" : "Iniciar"}
          </button>
        </div>
      </div>

      {/* Save now */}
      {mode === "work" && (WORK_MINUTES * 60 - seconds) >= 60 && (
        <button
          onClick={saveNow}
          className="w-full text-[10px] text-slate-500 hover:text-emerald-400 transition-colors py-1 border-t border-slate-800"
        >
          Guardar {Math.round((WORK_MINUTES * 60 - seconds) / 60)} min y reiniciar
        </button>
      )}
    </div>
  );
}
