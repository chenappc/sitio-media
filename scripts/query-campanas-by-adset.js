require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const query = `SELECT fb_adset_id, COUNT(*) as total FROM campanas WHERE fb_adset_id IS NOT NULL GROUP BY fb_adset_id ORDER BY fb_adset_id`;

pool
  .query(query)
  .then((res) => {
    console.log("fb_adset_id | total");
    console.log("------------|-----");
    res.rows.forEach((row) => console.log(row.fb_adset_id, "|", row.total));
    console.log("-- Filas:", res.rows.length);
    pool.end();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
