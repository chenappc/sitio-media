require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL en el entorno.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  await pool.query(
    "ALTER TABLE notas ADD COLUMN IF NOT EXISTS idioma VARCHAR(10) DEFAULT 'es' NOT NULL"
  );
  console.log("OK: notas.idioma");

  await pool.query(
    "ALTER TABLE stories ADD COLUMN IF NOT EXISTS idioma VARCHAR(10) DEFAULT 'es' NOT NULL"
  );
  console.log("OK: stories.idioma");

  console.log("Migración idioma completada con éxito.");
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
