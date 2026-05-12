import { getDb } from "@/lib/db";
import type { Exam, Subject } from "@/lib/types";
import { localDateStr } from "@/lib/utils";
import Link from "next/link";
import AddExamInline from "@/components/AddExamInline";
import DeleteExamButton from "@/components/DeleteExamButton";
import RecordGradeButton from "@/components/RecordGradeButton";

const EXAM_TYPE_LABEL: Record<string, string> = {
  parcial: "Parcial", final: "Final", tp: "TP", quiz: "Quiz", otro: "Otro",
};

const EXAM_TYPE_COLOR: Record<string, string> = {
  parcial: "text-violet-400 border-violet-800 bg-violet-950/30",
  final:   "text-red-400 border-red-800 bg-red-950/30",
  tp:      "text-blue-400 border-blue-800 bg-blue-950/30",
  quiz:    "text-amber-400 border-amber-800 bg-amber-950/30",
  otro:    "text-slate-400 border-slate-700 bg-slate-900",
};

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(day)} ${months[parseInt(m)-1]} ${y}`;
}

interface ExamWithSubject extends Exam {
  subject_name: string;
}

export default async function ExamenesPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const sp        = await searchParams;
  const subjectId = sp.subject ? Number(sp.subject) : null;

  const db       = getDb();
  const today    = localDateStr();
  const subjects = db.prepare("SELECT * FROM subjects ORDER BY name").all() as Subject[];

  let query = `
    SELECT e.*, s.name as subject_name
    FROM exams e
    JOIN subjects s ON s.id = e.subject_id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (subjectId) {
    query += " AND e.subject_id = ?";
    params.push(subjectId);
  }

  const allExams = db.prepare(query + " ORDER BY e.date ASC").all(...params) as ExamWithSubject[];

  const upcoming = allExams.filter(e => e.date >= today);
  const past     = allExams.filter(e => e.date < today).reverse(); // newest first

  // Stats
  const gradedExams = past.filter(e => e.grade != null);
  const avgGrade    = gradedExams.length > 0
    ? (gradedExams.reduce((s, e) => s + (e.grade ?? 0), 0) / gradedExams.length).toFixed(1)
    : null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Exámenes</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {upcoming.length} próximo{upcoming.length !== 1 ? "s" : ""}
            {past.length > 0 && ` · ${past.length} pasado${past.length !== 1 ? "s" : ""}`}
            {avgGrade && ` · promedio ${avgGrade}`}
          </p>
        </div>
      </div>

      {/* Subject filter */}
      <div className="flex flex-wrap items-center gap-1.5 mb-6">
        <span className="text-xs text-slate-600">Materia:</span>
        <Link
          href="/examenes"
          className={`px-2 py-0.5 rounded text-xs transition-colors ${!subjectId ? "bg-slate-700 text-slate-200" : "text-slate-600 hover:text-slate-400 hover:bg-slate-900"}`}
        >
          Todas
        </Link>
        {subjects.map(s => (
          <Link
            key={s.id}
            href={`/examenes?subject=${s.id}`}
            className={`px-2 py-0.5 rounded text-xs transition-colors ${subjectId === s.id ? "bg-slate-700 text-slate-200" : "text-slate-600 hover:text-slate-400 hover:bg-slate-900"}`}
          >
            {s.name}
          </Link>
        ))}
      </div>

      {/* Add exam */}
      <div className="mb-8">
        <AddExamInline subjects={subjects} fixedSubjectId={subjectId ?? undefined} />
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
            Próximos — {upcoming.length}
          </h2>
          <div className="space-y-2">
            {upcoming.map(ex => {
              const daysUntil = Math.round(
                (new Date(ex.date + "T12:00:00").getTime() - new Date().getTime()) / 86_400_000
              );
              return (
                <div key={ex.id} className="group flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 hover:border-slate-700 transition-colors">
                  <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${EXAM_TYPE_COLOR[ex.type]}`}>
                    {EXAM_TYPE_LABEL[ex.type]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200">{ex.title}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{ex.subject_name}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium tabular-nums ${
                    daysUntil === 0 ? "text-red-400"
                    : daysUntil <= 3 ? "text-amber-400"
                    : "text-slate-500"
                  }`}>
                    {daysUntil === 0 ? "Hoy" : daysUntil === 1 ? "Mañana" : `en ${daysUntil}d`}
                  </span>
                  <span className="shrink-0 text-xs text-slate-600 tabular-nums">{fmtDate(ex.date)}</span>
                  <DeleteExamButton id={ex.id} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {upcoming.length === 0 && (
        <div className="py-6 text-center">
          <p className="text-sm text-slate-600">No hay exámenes próximos.</p>
        </div>
      )}

      {/* Past exams */}
      {past.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-600 mb-3">
            Historial — {past.length}
          </h2>
          <div className="space-y-2">
            {past.map(ex => (
              <div key={ex.id} className="group flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-900 transition-colors">
                <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border opacity-60 ${EXAM_TYPE_COLOR[ex.type]}`}>
                  {EXAM_TYPE_LABEL[ex.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-400">{ex.title}</p>
                  <p className="text-xs text-slate-700 mt-0.5">{ex.subject_name}</p>
                </div>
                <span className="shrink-0 text-xs text-slate-700 tabular-nums">{fmtDate(ex.date)}</span>
                <RecordGradeButton examId={ex.id} currentGrade={ex.grade} />
                <DeleteExamButton id={ex.id} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
