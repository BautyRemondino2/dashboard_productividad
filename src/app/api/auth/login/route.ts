import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_SESION, DIAS_SESION, authConfigurada, crearSesion, verificarPassword,
} from "@/lib/auth";

/**
 * Freno simple de fuerza bruta. Vive en memoria de la instancia, así que en
 * serverless no es una defensa dura: sirve para que un script no pueda probar
 * miles de contraseñas contra la misma instancia. La defensa real es una
 * contraseña larga.
 */
const intentos = new Map<string, { n: number; hasta: number }>();
const MAX_INTENTOS = 8;
const BLOQUEO_MS = 10 * 60 * 1000;

function bloqueado(ip: string): boolean {
  const registro = intentos.get(ip);
  if (!registro) return false;
  if (Date.now() > registro.hasta) { intentos.delete(ip); return false; }
  return registro.n >= MAX_INTENTOS;
}

function sumarIntento(ip: string) {
  const registro = intentos.get(ip);
  if (!registro || Date.now() > registro.hasta) {
    intentos.set(ip, { n: 1, hasta: Date.now() + BLOQUEO_MS });
    return;
  }
  registro.n += 1;
}

export async function POST(req: NextRequest) {
  if (!authConfigurada()) {
    return NextResponse.json(
      { error: "El login no está configurado en este entorno" },
      { status: 503 }
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (bloqueado(ip)) {
    return NextResponse.json(
      { error: "Demasiados intentos. Probá de nuevo en unos minutos." },
      { status: 429 }
    );
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: "Faltan email o contraseña" }, { status: 400 });
  }

  const emailOk = email === process.env.AUTH_EMAIL!.trim().toLowerCase();
  // Se verifica la contraseña aunque el mail no coincida: si no, el tiempo de
  // respuesta delataría qué mail existe.
  const passOk = await verificarPassword(password, process.env.AUTH_PASSWORD_HASH!);

  if (!emailOk || !passOk) {
    sumarIntento(ip);
    return NextResponse.json({ error: "Email o contraseña incorrectos" }, { status: 401 });
  }

  intentos.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE_SESION,
    value: await crearSesion(email, process.env.AUTH_SECRET!),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DIAS_SESION * 86_400,
  });
  return res;
}
