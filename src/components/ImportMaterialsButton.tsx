"use client";

import { useState, useRef, useTransition } from "react";
import { importZip, importFolder } from "@/app/actions";

interface Props { subjectId: number }

interface Result {
  ok: boolean;
  classesCreated?: number;
  filesImported?: number;
  filesSkipped?: number;
  message?: string;
}

export default function ImportMaterialsButton({ subjectId }: Props) {
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const zipInputRef    = useRef<HTMLInputElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const handleZip = (file: File) => {
    setResult(null);
    setProgress(`Procesando ${file.name}…`);
    const fd = new FormData();
    fd.set("subject_id", String(subjectId));
    fd.set("file", file);
    startTransition(async () => {
      const r = await importZip(fd);
      setResult(r);
      setProgress(null);
      if (zipInputRef.current) zipInputRef.current.value = "";
      setTimeout(() => setResult(null), 8000);
    });
  };

  const handleFolder = (files: FileList) => {
    setResult(null);
    if (files.length === 0) return;
    setProgress(`Subiendo ${files.length} archivos…`);

    const fd = new FormData();
    fd.set("subject_id", String(subjectId));
    let kept = 0;
    for (const f of Array.from(files)) {
      // Skip hidden files and macOS metadata noise here too (faster than server)
      const rel = f.webkitRelativePath || f.name;
      if (!rel) continue;
      if (rel.split("/").some(p => p.startsWith("."))) continue;
      if (rel.includes("__MACOSX/")) continue;
      // Re-create File with relative path as the name so the server can read it
      const named = new File([f], rel, { type: f.type, lastModified: f.lastModified });
      fd.append("files", named);
      kept++;
    }
    if (kept === 0) {
      setProgress(null);
      setResult({ ok: false, message: "La carpeta no tiene archivos válidos" });
      return;
    }

    startTransition(async () => {
      const r = await importFolder(fd);
      setResult(r);
      setProgress(null);
      if (folderInputRef.current) folderInputRef.current.value = "";
      setTimeout(() => setResult(null), 10000);
    });
  };

  return (
    <div className="flex items-center gap-2">
      {/* Folder input (primary) */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error — webkitdirectory + directory are browser-only attrs not in React types
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={e => e.target.files && handleFolder(e.target.files)}
      />
      <button
        onClick={() => folderInputRef.current?.click()}
        disabled={isPending}
        className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-violet-700/30 hover:bg-violet-700/50 text-violet-100 border border-violet-700/60 transition-colors disabled:opacity-50 flex items-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
        </svg>
        {isPending ? "Importando…" : "Importar carpeta"}
      </button>

      {/* Zip input (secondary) */}
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleZip(f);
        }}
      />
      <button
        onClick={() => zipInputRef.current?.click()}
        disabled={isPending}
        className="text-[11px] text-slate-500 hover:text-slate-200 transition-colors disabled:opacity-50"
        title="También podés subir un .zip"
      >
        · zip
      </button>

      {progress && (
        <span className="text-[11px] text-slate-400 ml-1 flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border border-slate-700 border-t-slate-400 animate-spin shrink-0" />
          {progress}
        </span>
      )}

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
