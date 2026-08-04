import { getDb } from "@/lib/db";
import { hoyISO, type Cliente } from "@/lib/crm";
import CrmClient from "./CrmClient";

export const metadata = { title: "CRM · Dashboard" };

// El seguimiento cambia todo el tiempo: nunca conviene servirlo prerenderizado.
export const dynamic = "force-dynamic";

export default function CrmPage() {
  const clientes = getDb()
    .prepare("SELECT * FROM clientes ORDER BY fecha_proxima_accion IS NULL, fecha_proxima_accion ASC, apellido ASC")
    .all() as Cliente[];

  return (
    <div className="px-4 sm:px-8 py-7 max-w-[1400px]">
      <div className="mb-6 fade-up fade-up-1">
        <p className="text-[11px] uppercase tracking-widest text-slate-600 mb-1">Dashboard</p>
        <h1 className="text-3xl font-semibold text-slate-100 tracking-tight">CRM</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Prospectos y clientes · seguimiento por etapa y próxima acción
        </p>
      </div>

      {/* Sin wrapper .fade-up: su transform final crearía contenedor para los
          elementos fixed del panel lateral. El componente anima sus secciones. */}
      <CrmClient clientesIniciales={clientes} hoyServidor={hoyISO()} />
    </div>
  );
}
