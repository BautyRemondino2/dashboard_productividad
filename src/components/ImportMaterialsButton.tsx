"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { importZip, importFolder, importLocalFolder } from "@/app/actions";

interface Props { subjectId: number }

interface Result {
  ok: boolean;
  classesCreated?: number;
  filesImported?: number;
  filesSkipped?: number;
  message?: string;
  samplePaths?: string[];
}

// ─── FileSystemEntry helpers (cross-browser folder traversal via drag-drop) ──

interface FSEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (cb: (f: File) => void, err?: (e: unknown) => void) => void;
  createReader?: () => FSDirReader;
}
interface FSDirReader {
  readEntries: (cb: (entries: FSEntry[]) => void, err?: (e: unknown) => void) => void;
}

async function walkEntry(entry: FSEntry, parentPath: string): Promise<{ path: string; file: File }[]> {
  const here = parentPath ? `${parentPath}/${entry.name}` : entry.name;
  if (entry.isFile && entry.file) {
    const f = await new Promise<File>((resolve, reject) => entry.file!(resolve, reject));
    return [{ path: here, file: f }];
  }
  if (entry.isDirectory && entry.createReader) {
    const reader = entry.createReader();
    const collected: { path: string; file: File }[] = [];
    while (true) {
      const batch = await new Promise<FSEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
      if (batch.length === 0) break;
      for (const e of batch) collected.push(...await walkEntry(e, here));
    }
    return collected;
  }
  return [];
}

async function filesFromDataTransfer(items: DataTransferItemList): Promise<{ path: string; file: File }[]> {
  const out: { path: string; file: File }[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const entry = (item as unknown as { webkitGetAsEntry?: () => FSEntry | null }).webkitGetAsEntry?.();
    if (entry) out.push(...await walkEntry(entry, ""));
    else {
      const f = item.getAsFile();
      if (f) out.push({ path: f.name, file: f });
    }
  }
  return out;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImportMaterialsButton({ subjectId }: Props) {
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const zipInputRef    = useRef<HTMLInputElement | null>(null);
  const pathInputRef   = useRef<HTMLInputElement | null>(null);
  const [, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [showFallbacks, setShowFallbacks] = useState(false);
  const [drag, setDrag] = useState(false);
  const [pathDraft, setPathDraft] = useState("");

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "");
      folderInputRef.current.setAttribute("directory", "");
    }
  }, []);

  const showResult = (r: Result, ms = 10000) => {
    setResult(r);
    if (ms > 0) setTimeout(() => setResult(null), ms);
  };

  // ── Primary path: server reads folder from disk ──
  const handleLocalPath = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      showResult({ ok: false, message: "Pegá la ruta absoluta de la carpeta" }, 5000);
      return;
    }
    setResult(null);
    setProgress("Leyendo carpeta del disco…");
    startTransition(async () => {
      const r = await importLocalFolder(subjectId, trimmed);
      setProgress(null);
      showResult(r);
      if (r.ok) setPathDraft("");
    });
  };

  // ── Fallback 1: drag-and-drop ──
  const uploadFiles = (files: { path: string; file: File }[]) => {
    if (files.length === 0) { showResult({ ok: false, message: "Sin archivos válidos" }); return; }
    setResult(null);
    setProgress(`Subiendo ${files.length} archivos…`);
    const fd = new FormData();
    fd.set("subject_id", String(subjectId));
    let kept = 0;
    for (const { path: rel, file } of files) {
      if (!rel) continue;
      if (rel.split("/").some(p => p.startsWith("."))) continue;
      if (rel.includes("__MACOSX/")) continue;
      const named = new File([file], rel, { type: file.type, lastModified: file.lastModified });
      fd.append("files", named);
      kept++;
    }
    if (kept === 0) { setProgress(null); showResult({ ok: false, message: "Sin archivos válidos" }); return; }
    startTransition(async () => {
      const r = await importFolder(fd);
      setProgress(null);
      showResult(r);
      if (folderInputRef.current) folderInputRef.current.value = "";
    });
  };

  const handleZip = (file: File) => {
    setResult(null);
    setProgress(`Procesando ${file.name}…`);
    const fd = new FormData();
    fd.set("subject_id", String(subjectId));
    fd.set("file", file);
    startTransition(async () => {
      const r = await importZip(fd);
      setProgress(null);
      showResult(r);
      if (zipInputRef.current) zipInputRef.current.value = "";
    });
  };

  const handleFolderInput = (files: FileList) => {
    const list = Array.from(files).map(f => ({ path: f.webkitRelativePath || f.name, file: f }));
    if (!list.some(item => item.path.includes("/"))) {
      showResult({ ok: false, message: "Tu navegador no preservó la estructura. Usá el input de ruta de arriba." });
      return;
    }
    uploadFiles(list);
  };

  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDrag(false);
    if (!e.dataTransfer) return;
    setProgress("Leyendo carpeta…");
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      try {
        const walked = await filesFromDataTransfer(e.dataTransfer.items);
        uploadFiles(walked);
        return;
      } catch (err) {
        setProgress(null);
        showResult({ ok: false, message: `Error: ${err instanceof Error ? err.message : String(err)}` });
        return;
      }
    }
    if (e.dataTransfer.files?.length) {
      uploadFiles(Array.from(e.dataTransfer.files).map(f => ({ path: f.name, file: f })));
    }
  };

  return (
    <div className="flex flex-col items-end gap-2 w-full max-w-[520px]">
      {/* Hidden inputs */}
      <input ref={folderInputRef} type="file" multiple className="hidden"
        onChange={e => e.target.files && handleFolderInput(e.target.files)} />
      <input ref={zipInputRef} type="file" accept=".zip,application/zip" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleZip(f); }} />

      {/* Primary: local path input */}
      <div className="w-full rounded-lg border border-violet-700/60 bg-violet-950/20 px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1.5">
          <svg className="w-3.5 h-3.5 text-violet-300" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          </svg>
          <p className="text-[12px] font-medium text-violet-100">Importar desde ruta local</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={pathInputRef}
            type="text"
            value={pathDraft}
            onChange={e => setPathDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleLocalPath(pathDraft); }}
            placeholder="/Users/...../F400 - 120172_..."
            className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-[12px] text-slate-200 placeholder-slate-600 outline-none focus:border-violet-500 font-mono"
          />
          <button
            onClick={() => handleLocalPath(pathDraft)}
            className="px-3 py-1.5 rounded-md text-[12px] font-medium bg-violet-700/40 hover:bg-violet-700/60 text-violet-100 border border-violet-700/60 transition-colors whitespace-nowrap"
          >
            Importar
          </button>
        </div>
        <p className="text-[10px] text-violet-300/70 mt-1.5">
          En Finder: right-click sobre la carpeta + ⌥ (Option) → &ldquo;Copy as Pathname&rdquo;. También vale arrastrar la carpeta sobre el input — pega la ruta sola.
        </p>
      </div>

      {/* Toggle fallbacks */}
      <button
        onClick={() => setShowFallbacks(s => !s)}
        className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
      >
        {showFallbacks ? "ocultar otras opciones" : "otras opciones (browser drag-drop, zip)"}
      </button>

      {showFallbacks && (
        <div className="w-full flex flex-col gap-1.5">
          <div
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            className={`rounded-lg border border-dashed transition-colors px-3 py-2 cursor-pointer ${
              drag ? "border-slate-500 bg-slate-800/60" : "border-slate-800 bg-slate-900/30 hover:bg-slate-900/60"
            }`}
            onClick={() => folderInputRef.current?.click()}
          >
            <p className="text-[11px] text-slate-400">
              {drag ? "Soltá acá" : "Arrastrá carpeta o click para elegir (puede fallar en Safari)"}
            </p>
          </div>
          <button
            onClick={() => zipInputRef.current?.click()}
            className="text-[11px] text-slate-500 hover:text-slate-300 text-left"
          >
            o subir un .zip
          </button>
        </div>
      )}

      {/* Status */}
      {progress && (
        <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border border-slate-700 border-t-slate-400 animate-spin shrink-0" />
          {progress}
        </span>
      )}
      {result && (
        <div className={`text-[11px] px-2.5 py-1.5 rounded-md border w-full ${
          result.ok
            ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
            : "bg-red-950/40 border-red-800/60 text-red-300"
        }`}>
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
