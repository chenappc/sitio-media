require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const r1 = await pool.query("DELETE FROM campanas WHERE fb_adset_id = '120243867143800740'");
  console.log("DELETE adset 120243867143800740: filas eliminadas =", r1.rowCount);

  const r2 = await pool.query(`
    DELETE FROM campanas
    WHERE fb_adset_id = '120243867116490740'
      AND id NOT IN (
        SELECT id FROM campanas
        WHERE fb_adset_id = '120243867116490740'
        ORDER BY id ASC
        LIMIT 6
      )
  `);
  console.log("DELETE extras del adset 120243867116490740 (dejar solo 6): filas eliminadas =", r2.rowCount);

  pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
