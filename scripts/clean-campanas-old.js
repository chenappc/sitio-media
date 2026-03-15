require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const query = `DELETE FROM campanas WHERE fb_adset_id IN (SELECT fb_adset_id FROM campanas WHERE fb_adset_id IS NOT NULL) AND nota_id IN (SELECT id FROM notas)`;

pool
  .query(query)
  .then((res) => {
    console.log("Filas eliminadas:", res.rowCount);
    pool.end();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
