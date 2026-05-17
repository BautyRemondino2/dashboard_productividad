"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { subjectColor, subjectColorSoft } from "@/lib/subjectColors";
import { toggleTask } from "@/app/actions";
import type { Subject, Task, Exam } from "@/lib/types";

interface Props {
  task: Task & { subject_name?: string | null };
  subject: Subject;
  nearestExam: Exam | null;
  today: string;
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) /
      86400000
  );
}

const POMODORO_MINUTES = 25;

export default function FocusWeek({ task, subject, nearestExam, today }: Props) {
  const [, startTransition] = useTransition();
  const [done, setDone] = useState(task.status === "hecha");
  const [timerOpen, setTimerOpen] = useState(false);

  const handleMarkDone = () => {
    if (done) return;
    setDone(true);
    startTransition(async () => {
      await toggleTask(task.id);
    });
  };

  const daysUntilDue = task.due_date ? daysBetween(today, task.due_date) : null;

  return (
    <>
      <div
        className="relative overflow-hidden rounded-xl border border-slate-800 p-5 mb-6 fade-up fade-up-2"
        style={{
          background: `linear-gradient(135deg, ${subjectColorSoft(subject.hue)} 0%, rgba(15,23,42,0.4) 60%)`,
        }}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
          style={{ background: subjectColor(subject.hue, 70) }}
        />

        <div className="flex items-start gap-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: subjectColor(subject.hue, 78) }}
              >
                ◎ Foco de la semana
              </span>
              <span className="text-[10px] text-slate-500">
                · prioridad alta + cercanía de examen
              </span>
            </div>
            <h2
              className={`text-lg font-medium leading-snug mb-2 ${
                done ? "text-slate-500 line-through" : "text-slate-100"
              }`}
            >
              {task.title}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-[11px]">
              <span className="px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300">
                {subject.short}
              </span>
              {task.priority === "alta" && (
                <span className="text-red-400 font-medium">● alta</span>
              )}
              {task.priority === "media" && (
                <span className="text-amber-400 font-medium">● media</span>
              )}
              {task.priority === "baja" && (
                <span className="text-slate-400 font-medium">● baja</span>
              )}
              {daysUntilDue !== null && (
                <span className={daysUntilDue < 0 ? "text-red-400" : "text-slate-500"}>
                  {daysUntilDue < 0
                    ? `vencida hace ${Math.abs(daysUntilDue)}d`
                    : daysUntilDue === 0
                    ? "vence hoy"
                    : `vence en ${daysUntilDue} día${daysUntilDue !== 1 ? "s" : ""}`}
                </span>
              )}
              {nearestExam && (
                <span className="text-slate-500">
                  · {nearestExam.title} en {daysBetween(today, nearestExam.date)} días
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <button
              onClick={() => setTimerOpen(true)}
              className="px-4 py-2 rounded-lg text-[12px] font-medium transition-colors text-slate-100 border hover:brightness-110"
              style={{
                background: subjectColor(subject.hue, 25),
                borderColor: subjectColor(subject.hue, 45),
              }}
            >
              Empezar pomodoro
            </button>
            <button
              onClick={handleMarkDone}
              disabled={done}
              className="px-4 py-2 rounded-lg text-[12px] font-medium bg-slate-800/60 hover:bg-slate-800 text-slate-300 transition-colors border border-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {done ? "✓ Hecha" : "Marcar hecha"}
            </button>
          </div>
        </div>
      </div>

      {timerOpen && (
        <PomodoroModal
          taskTitle={task.title}
          subject={subject}
          onClose={() => setTimerOpen(false)}
          onComplete={handleMarkDone}
        />
      )}
    </>
  );
}

// ─── Pomodoro Modal ─────────────────────────────────────────────────────────

function PomodoroModal({
  taskTitle,
  subject,
  onClose,
  onComplete,
}: {
  taskTitle: string;
  subject: Subject;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(POMODORO_MINUTES * 60);
  const [paused, setPaused] = useState(false);
  const beepedRef = useRef(false);

  const done = secondsLeft <= 0;
  const running = !paused && !done;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Countdown tick
  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft, running]);

  // Play a beep once when the timer finishes
  useEffect(() => {
    if (!done || beepedRef.current) return;
    beepedRef.current = true;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.2, ctx.currentTime);
      o.start();
      o.stop(ctx.currentTime + 0.4);
    } catch { /* ignore */ }
  }, [done]);

  const mins = Math.max(0, Math.floor(secondsLeft / 60));
  const secs = Math.max(0, secondsLeft % 60);

  const total = POMODORO_MINUTES * 60;
  const pct = ((total - secondsLeft) / total) * 100;
  const circ = 2 * Math.PI * 70;
  const dash = (circ * pct) / 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md mx-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-8 text-center">
        <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Pomodoro · {subject.short}</p>
        <h3 className="text-sm text-slate-200 mb-6 line-clamp-2">{taskTitle}</h3>

        <div className="relative w-44 h-44 mx-auto mb-6">
          <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
            <circle cx="80" cy="80" r="70" stroke="rgb(30,41,59)" strokeWidth="6" fill="none" />
            <circle
              cx="80" cy="80" r="70"
              stroke={subjectColor(subject.hue, 70)}
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
              style={{ transition: "stroke-dasharray 0.5s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-4xl font-light tabular text-slate-100 leading-none">
              {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">
              {done ? "completado" : running ? "concentrado" : "pausado"}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2">
          {!done && (
            <button
              onClick={() => setPaused(p => !p)}
              className="px-4 py-2 rounded-lg text-[12px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700"
            >
              {paused ? "Reanudar" : "Pausar"}
            </button>
          )}
          {!done && (
            <button
              onClick={() => { setSecondsLeft(POMODORO_MINUTES * 60); setPaused(false); beepedRef.current = false; }}
              className="px-4 py-2 rounded-lg text-[12px] font-medium bg-slate-800/60 hover:bg-slate-800 text-slate-400 transition-colors border border-slate-700/50"
            >
              Reiniciar
            </button>
          )}
          {done && (
            <button
              onClick={() => { onComplete(); onClose(); }}
              className="px-4 py-2 rounded-lg text-[12px] font-medium text-slate-100 transition-colors border"
              style={{
                background: subjectColor(subject.hue, 30),
                borderColor: subjectColor(subject.hue, 50),
              }}
            >
              ✓ Marcar tarea como hecha
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[12px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
