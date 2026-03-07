const { Client } = require("pg");

const CONNECTION_STRING =
  process.env.DATABASE_URL ||
  "postgresql://postgres:shHjrZCGZPVUEpCeVoaHaXJtOIyCNAfu@hopper.proxy.rlwy.net:16672/railway";

async function main() {
  const client = new Client({ connectionString: CONNECTION_STRING });
  await client.connect();
  console.log("Conectado a la DB.");
  await client.query("ALTER TABLE stories ADD COLUMN IF NOT EXISTS url_base TEXT;");
  console.log("Columna url_base agregada (o ya existía).");
  await client.end();
  console.log("Listo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
