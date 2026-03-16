require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fb_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("OK: tabla fb_config creada");

  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (token) {
    await pool.query(
      `INSERT INTO fb_config (key, value) VALUES ('page_access_token', $1)
       ON CONFLICT (key) DO NOTHING`,
      [token]
    );
    console.log("OK: page_access_token insertado (o ya existía)");
  } else {
    console.log("Skip: FB_PAGE_ACCESS_TOKEN no definido, no se inserta token inicial");
  }

  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
