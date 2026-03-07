const { Client } = require("pg");

const CONNECTION_STRING =
  "postgresql://postgres:shHjrZCGZPVUEpCeVoaHaXJtOIyCNAfu@hopper.proxy.rlwy.net:16672/railway";

const SLUG_PRIMERA = "clientes-aparcaban-en-sus-tierras-lo-que-hizo-fue-legendario";
const SLUG_SEGUNDA = "agricultor-cansado-crea-trampa-magistral-contra-invasores";

async function main() {
  const client = new Client({ connectionString: CONNECTION_STRING });
  await client.connect();
  console.log("1. Conectado a la DB.");

  const resPrimera = await client.query(
    "SELECT id FROM stories WHERE slug = $1",
    [SLUG_PRIMERA]
  );
  if (resPrimera.rows.length === 0) {
    console.error("No se encontró la story con slug:", SLUG_PRIMERA);
    await client.end();
    process.exit(1);
  }
  const idPrimera = resPrimera.rows[0].id;
  console.log("2. Story destino (primera) id:", idPrimera, "slug:", SLUG_PRIMERA);

  const resSegunda = await client.query(
    "SELECT id FROM stories WHERE slug = $1",
    [SLUG_SEGUNDA]
  );
  if (resSegunda.rows.length === 0) {
    console.error("No se encontró la story con slug:", SLUG_SEGUNDA);
    await client.end();
    process.exit(1);
  }
  const idSegunda = resSegunda.rows[0].id;

  const resPaginas = await client.query(
    "SELECT id, numero, imagen_url FROM story_paginas WHERE story_id = $1 ORDER BY numero",
    [idSegunda]
  );
  const paginas = resPaginas.rows;
  console.log("3. Story origen (segunda) id:", idSegunda, "slug:", SLUG_SEGUNDA, "páginas:", paginas.length);

  const updateRes = await client.query(
    "UPDATE story_paginas SET story_id = $1 WHERE story_id = $2",
    [idPrimera, idSegunda]
  );
  console.log("4. Páginas reasignadas a la primera story, filas actualizadas:", updateRes.rowCount);

  const countRes = await client.query(
    "SELECT COUNT(*) AS total FROM story_paginas WHERE story_id = $1",
    [idPrimera]
  );
  const totalPaginas = parseInt(countRes.rows[0].total, 10);
  await client.query(
    "UPDATE stories SET total_paginas = $1 WHERE id = $2",
    [totalPaginas, idPrimera]
  );
  console.log("5. total_paginas de la primera story actualizado a:", totalPaginas);

  await client.query("DELETE FROM stories WHERE id = $1", [idSegunda]);
  console.log("6. Story segunda (id:", idSegunda, ") eliminada.");

  await client.end();
  console.log("7. Listo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
