import { getDb } from "@/lib/db";
import type { Subject, ClassMaterial, Summary } from "@/lib/types";
import { notFound } from "next/navigation";
import Link from "next/link";
import DeepDiveButton from "@/components/DeepDiveButton";

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
}

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ subjectId: string; summaryId: string }>;
}) {
  const { subjectId: subjectIdStr, summaryId: summaryIdStr } = await params;
  const db         = getDb();
  const subjectId  = Number(subjectIdStr);
  const summaryId  = Number(summaryIdStr);

  const subject = db
    .prepare("SELECT * FROM subjects WHERE id = ?")
    .get(subjectId) as Subject | undefined;
  if (!subject) notFound();

  const summary = db
    .prepare("SELECT * FROM summaries WHERE id = ? AND subject_id = ?")
    .get(summaryId, subjectId) as Summary | undefined;
  if (!summary) notFound();

  const material = db
    .prepare("SELECT * FROM class_materials WHERE id = ?")
    .get(summary.material_id) as ClassMaterial | undefined;

  const snippet    = summary.content.slice(0, 600);
  const paragraphs = summary.content
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">

      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/facultad/${subjectId}`}
          className="text-xs text-slate-600 hover:text-slate-400 transition-colors mb-2 inline-block"
        >
          ← {subject.name}
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">{subject.name}</h1>
            {material && (
              <p className="text-sm text-slate-500 mt-0.5">
                Clase del {fmtDate(material.date)}
                {material.filename && (
                  <span className="ml-2 text-slate-700">· {material.filename}</span>
                )}
              </p>
            )}
          </div>
          <DeepDiveButton subjectName={subject.name} summarySnippet={snippet} />
        </div>
      </div>

      {/* Meta bar */}
      <div className="flex items-center gap-4 mb-8 pb-4 border-b border-slate-800">
        <span className="text-xs text-slate-600">
          {summary.content.split(/\s+/).length.toLocaleString()} palabras
        </span>
        <span className="text-xs text-slate-600">
          ~{Math.ceil(summary.content.split(/\s+/).length / 200)} min de lectura
        </span>
        <span className="text-xs text-slate-700">
          Generado {fmtDate(summary.created_at.slice(0, 10))}
        </span>
      </div>

      {/* Summary content */}
      <article className="space-y-4">
        {paragraphs.map((para, i) => (
          <p key={i} className="text-sm text-slate-300 leading-7">{para}</p>
        ))}
      </article>

      {/* Bottom actions */}
      <div className="mt-12 pt-6 border-t border-slate-800 flex items-center justify-between">
        <Link
          href={`/facultad/${subjectId}`}
          className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          ← Volver a {subject.name}
        </Link>
        <DeepDiveButton subjectName={subject.name} summarySnippet={snippet} />
      </div>
    </div>
  );
}
