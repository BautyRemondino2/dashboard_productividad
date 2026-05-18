"use client";

import { useState, useRef, useTransition } from "react";
import { importZip } from "@/app/actions";

export default function ImportZipButton({ subjectId }: { subjectId: number }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    ok: boolean;
    classesCreated?: number;
    filesImported?: number;
    filesSkipped?: number;
    message?: string;
  } | null>(null);

  const handleFile = (file: File) => {
    setResult(null);
    const fd = new FormData();
    fd.set("subject_id", String(subjectId));
    fd.set("file", file);
    startTransition(async () => {
      const r = await importZip(fd);
      setResult(r);
      // Clear input so re-uploading the same file works
      if (inputRef.current) inputRef.current.value = "";
      // Auto-dismiss after 6 s
      setTimeout(() => setResult(null), 6000);
    });
  };

  return (
    <div className="flex items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={isPending}
        className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-violet-700/30 hover:bg-violet-700/50 text-violet-100 border border-violet-700/60 transition-colors disabled:opacity-50 flex items-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
        </svg>
        {isPending ? "Importando…" : "Importar zip"}
      </button>

      {result && (
        <div
          className={`text-[11px] px-2.5 py-1.5 rounded-md border ${
            result.ok
              ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
              : "bg-red-950/40 border-red-800/60 text-red-300"
          }`}
        >
          {result.ok ? (
            <>
              ✓ <span className="font-medium">{result.filesImported}</span> archivo
              {(result.filesImported ?? 0) !== 1 ? "s" : ""} importado
              {(result.filesImported ?? 0) !== 1 ? "s" : ""}
              {result.classesCreated ? `, ${result.classesCreated} clase${result.classesCreated !== 1 ? "s" : ""} nueva${result.classesCreated !== 1 ? "s" : ""}` : ""}
              {result.filesSkipped ? ` · ${result.filesSkipped} omitido${result.filesSkipped !== 1 ? "s" : ""}` : ""}
            </>
          ) : (
            <>✗ {result.message ?? "Error"}</>
          )}
        </div>
      )}
    </div>
  );
}
