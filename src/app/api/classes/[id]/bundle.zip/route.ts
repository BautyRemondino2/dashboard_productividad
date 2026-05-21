import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { ClassMaterial, ClassItem } from "@/lib/types";
import AdmZip from "adm-zip";
import path from "path";
import fs from "fs";

const MATERIALS_ROOT = path.join(process.cwd(), "data", "materials");

/** GET /api/classes/[id]/bundle.zip
 *  Returns a single .zip with every material belonging to the class — used by
 *  the "Resumir clase con Claude" flow so the user can drag one zip into the
 *  chat instead of N files from N tabs. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const classId = Number(rawId);
  if (!Number.isFinite(classId)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const db = getDb();
  const cls = db
    .prepare("SELECT id, title, week, subject_id FROM classes WHERE id = ?")
    .get(classId) as Pick<ClassItem, "id" | "title" | "week" | "subject_id"> | undefined;
  if (!cls) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  const materials = db
    .prepare("SELECT * FROM class_materials WHERE class_id = ? ORDER BY kind, filename")
    .all(classId) as ClassMaterial[];

  if (materials.length === 0) {
    return NextResponse.json({ error: "No materials" }, { status: 404 });
  }

  const zip = new AdmZip();
  const seenNames = new Map<string, number>();

  for (const m of materials) {
    const abs = path.resolve(path.join(MATERIALS_ROOT, m.file_path));
    // Path-traversal guard
    if (!abs.startsWith(path.resolve(MATERIALS_ROOT))) continue;
    if (!fs.existsSync(abs)) continue;

    // De-dup inner filenames in case two materials share a name
    let entryName = m.filename;
    const count = seenNames.get(entryName) ?? 0;
    if (count > 0) {
      const ext = path.extname(entryName);
      const base = path.basename(entryName, ext);
      entryName = `${base} (${count + 1})${ext}`;
    }
    seenNames.set(m.filename, count + 1);

    try {
      zip.addFile(entryName, fs.readFileSync(abs));
    } catch { /* skip unreadable */ }
  }

  const buf = zip.toBuffer();

  // Filename like "Clase 4 — Valuación de instrumentos.zip" — strip nasty chars
  const safeTitle = cls.title
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  const zipName = `Clase ${cls.week} — ${safeTitle}.zip`;

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`,
      "Content-Length": String(buf.length),
      "Cache-Control": "no-store",
    },
  });
}
