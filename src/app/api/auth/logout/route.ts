import { NextResponse } from "next/server";
import { COOKIE_SESION } from "@/lib/auth";

/** POST /api/auth/logout — borra la cookie de sesión. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE_SESION,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
