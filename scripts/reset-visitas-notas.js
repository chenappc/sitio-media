require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool
  .query("UPDATE notas SET visitas = 0")
  .then((res) => {
    console.log("Filas actualizadas:", res.rowCount);
    pool.end();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
