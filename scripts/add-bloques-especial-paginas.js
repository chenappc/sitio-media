require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  await pool.query(`
    ALTER TABLE especial_paginas ADD COLUMN IF NOT EXISTS bloques JSONB DEFAULT '[]'
  `);
  console.log("Columna bloques agregada (o ya existía).");
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
