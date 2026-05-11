import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { CONTEXTS } from "@/lib/types";
import type { Task, Context } from "@/lib/types";
import TaskItem from "@/components/TaskItem";
import AddTaskInline from "@/components/AddTaskInline";

const PRIORITY_SORT = `CASE priority WHEN 'alta' THEN 1 WHEN 'media' THEN 2 WHEN 'baja' THEN 3 END`;

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string; priority?: string }>;
}

export default async function ContextPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { status, priority } = await searchParams;

  const ctx = CONTEXTS.find((c) => c.slug === slug);
  if (!ctx) notFound();

  const db = getDb();

  let query = `SELECT * FROM tasks WHERE context = ?`;
  const args: (string | number)[] = [slug];

  if (status === "pendiente" || status === "hecha") {
    query += ` AND status = ?`;
    args.push(status);
  }

  if (priority === "alta" || priority === "media" || priority === "baja") {
    query += ` AND priority = ?`;
    args.push(priority);
  }

  query += ` ORDER BY status, ${PRIORITY_SORT}, due_date ASC, created_at`;

  const tasks = db.prepare(query).all(...args) as Task[];

  const pending = tasks.filter((t) => t.status === "pendiente");
  const done = tasks.filter((t) => t.status === "hecha");

  const statusOptions: { value: string; label: string }[] = [
    { value: "", label: "Todas" },
    { value: "pendiente", label: "Pendiente" },
    { value: "hecha", label: "Hecha" },
  ];

  const priorityOptions: { value: string; label: string }[] = [
    { value: "", label: "Todas" },
    { value: "alta", label: "Alta" },
    { value: "media", label: "Media" },
    { value: "baja", label: "Baja" },
  ];

  function filterHref(key: string, val: string) {
    const sp = new URLSearchParams();
    if (key !== "status" && status) sp.set("status", status);
    if (key !== "priority" && priority) sp.set("priority", priority);
    if (val) sp.set(key, val);
    const qs = sp.toString();
    return `/context/${slug}${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-100">{ctx.label}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {tasks.length} {tasks.length === 1 ? "tarea" : "tareas"}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-8">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Estado</span>
          <div className="flex gap-1">
            {statusOptions.map((opt) => (
              <a
                key={opt.value}
                href={filterHref("status", opt.value)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  (status ?? "") === opt.value
                    ? "bg-slate-700 text-slate-100"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {opt.label}
              </a>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Prioridad</span>
          <div className="flex gap-1">
            {priorityOptions.map((opt) => (
              <a
                key={opt.value}
                href={filterHref("priority", opt.value)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  (priority ?? "") === opt.value
                    ? "bg-slate-700 text-slate-100"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {opt.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Pending tasks */}
      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
            Pendientes — {pending.length}
          </h2>
          <div className="space-y-1">
            {pending.map((task) => (
              <TaskItem key={task.id} task={task} showDueDate />
            ))}
          </div>
        </section>
      )}

      {/* Done tasks */}
      {done.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-600 mb-3">
            Hechas — {done.length}
          </h2>
          <div className="space-y-1">
            {done.map((task) => (
              <TaskItem key={task.id} task={task} showDueDate />
            ))}
          </div>
        </section>
      )}

      {tasks.length === 0 && (
        <p className="text-sm text-slate-600 py-4">No hay tareas con estos filtros.</p>
      )}

      <div className="mt-4">
        <AddTaskInline defaultContext={slug as Context} />
      </div>
    </div>
  );
}
