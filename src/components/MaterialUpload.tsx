"use client";

import { useRef, useState, useTransition, DragEvent } from "react";
import { uploadMaterial } from "@/app/actions";

interface Props {
  subjectId: number;
  today: string;
}

export default function MaterialUpload({ subjectId, today }: Props) {
  const [open, setOpen]       = useState(false);
  const [mode, setMode]       = useState<"pdf" | "text">("pdf");
  const [dragging, setDragging] = useState(false);
  const [file, setFile]       = useState<File | null>(null);
  const [text, setText]       = useState("");
  const [date, setDate]       = useState(today);
  const [error, setError]     = useState("");
  const [pending, startTr]    = useTransition();
  const fileRef               = useRef<HTMLInputElement>(null);
  const formRef               = useRef<HTMLFormElement>(null);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === "application/pdf") {
      setFile(dropped);
      setError("");
    } else {
      setError("Solo se admiten archivos PDF.");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (picked?.type === "application/pdf") {
      setFile(picked);
      setError("");
    } else if (picked) {
      setError("Solo se admiten archivos PDF.");
    }
  }

  function reset() {
    setFile(null);
    setText("");
    setDate(today);
    setError("");
    setMode("pdf");
    setOpen(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "pdf" && !file) { setError("Seleccioná un PDF."); return; }
    if (mode === "text" && !text.trim()) { setError("Pegá el texto de la clase."); return; }

    const fd = new FormData();
    fd.set("subjectId", String(subjectId));
    fd.set("type", mode);
    fd.set("date", date);
    if (mode === "pdf" && file) fd.set("file", file);
    if (mode === "text") fd.set("textContent", text);

    startTr(async () => {
      await uploadMaterial(fd);
      reset();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors py-2"
      >
        <span className="text-base leading-none">+</span> Subir material de clase
      </button>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      {/* Mode toggle */}
      <div className="flex gap-1 mb-4 bg-slate-950 rounded-lg p-1 w-fit">
        {(["pdf", "text"] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError(""); }}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              mode === m
                ? "bg-slate-700 text-slate-100"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {m === "pdf" ? "📄 PDF" : "✏️ Texto"}
          </button>
        ))}
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        {mode === "pdf" ? (
          /* ── Drag & drop zone ── */
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              dragging
                ? "border-blue-500 bg-blue-950/20"
                : file
                ? "border-emerald-600 bg-emerald-950/20"
                : "border-slate-700 hover:border-slate-600"
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
            {file ? (
              <div>
                <p className="text-sm text-emerald-400 font-medium">{file.name}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {(file.size / 1024).toFixed(0)} KB — clic para cambiar
                </p>
              </div>
            ) : (
              <div>
                <p className="text-2xl mb-2">📄</p>
                <p className="text-sm text-slate-400">
                  {dragging ? "Soltá el PDF acá" : "Arrastrá un PDF o hacé clic"}
                </p>
                <p className="text-xs text-slate-600 mt-1">Solo archivos PDF</p>
              </div>
            )}
          </div>
        ) : (
          /* ── Text paste area ── */
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Pegá acá el texto de la clase, notas, transcripción..."
            rows={8}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-500 resize-y"
          />
        )}

        {/* Date */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-500 shrink-0">Fecha de la clase</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-slate-500"
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        {/* Generating notice */}
        {pending && (
          <div className="flex items-center gap-2 text-xs text-blue-400">
            <span className="animate-pulse">●</span>
            Generando resumen con Claude... esto puede tomar un minuto.
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={pending}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            {pending ? "Procesando..." : "Subir y generar resumen"}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={pending}
            className="px-4 py-2 text-slate-500 hover:text-slate-300 text-sm transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
