const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:shHjrZCGZPVUEpCeVoaHaXJtOIyCNAfu@hopper.proxy.rlwy.net:16672/railway' });

async function run() {
  const updates = [
    { id: 4, fb_post_id: '1524649639663758' },
    { id: 5, fb_post_id: '1524647799663942' },
    { id: 7, fb_post_id: '1524641062997949' },
    { id: 8, fb_post_id: '1524676989661023' },
    { id: 9, fb_post_id: '1525789856216403' },
  ];
  for (const u of updates) {
    await pool.query('UPDATE notas SET fb_post_id = $1 WHERE id = $2', [u.fb_post_id, u.id]);
    console.log('Actualizado nota', u.id, '->', u.fb_post_id);
  }
  await pool.end();
}

run().catch(console.error);
