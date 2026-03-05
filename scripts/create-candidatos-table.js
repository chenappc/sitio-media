const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:shHjrZCGZPVUEpCeVoaHaXJtOIyCNAfu@hopper.proxy.rlwy.net:16672/railway' });

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS candidatos_buzzsumo (
      id SERIAL PRIMARY KEY,
      titulo TEXT NOT NULL,
      url TEXT UNIQUE NOT NULL,
      thumbnail TEXT,
      total_facebook_shares INTEGER DEFAULT 0,
      keyword TEXT,
      status VARCHAR(20) DEFAULT 'pendiente',
      nota_id INTEGER REFERENCES notas(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('Tabla candidatos_buzzsumo creada OK');
  await pool.end();
}

run().catch(console.error);
