const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:shHjrZCGZPVUEpCeVoaHaXJtOIyCNAfu@hopper.proxy.rlwy.net:16672/railway' });
async function run() {
  await pool.query(`ALTER TABLE stories ADD COLUMN IF NOT EXISTS descripcion_protagonista TEXT`);
  console.log('Columna descripcion_protagonista agregada OK');
  await pool.end();
}
run().catch(console.error);
