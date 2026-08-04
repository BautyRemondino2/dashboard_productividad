import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata = { title: "Entrar · Dashboard" };

export default function LoginPage() {
  return (
    <div className="min-h-full flex items-center justify-center px-5 py-16">
      <div className="w-full max-w-[340px]">
        <div className="flex items-center gap-2 mb-6">
          <div
            className="w-6 h-6 rounded flex items-center justify-center text-[11px] font-bold text-slate-100"
            style={{ background: "oklch(45% 0.15 255)" }}
          >
            b
          </div>
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
            Asesor
          </span>
        </div>

        <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">Entrar</h1>
        <p className="text-[13px] text-slate-500 mt-1 mb-6">
          El dashboard es privado: tiene datos de clientes.
        </p>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
