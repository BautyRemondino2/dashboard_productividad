import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { ClassMaterial } from "@/lib/types";
import path from "path";
import fs from "fs";

const MATERIALS_ROOT = path.join(process.cwd(), "data", "materials");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const db = getDb();
  const row = db
    .prepare("SELECT * FROM class_materials WHERE id = ?")
    .get(id) as ClassMaterial | undefined;
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Resolve absolute path and guard against traversal
  const abs = path.resolve(path.join(MATERIALS_ROOT, row.file_path));
  if (!abs.startsWith(path.resolve(MATERIALS_ROOT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!fs.existsSync(abs)) {
    return NextResponse.json({ error: "File missing on disk" }, { status: 404 });
  }

  const buf = fs.readFileSync(abs);
  const body = new Uint8Array(buf);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": row.mime ?? "application/octet-stream",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
      "Content-Length": String(buf.length),
    },
  });
}
