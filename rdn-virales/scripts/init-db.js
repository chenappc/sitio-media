const { Client } = require("pg");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
console.log("Buscando .env.local en:", require("path").resolve(__dirname, "../.env.local"));
console.log("DATABASE_URL", process.env.DATABASE_URL);

const createNotas = `
CREATE TABLE IF NOT EXISTS notas (
  id SERIAL PRIMARY KEY,
  slug VARCHAR UNIQUE,
  titulo TEXT,
  entradilla TEXT,
  cuerpo TEXT,
  imagen_url TEXT,
  imagen2_url TEXT,
  imagen_alt TEXT,
  fuente_nombre TEXT,
  fuente_url TEXT,
  shares_buzzsumo INTEGER,
  pais TEXT,
  publicado BOOLEAN DEFAULT false,
  fecha TIMESTAMP,
  idioma VARCHAR(10) DEFAULT 'es',
  visitas INTEGER DEFAULT 0
);
`;

const createFbConfig = `
CREATE TABLE IF NOT EXISTS fb_config (
  key VARCHAR PRIMARY KEY,
  value TEXT
);
`;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL no está definido en .env.local");
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query(createNotas);
    await client.query(createFbConfig);
    console.log("Tablas listas (notas, fb_config).");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
