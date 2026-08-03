"use client";

import { useEffect } from "react";

/**
 * Frontera de error de toda la app. Sin esto, cualquier excepción del servidor
 * —incluida una server action que falla en segundo plano— reemplaza la página
 * por la pantalla negra genérica de Next, sin contexto ni forma de reintentar.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="px-8 py-16 max-w-[560px] mx-auto">
      <p className="text-[11px] uppercase tracking-widest text-amber-500/80 mb-2">Error</p>
      <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">
        Algo se rompió al cargar esta sección
      </h1>
      <p className="text-sm text-slate-400 mt-2 leading-relaxed">
        El resto del dashboard sigue funcionando. Podés reintentar; si vuelve a fallar,
        el detalle está en los logs del servidor.
      </p>

      <p className="mt-4 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 text-[12px] text-slate-400 font-mono break-words">
        {error.message || "Error desconocido"}
        {error.digest && <span className="text-slate-600"> · digest {error.digest}</span>}
      </p>

      <button
        onClick={() => unstable_retry()}
        className="mt-5 text-[12px] font-medium px-3 py-1.5 rounded-md border border-slate-700 text-slate-200 hover:text-slate-50 hover:border-slate-500 transition-colors"
      >
        Reintentar
      </button>
    </div>
  );
}
