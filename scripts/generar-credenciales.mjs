/**
 * Genera las variables de entorno del login: `npm run auth:setup`.
 *
 * Pide la contraseña por teclado (no se muestra ni queda en el historial del
 * shell), imprime su hash PBKDF2 y un AUTH_SECRET al azar. La contraseña en
 * texto plano no se guarda en ningún lado: sólo viaja del teclado al hash.
 */
import process from "node:process";
import readline from "node:readline";
import { webcrypto as crypto } from "node:crypto";

const PBKDF2_ITERACIONES = 210_000;
const enc = new TextEncoder();

const aBase64Url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Lee una línea sin eco en pantalla. */
function preguntarOculto(pregunta) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    process.stdout.write(pregunta);
    const onData = (char) => {
      if (["\n", "\r", ""].includes(char.toString())) process.stdin.removeListener("data", onData);
      else process.stdout.write("[2K[200D" + pregunta + "*".repeat(rl.line.length));
    };
    process.stdin.on("data", onData);
    rl.question("", (valor) => { rl.close(); process.stdout.write("\n"); resolve(valor); });
  });
}

function preguntar(pregunta) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(pregunta, (v) => { rl.close(); resolve(v); }));
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERACIONES, hash: "SHA-256" },
    key,
    256
  );
  // ":" y no "$": los .env de Next expanden $VARIABLE y romperían el hash
  return `pbkdf2:${PBKDF2_ITERACIONES}:${aBase64Url(salt)}:${aBase64Url(bits)}`;
}

const email = (await preguntar("Email para entrar: ")).trim().toLowerCase();
if (!email.includes("@")) {
  console.error("Ese email no parece válido.");
  process.exit(1);
}

const password = await preguntarOculto("Contraseña (no se muestra): ");
if (password.length < 12) {
  console.error("Usá al menos 12 caracteres: la URL es pública, la contraseña es la única puerta.");
  process.exit(1);
}
const repetida = await preguntarOculto("Repetila: ");
if (password !== repetida) {
  console.error("No coinciden.");
  process.exit(1);
}

const hash = await hashPassword(password);
const secreto = aBase64Url(crypto.getRandomValues(new Uint8Array(32)));

console.log(`
Listo. Pegá esto en .env.local para probar en tu máquina:

AUTH_EMAIL=${email}
AUTH_PASSWORD_HASH=${hash}
AUTH_SECRET=${secreto}

Y cargá las mismas tres en Vercel (una por vez):

  vercel env add AUTH_EMAIL production
  vercel env add AUTH_PASSWORD_HASH production
  vercel env add AUTH_SECRET production

Guardá la contraseña en tu gestor: no queda registrada en ninguna parte.
`);
