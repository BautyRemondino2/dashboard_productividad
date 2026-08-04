import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, authConfigurada, leerSesion } from "@/lib/auth";

/**
 * Puerta de entrada del dashboard (en Next 16 el viejo middleware se llama
 * proxy). Todo el sitio queda detrás del login: el CRM tiene datos de clientes
 * y el widget de acciones los muestra en el home, así que no alcanza con tapar
 * /crm.
 *
 * Si las variables de auth no están configuradas, no bloquea nada: en local se
 * sigue trabajando sin login.
 */
export async function proxy(req: NextRequest) {
  if (!authConfigurada()) return NextResponse.next();

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
