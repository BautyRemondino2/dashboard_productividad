/**
 * Migración del CRM: `npm run db:migrate`.
 *
 * Corre contra el mismo destino que la app: Turso si está TURSO_DATABASE_URL,
 * el archivo local si no. Es idempotente — crea la tabla si falta, agrega
 * columnas que falten y siembra los ejemplos sólo si está vacía.
 *
 * Con --reseed borra los registros existentes y vuelve a sembrar los ejemplos.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@libsql/client";
import { migrarCrm, seedCrm } from "../src/lib/crm-schema.mjs";

/** Lee .env.local sin dependencias: sólo pares CLAVE=valor. */
function cargarEnvLocal() {
  const archivo = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(archivo)) return;
  for (const linea of fs.readFileSync(archivo, "utf8").split("\n")) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const valor = m[2].replace(/^["']|["']$/g, "");
    if (!process.env[m[1]]) process.env[m[1]] = valor;
  }
}

cargarEnvLocal();

const remoto = process.env.TURSO_DATABASE_URL?.trim();
const destino = remoto ?? `file:${path.join(process.cwd(), "data", "dashboard.db")}`;
const reseed = process.argv.includes("--reseed");

const db = createClient(
  remoto ? { url: remoto, authToken: process.env.TURSO_AUTH_TOKEN } : { url: destino }
);

const { creada, columnasAgregadas } = await migrarCrm(db);

if (reseed) {
  const { rowsAffected } = await db.execute("DELETE FROM clientes");
  console.log(`· --reseed: ${rowsAffected} registros borrados`);
}

const sembrados = await seedCrm(db);
const { rows } = await db.execute("SELECT COUNT(*) AS n FROM clientes");

console.log(`Destino: ${remoto ? "Turso · " + remoto.replace(/^libsql:\/\//, "") : destino}`);
console.log(`· tabla clientes: ${creada ? "creada" : "ya existía"}`);
console.log(`· columnas agregadas: ${columnasAgregadas.length > 0 ? columnasAgregadas.join(", ") : "ninguna"}`);
console.log(`· ejemplos sembrados: ${sembrados}`);
console.log(`· total de registros: ${Number(rows[0].n)}`);

db.close();
