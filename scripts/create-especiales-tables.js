require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS especiales (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      titulo TEXT NOT NULL,
      status VARCHAR(20) DEFAULT 'draft',
      total_paginas INTEGER DEFAULT 0,
      url_base TEXT,
      idioma VARCHAR(20) DEFAULT 'es',
      usar_imagenes_ia BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS especial_paginas (
      id SERIAL PRIMARY KEY,
      especial_id INTEGER REFERENCES especiales(id) ON DELETE CASCADE,
      numero INTEGER NOT NULL,
      titulo_item TEXT,
      imagen_url TEXT,
      imagen_original_url TEXT,
      parrafos JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(especial_id, numero)
    )
  `);
  console.log("Tablas especiales y especial_paginas creadas OK");
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
