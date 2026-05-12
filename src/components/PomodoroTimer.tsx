"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const WORK_MINUTES  = 25;
const BREAK_MINUTES = 5;

type Mode = "work" | "break";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

const RADIUS = 36;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function PomodoroTimer() {
  const [mode,      setMode]      = useState<Mode>("work");
  const [running,   setRunning]   = useState(false);
  const [seconds,   setSeconds]   = useState(WORK_MINUTES * 60);
  const [cycles,    setCycles]    = useState(0);
  const [open,      setOpen]      = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSeconds = (mode === "work" ? WORK_MINUTES : BREAK_MINUTES) * 60;
  const progress     = seconds / totalSeconds;
  const strokeDash   = CIRCUMFERENCE * progress;

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

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          // Session done — switch mode
          const next: Mode = mode === "work" ? "break" : "work";
          if (mode === "work") setCycles(c => c + 1);
          switchMode(next);
          return (next === "work" ? WORK_MINUTES : BREAK_MINUTES) * 60;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, mode, switchMode]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-10 h-10 rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors shadow-lg"
        title="Pomodoro"
      >
        ⏱
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 w-52 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
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

      {/* SVG ring + time */}
      <div className="flex flex-col items-center gap-4 mb-4">
        <div className="relative w-24 h-24">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
            {/* Track */}
            <circle
              cx="44" cy="44" r={RADIUS}
              strokeWidth="4"
              stroke="#1e293b"
              fill="none"
            />
            {/* Progress */}
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
            <span className="text-xl font-semibold tabular-nums text-slate-100">
              {pad(mins)}:{pad(secs)}
            </span>
            {cycles > 0 && (
              <span className="text-[9px] text-slate-600 mt-0.5">{cycles} ciclo{cycles !== 1 ? "s" : ""}</span>
            )}
          </div>
        </div>

        {/* Controls */}
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
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              running
                ? "bg-slate-700 hover:bg-slate-600 text-slate-200"
                : "bg-violet-600 hover:bg-violet-500 text-white"
            }`}
          >
            {running ? "Pausar" : "Iniciar"}
          </button>
        </div>
      </div>
    </div>
  );
}
