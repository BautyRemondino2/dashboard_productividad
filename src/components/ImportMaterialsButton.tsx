"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { importZip, importFolder } from "@/app/actions";

interface Props { subjectId: number }

interface Result {
  ok: boolean;
  classesCreated?: number;
  filesImported?: number;
  filesSkipped?: number;
  message?: string;
  samplePaths?: string[];
}

// ─── FileSystemEntry helpers (cross-browser folder traversal) ────────────────
// Used by drag-and-drop. The webkitGetAsEntry API works in Safari, Chrome and
// Firefox and preserves the dropped folder structure, unlike <input webkitdirectory>
// which can return empty webkitRelativePath in some browsers.

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
    const f = await new Promise<File>((resolve, reject) => {
      entry.file!(resolve, reject);
    });
    return [{ path: here, file: f }];
  }

  if (entry.isDirectory && entry.createReader) {
    const reader = entry.createReader();
    const collected: { path: string; file: File }[] = [];
    // readEntries returns at most ~100 at a time — loop until empty.
    while (true) {
      const batch = await new Promise<FSEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject)
      );
      if (batch.length === 0) break;
      for (const e of batch) {
        const inner = await walkEntry(e, here);
        collected.push(...inner);
      }
    }
    return collected;
  }

  return [];
}

async function filesFromDataTransfer(items: DataTransferItemList): Promise<{ path: string; file: File }[]> {
  const out: { path: string; file: File }[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // webkitGetAsEntry is the API name across browsers (incl. Safari)
    const entry = (item as unknown as { webkitGetAsEntry?: () => FSEntry | null }).webkitGetAsEntry?.();
    if (entry) {
      const walked = await walkEntry(entry, "");
      out.push(...walked);
    } else {
      // Fallback: just a file with no folder info
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
  const [, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  // Set webkitdirectory imperatively — React strips it in some setups
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "");
      folderInputRef.current.setAttribute("directory", "");
    }
  }, []);

  const uploadFiles = (files: { path: string; file: File }[]) => {
    if (files.length === 0) {
      setResult({ ok: false, message: "La carpeta no tiene archivos válidos" });
      return;
    }

    setResult(null);
    setProgress(`Subiendo ${files.length} archivos…`);

    const fd = new FormData();
    fd.set("subject_id", String(subjectId));
    let kept = 0;
    for (const { path: relPath, file } of files) {
      if (!relPath) continue;
      const segments = relPath.split("/");
      if (segments.some(p => p.startsWith("."))) continue;
      if (relPath.includes("__MACOSX/")) continue;
      const named = new File([file], relPath, { type: file.type, lastModified: file.lastModified });
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
      // Only auto-dismiss on success — keep error visible so the user can read the diagnostic
      if (r.ok) setTimeout(() => setResult(null), 12000);
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
      setResult(r);
      setProgress(null);
      if (zipInputRef.current) zipInputRef.current.value = "";
      if (r.ok) setTimeout(() => setResult(null), 12000);
    });
  };

  const handleFolderInput = (files: FileList) => {
    const list = Array.from(files).map(f => ({
      path: f.webkitRelativePath || f.name,
      file: f,
    }));
    // Detect the Safari quirk: webkitdirectory only returns top-level files, so
    // every path has depth ≤ 1 (just "Wrapper/file.pdf"). If the user's folder
    // really has nested subfolders, we'd see depth ≥ 2 somewhere.
    const maxDepth = Math.max(...list.map(item => item.path.split("/").length));
    if (maxDepth < 3) {
      setResult({
        ok: false,
        message: `Tu navegador (probablemente Safari) flatteó la carpeta — solo recibí archivos al nivel raíz, sin las subcarpetas TEMA NN. Arrastrá la carpeta directamente sobre la zona violeta desde Finder, o subila como .zip.`,
        samplePaths: list.slice(0, 5).map(i => i.path),
      });
      return;
    }
    uploadFiles(list);
  };

  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDrag(false);
    if (!e.dataTransfer) return;

    setProgress("Leyendo carpeta…");

    // If we have items, use the entry API for folder support
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      try {
        const walked = await filesFromDataTransfer(e.dataTransfer.items);
        uploadFiles(walked);
        return;
      } catch (err) {
        setProgress(null);
        setResult({ ok: false, message: `Error leyendo la carpeta: ${err instanceof Error ? err.message : String(err)}` });
        return;
      }
    }

    // Fallback: just files (no folder info)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const list = Array.from(e.dataTransfer.files).map(f => ({ path: f.name, file: f }));
      uploadFiles(list);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      {/* Hidden inputs */}
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={e => e.target.files && handleFolderInput(e.target.files)}
      />
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

      {/* Drag & drop area — primary path. Does NOT open the picker on click
          (Safari's picker doesn't traverse subdirectories). */}
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={`rounded-lg border-2 border-dashed transition-colors px-5 py-4 ${
          drag
            ? "border-violet-400 bg-violet-950/50"
            : "border-violet-700/60 bg-violet-950/20"
        }`}
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-violet-300 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          </svg>
          <div className="flex flex-col">
            <span className="text-[13px] text-violet-100 font-medium">
              {drag ? "Soltá la carpeta acá" : "Arrastrá la carpeta desde Finder"}
            </span>
            <span className="text-[10px] text-violet-300/70">
              También podés{" "}
              <button onClick={() => zipInputRef.current?.click()} className="underline hover:text-violet-100">subir un .zip</button>
              {" "}o{" "}
              <button onClick={() => folderInputRef.current?.click()} className="underline hover:text-violet-100">elegir carpeta (no funciona en Safari)</button>
            </span>
          </div>
        </div>
      </div>

      {/* Status */}
      {progress && (
        <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border border-slate-700 border-t-slate-400 animate-spin shrink-0" />
          {progress}
        </span>
      )}

      {result && (
        <div
          className={`text-[11px] px-2.5 py-1.5 rounded-md border max-w-[480px] ${
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
          {result.samplePaths && result.samplePaths.length > 0 && (
            <div className="mt-1.5 pt-1.5 border-t border-current/20">
              <p className="text-[9px] uppercase tracking-widest opacity-60 mb-0.5">paths recibidos (muestra)</p>
              <ul className="text-[10px] font-mono opacity-80 space-y-0.5">
                {result.samplePaths.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
