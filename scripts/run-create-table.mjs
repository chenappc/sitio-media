import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");
try {
  const env = readFileSync(envPath, "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch (_) {}

const sql = `
CREATE TABLE IF NOT EXISTS notas (
  id             SERIAL PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE,
  titulo         TEXT NOT NULL,
  entradilla     TEXT NOT NULL,
  cuerpo         TEXT NOT NULL,
  imagen_url     TEXT,
  imagen_alt     TEXT,
  fuente_nombre  TEXT NOT NULL,
  fuente_url     TEXT NOT NULL,
  shares_buzzsumo INTEGER NOT NULL DEFAULT 0,
  pais           TEXT NOT NULL DEFAULT 'general',
  publicado      BOOLEAN NOT NULL DEFAULT false,
  fecha          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notas_publicado_fecha ON notas (publicado, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_notas_slug ON notas (slug);
`;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();
  await client.query(sql);
  console.log("Tabla 'notas' creada correctamente (o ya existía).");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
