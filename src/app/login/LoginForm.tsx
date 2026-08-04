"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const input =
  "w-full bg-slate-950/60 border border-slate-800 rounded-md px-3 py-2 text-[13px] text-slate-100 " +
  "placeholder:text-slate-600 focus:outline-none focus:border-slate-600 transition-colors";

export default function LoginForm() {
  const router = useRouter();
  const destino = useSearchParams().get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => ({}));
        setError(cuerpo.error ?? `No se pudo entrar (${res.status})`);
        return;
      }
      // replace: que el back del navegador no vuelva al login ya autenticado
      router.replace(destino && destino.startsWith("/") ? destino : "/mercado");
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={entrar} className="space-y-3">
      <input
        className={input}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        autoComplete="username"
        autoFocus
        required
      />
      <input
        className={input}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Contraseña"
        autoComplete="current-password"
        required
      />

      {error && (
        <p className="rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2 text-[12px] text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando || !email || !password}
        className="w-full text-[13px] font-medium px-3 py-2 rounded-md bg-slate-100 text-slate-900 hover:bg-white disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors"
      >
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
