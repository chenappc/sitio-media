require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ADSENSE_RULE = `CONTENT SUITABLE FOR ADSENSE AND FACEBOOK: The curated article must strictly comply with Google AdSense and Facebook Ads content policies. PROHIBITED: explicit mention of rape, sexual abuse, cannibalism, pedophilia, torture, suicide, self-harm, pornography, illegal drugs, firearms in violent context, or any sexually explicit content. If the original contains these elements, REPLACE them with softened versions that maintain the story essence. Use empathetic language for death: "passed away", "left this world". Always transform the focus toward the emotional and human.`;

async function traducirConClaude(titulo, parrafos) {
  const payload = { titulo, parrafos };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `${ADSENSE_RULE}
Translate and rewrite this content into natural, engaging English. Keep the same meaning and emotional tone. Short catchy title. Return ONLY a JSON: { "titulo": "string", "parrafos": ["string", ...] }.
${JSON.stringify(payload)}`
      }],
    }),
  });
  const data = await res.json();
  const text = (data.content?.[0]?.text ?? '').trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Claude no devolvió JSON válido');
  return JSON.parse(match[0]);
}

function slugify(text) {
  return text.toLowerCase()
    .replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i').replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
    .replace(/-+/g, '-').replace(/^-|-$/g, '');
}

async function main() {
  // Traer todas las stories en español publicadas
  const { rows: stories } = await pool.query(
    `SELECT id, slug, titulo, total_paginas FROM stories WHERE idioma = 'es' AND status = 'published' ORDER BY id ASC`
  );
  console.log(`Stories en español encontradas: ${stories.length}`);

  for (const story of stories) {
    console.log(`\nProcessing: ${story.titulo}`);

    // Traer páginas
    const { rows: paginas } = await pool.query(
      `SELECT numero, imagen_url, parrafos FROM story_paginas WHERE story_id = $1 ORDER BY numero ASC`,
      [story.id]
    );

    // Traducir título de la story
    let tituloEn = story.titulo;
    try {
      const primeraPagina = paginas[0];
      const traduccion = await traducirConClaude(story.titulo, primeraPagina?.parrafos ?? []);
      tituloEn = traduccion.titulo;
    } catch (e) {
      console.error(`Error traduciendo título: ${e.message}`);
    }

    // Generar slug único en inglés
    let slugBase = slugify(tituloEn) || story.slug + '-en';
    let slug = slugBase;
    let n = 0;
    for (;;) {
      const { rows } = await pool.query('SELECT 1 FROM stories WHERE slug = $1', [slug]);
      if (rows.length === 0) break;
      n++;
      slug = `${slugBase}-${n}`;
    }

    // Crear story en inglés
    const { rows: newStory } = await pool.query(
      `INSERT INTO stories (slug, titulo, status, total_paginas, url_base, idioma)
       VALUES ($1, $2, 'published', $3, $4, 'en') RETURNING id`,
      [slug, tituloEn, story.total_paginas, null]
    );
    const newStoryId = newStory[0].id;
    console.log(`Story EN creada: ${slug} (id: ${newStoryId})`);

    // Traducir y crear páginas
    for (const pagina of paginas) {
      let parrafosEn = pagina.parrafos;
      try {
        const traduccion = await traducirConClaude('', pagina.parrafos);
        parrafosEn = traduccion.parrafos;
      } catch (e) {
        console.error(`Error traduciendo página ${pagina.numero}: ${e.message}`);
      }

      await pool.query(
        `INSERT INTO story_paginas (story_id, numero, imagen_url, parrafos)
         VALUES ($1, $2, $3, $4)`,
        [newStoryId, pagina.numero, pagina.imagen_url, JSON.stringify(parrafosEn)]
      );
      console.log(`  Página ${pagina.numero} traducida`);

      // Pausa para no saturar la API
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log('\n✅ Traducción completada');
  pool.end();
}

main().catch(e => { console.error(e); pool.end(); });
