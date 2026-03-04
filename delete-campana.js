const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:shHjrZCGZPVUEpCeVoaHaXJtOIyCNAfu@hopper.proxy.rlwy.net:16672/railway' });
pool.query('DELETE FROM campanas WHERE pais = $1', ['IT']).then(r => console.log('Borrado:', r.rowCount)).finally(() => pool.end());
