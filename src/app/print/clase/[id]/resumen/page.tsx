import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import type { ClassItem, Subject } from "@/lib/types";
import RichSummary from "@/components/RichSummary";
import AutoPrint from "@/components/AutoPrint";
import PrintToolbar from "@/components/PrintToolbar";

export const metadata = { title: "Resumen · PDF" };

export default async function PrintSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const classId = Number(rawId);
  if (!Number.isFinite(classId)) notFound();

  const db = getDb();
  const cls = db
    .prepare("SELECT * FROM classes WHERE id = ?")
    .get(classId) as ClassItem | undefined;
  if (!cls || !cls.summary) notFound();

  const subject = db
    .prepare("SELECT * FROM subjects WHERE id = ?")
    .get(cls.subject_id) as Subject | undefined;
  if (!subject) notFound();

  const fmtDate = (d: string | null) => {
    if (!d) return null;
    const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const [y, m, day] = d.split("-");
    return `${parseInt(day)} de ${months[parseInt(m) - 1]} de ${y}`;
  };

  return (
    <div className="print-root bg-white text-slate-900 min-h-screen">
      <PrintToolbar backHref={`/facultad/${subject.id}`} />

      {/* The actual document, A4-shaped on screen */}
      <div className="max-w-[820px] mx-auto px-12 py-10 print:max-w-none print:px-0 print:py-0">
        <header className="mb-8 pb-4 border-b-2 border-slate-300">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">{subject.name}</p>
          <h1 className="text-3xl font-bold text-slate-900 mt-1 tracking-tight">
            Clase {cls.week} — {cls.title}
          </h1>
          {cls.date && (
            <p className="text-[12px] text-slate-600 mt-1">{fmtDate(cls.date)}</p>
          )}
        </header>

        <RichSummary markdown={cls.summary} />
      </div>

      {/* Auto-trigger print dialog on first mount */}
      <AutoPrint />
    </div>
  );
}
