import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { GlossaryTerm } from "@/lib/glossary";

export type { GlossaryTerm };

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search")?.trim() ?? "";
  const category = searchParams.get("category")?.trim() ?? "";

  const db = getDb();
  let query = "SELECT * FROM glossary_terms WHERE 1=1";
  const args: string[] = [];

  if (search) {
    query += " AND (term LIKE ? OR short_def LIKE ? OR detail LIKE ?)";
    const like = `%${search}%`;
    args.push(like, like, like);
  }

  if (category) {
    query += " AND category = ?";
    args.push(category);
  }

  query += " ORDER BY category, term";

  const terms = db.prepare(query).all(...args) as GlossaryTerm[];
  return NextResponse.json(terms);
}
