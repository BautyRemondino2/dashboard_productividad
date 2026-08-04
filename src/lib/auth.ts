/**
 * Login de un solo usuario: el dueño del dashboard.
 *
 * No hay tabla de usuarios ni librería de auth. El email y el hash de la
 * contraseña viven en variables de entorno, y la sesión es una cookie firmada
 * con HMAC-SHA-256. Todo con Web Crypto, que existe igual en el runtime de
 * Node y en el Edge donde corre el proxy.
 *
 * Variables necesarias (ver README del proyecto):
 *   AUTH_EMAIL          · el mail con el que entrás
 *   AUTH_PASSWORD_HASH  · pbkdf2:<iteraciones>:<saltB64>:<hashB64>
 *   AUTH_SECRET         · 32+ bytes al azar, firma la cookie
 *
 * El separador es ":" y no "$" a propósito: los archivos .env de Next expanden
 * $VARIABLE, así que un hash con $ llega mutilado a process.env.
 */

export const COOKIE_SESION = "dash_sesion";
export const DIAS_SESION = 30;

const PBKDF2_ITERACIONES = 210_000;

// ── Utilidades ────────────────────────────────────────────────────────────────

const enc = new TextEncoder();

function aBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function desdeBase64(b64: string): Uint8Array {
  const normal = b64.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(normal);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Comparación en tiempo constante: no filtra en qué carácter difieren. */
function igualSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

// ── Contraseña ────────────────────────────────────────────────────────────────

/** Deriva el hash de una contraseña. Formato: pbkdf2:iters:saltB64:hashB64 */
export async function hashPassword(password: string, saltBytes?: Uint8Array): Promise<string> {
  const salt = saltBytes ?? crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERACIONES, hash: "SHA-256" },
    key,
    256
  );
  return `pbkdf2:${PBKDF2_ITERACIONES}:${aBase64Url(salt)}:${aBase64Url(bits)}`;
}

export async function verificarPassword(password: string, guardado: string): Promise<boolean> {
  const partes = guardado.split(":");
  if (partes.length !== 4 || partes[0] !== "pbkdf2") return false;

  const iteraciones = Number(partes[1]);
  if (!Number.isFinite(iteraciones) || iteraciones < 1000) return false;

  const salt = desdeBase64(partes[2]);
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: iteraciones, hash: "SHA-256" },
    key,
    256
  );
  return igualSeguro(aBase64Url(bits), partes[3]);
}

// ── Sesión ────────────────────────────────────────────────────────────────────

interface Sesion {
  sub: string;
  exp: number; // epoch en segundos
}

async function firmar(payload: string, secreto: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return aBase64Url(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
}

/** Cookie = payload en base64url + firma. Sin secreto no se puede falsificar. */
export async function crearSesion(email: string, secreto: string): Promise<string> {
  const sesion: Sesion = {
    sub: email,
    exp: Math.floor(Date.now() / 1000) + DIAS_SESION * 86_400,
  };
  const payload = aBase64Url(enc.encode(JSON.stringify(sesion)));
  return `${payload}.${await firmar(payload, secreto)}`;
}

/** Devuelve la sesión si la firma es válida y no venció; null en cualquier otro caso. */
export async function leerSesion(valor: string | undefined, secreto: string): Promise<Sesion | null> {
  if (!valor || !secreto) return null;

  const [payload, firma] = valor.split(".");
  if (!payload || !firma) return null;

  if (!igualSeguro(firma, await firmar(payload, secreto))) return null;

  try {
    const sesion = JSON.parse(new TextDecoder().decode(desdeBase64(payload))) as Sesion;
    if (typeof sesion.exp !== "number" || sesion.exp * 1000 < Date.now()) return null;
    return sesion;
  } catch {
    return null;
  }
}

/** True si el login está configurado. Sin esto el proxy deja pasar todo. */
export function authConfigurada(): boolean {
  return Boolean(
    process.env.AUTH_EMAIL?.trim() &&
    process.env.AUTH_PASSWORD_HASH?.trim() &&
    process.env.AUTH_SECRET?.trim()
  );
}
