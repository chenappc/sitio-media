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

const sql = `ALTER TABLE notas ADD COLUMN IF NOT EXISTS imagen2_url TEXT;`;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();
  await client.query(sql);
  console.log("Columna imagen2_url agregada (o ya existía).");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
