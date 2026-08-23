import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, authConfigurada, leerSesion } from "@/lib/auth";

/**
 * Puerta de entrada del dashboard (en Next 16 el viejo middleware se llama
 * proxy). Todo el sitio queda detrás del login: es un dashboard privado.
 *
 * Si las variables de auth no están configuradas, no bloquea nada: en local se
 * sigue trabajando sin login.
 */
export async function proxy(req: NextRequest) {
  if (!authConfigurada()) {
    // En producción sin login configurado no se sirve nada: que se note el
    // error de configuración es mejor que publicar el dashboard por omisión.
    // En desarrollo se sigue trabajando sin login.
    if (process.env.NODE_ENV === "production") {
      return new NextResponse(
        "Falta configurar el login: AUTH_EMAIL, AUTH_PASSWORD_HASH y AUTH_SECRET.",
        { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }
      );
    }
    return NextResponse.next();
  }

  const sesion = await leerSesion(
    req.cookies.get(COOKIE_SESION)?.value,
    process.env.AUTH_SECRET!
  );
  if (sesion) return NextResponse.next();

  // A la API le sirve un 401; al navegador, la pantalla de login
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const login = new URL("/login", req.url);
  const destino = req.nextUrl.pathname + req.nextUrl.search;
  if (destino !== "/") login.searchParams.set("next", destino);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    /*
     * Todo menos:
     * - /login y las rutas de autenticación (si no, no habría forma de entrar)
     * - assets de Next y archivos estáticos
     */
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
