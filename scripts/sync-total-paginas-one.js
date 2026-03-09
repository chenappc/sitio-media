require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const slug = "joyero-descubre-verdad-oscura-escondida-en-anillo-de-diamantes";

pool
  .query(
    `UPDATE stories 
SET total_paginas = (SELECT COUNT(*) FROM story_paginas WHERE story_id = stories.id)
WHERE slug = $1`,
    [slug]
  )
  .then((res) => {
    console.log("Updated rows:", res.rowCount);
    pool.end();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
