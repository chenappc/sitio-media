require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  await pool.query("ALTER TABLE notas ADD COLUMN IF NOT EXISTS fb_ad_id TEXT");
  console.log("OK: fb_ad_id");
  await pool.query("ALTER TABLE notas ADD COLUMN IF NOT EXISTS fb_adset_id TEXT");
  console.log("OK: fb_adset_id");
  pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
