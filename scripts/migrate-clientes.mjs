/**
 * Migración manual del CRM: `npm run db:migrate`.
 *
 * Hace exactamente lo mismo que hace la app al abrir la DB (src/lib/db.ts),
 * porque usa el mismo módulo de schema. Es idempotente: crea la tabla si falta,
 * agrega columnas que falten y siembra los ejemplos sólo si está vacía.
 *
 * Con --reseed borra los registros existentes y vuelve a sembrar los ejemplos.
 */
import path from "node:path";
import process from "node:process";
import Database from "better-sqlite3";
import { migrarClientes, seedClientes } from "../src/lib/crm-schema.mjs";

const DB_PATH = path.join(process.cwd(), "data", "dashboard.db");
const reseed = process.argv.includes("--reseed");

const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");

const { creada, columnasAgregadas } = migrarClientes(db);

if (reseed) {
  const borrados = db.prepare("DELETE FROM clientes").run().changes;
  console.log(`· --reseed: ${borrados} registros borrados`);
}

const sembrados = seedClientes(db);
const total = db.prepare("SELECT COUNT(*) AS n FROM clientes").get().n;

console.log(`DB: ${DB_PATH}`);
console.log(`· tabla clientes: ${creada ? "creada" : "ya existía"}`);
console.log(`· columnas agregadas: ${columnasAgregadas.length > 0 ? columnasAgregadas.join(", ") : "ninguna"}`);
console.log(`· ejemplos sembrados: ${sembrados}`);
console.log(`· total de registros: ${total}`);

db.close();
