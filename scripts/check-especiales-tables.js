require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  const res = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('especiales', 'especial_paginas')
  `);
  console.log("Tablas encontradas:", res.rows);
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
