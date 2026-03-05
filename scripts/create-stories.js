const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:shHjrZCGZPVUEpCeVoaHaXJtOIyCNAfu@hopper.proxy.rlwy.net:16672/railway' });

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stories (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      titulo TEXT NOT NULL,
      status VARCHAR(20) DEFAULT 'draft',
      total_paginas INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS story_paginas (
      id SERIAL PRIMARY KEY,
      story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
      numero INTEGER NOT NULL,
      imagen_url TEXT,
      parrafos JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(story_id, numero)
    )
  `);
  console.log('Tablas creadas OK');
  await pool.end();
}

run().catch(console.error);
