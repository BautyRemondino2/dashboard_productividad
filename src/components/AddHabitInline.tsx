"use client";

import { useRef, useState, useTransition } from "react";
import { createHabit } from "@/app/actions";

export default function AddHabitInline() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleOpen() {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await createHabit(fd);
      (e.target as HTMLFormElement).reset();
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-400 transition-colors py-1.5 px-3"
      >
        <span className="text-base leading-none">+</span>
        Agregar hábito
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-3 border border-slate-700 rounded-lg px-3 py-2.5 bg-slate-900"
    >
      <input
        ref={inputRef}
        name="name"
        type="text"
        placeholder="Nombre del hábito..."
        required
        disabled={pending}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-600 outline-none"
      />
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-slate-300 hover:text-white font-medium transition-colors"
      >
        Guardar
      </button>
    </form>
  );
}
