"use client";

import { useState, useTransition, useRef } from "react";
import { uploadMaterial } from "@/app/actions";

interface Props {
  subjectId: number;
  classId: number | null;
  /** Compact mode renders just a thin "+ archivo" button instead of a full dropzone. */
  compact?: boolean;
}

export default function MaterialDropzone({ subjectId, classId, compact = false }: Props) {
  const [drag, setDrag] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = (files: FileList | File[]) => {
    setError(null);
    const arr = Array.from(files);
    if (arr.length === 0) return;

    startTransition(async () => {
      for (const file of arr) {
        const fd = new FormData();
        fd.set("subject_id", String(subjectId));
        if (classId !== null) fd.set("class_id", String(classId));
        fd.set("file", file);
        const r = await uploadMaterial(fd);
        if (!r) {
          setError(`No se pudo subir ${file.name}`);
          return;
        }
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  if (compact) {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => e.target.files && handleFiles(e.target.files)}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={isPending}
          className="text-[11px] text-slate-500 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800/60 transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          + archivo
        </button>
      </>
    );
  }

  return (
    <div className="space-y-1">
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-lg border border-dashed transition-colors px-3 py-2 cursor-pointer ${
          drag
            ? "border-slate-500 bg-slate-800/60"
            : "border-slate-800 hover:border-slate-700 bg-slate-900/30 hover:bg-slate-900/60"
        }`}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => e.target.files && handleFiles(e.target.files)}
        />
        <p className="text-[11px] text-slate-500">
          {isPending ? (
            <span className="text-slate-400">Subiendo…</span>
          ) : (
            <>
              Arrastrá archivos acá o <span className="text-slate-300 underline">elegilos</span>
            </>
          )}
        </p>
      </div>
      {error && (
        <p className="text-[10px] text-red-400">{error}</p>
      )}
    </div>
  );
}
