require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const ADSENSE_RULE = `CONTENT SUITABLE FOR ADSENSE AND FACEBOOK: The curated article must strictly comply with Google AdSense and Facebook Ads content policies. PROHIBITED: explicit mention of rape, sexual abuse, cannibalism, pedophilia, torture, suicide, self-harm, pornography, illegal drugs, firearms in violent context, or any sexually explicit content. If the original contains these elements, REPLACE them with softened versions. Use empathetic language for death: "passed away", "left this world". Always transform the focus toward the emotional and human.`;

async function traducirConClaude(titulo, entradilla, cuerpo) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `${ADSENSE_RULE}
Translate and rewrite this viral news article into natural, engaging English. Keep the same meaning and emotional tone. Viral, intriguing title max 12 words. Return ONLY a JSON: { "titulo": "string", "entradilla": "string", "cuerpo": "string" }.
${JSON.stringify({ titulo, entradilla, cuerpo })}`
      }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const text = (data.content?.[0]?.text ?? '').trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON found');
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
  const { rows: notas } = await pool.query(
    `SELECT id, slug, titulo, entradilla, cuerpo, imagen_url, imagen2_url, imagen_alt, fuente_nombre, fuente_url, pais FROM notas WHERE idioma = 'es' AND publicado = true ORDER BY id ASC`
  );
  console.log(`Notas en español: ${notas.length}`);

  for (const nota of notas) {
    console.log(`\nTraduciendo: ${nota.titulo}`);
    let traduccion;
    try {
      traduccion = await traducirConClaude(nota.titulo, nota.entradilla, nota.cuerpo);
    } catch (e) {
      console.error(`Error: ${e.message}`);
      continue;
    }

    // Generar slug único
    let slugBase = slugify(traduccion.titulo) || nota.slug + '-en';
    let slug = slugBase;
    let n = 0;
    for (;;) {
      const { rows } = await pool.query('SELECT 1 FROM notas WHERE slug = $1', [slug]);
      if (rows.length === 0) break;
      n++;
      slug = `${slugBase}-${n}`;
    }

    try {
      await pool.query(
        `INSERT INTO notas (slug, titulo, entradilla, cuerpo, imagen_url, imagen2_url, imagen_alt, fuente_nombre, fuente_url, pais, publicado, idioma)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, 'en')`,
        [slug, traduccion.titulo, traduccion.entradilla, traduccion.cuerpo, nota.imagen_url, nota.imagen2_url, nota.imagen_alt, nota.fuente_nombre, nota.fuente_url, nota.pais]
      );
      console.log(`✅ ${slug}`);
    } catch (e) {
      console.error(`Error DB: ${e.message}`);
    }

    await new Promise(r => setTimeout(r, 800));
  }

  console.log('\n✅ Traducción completada');
  pool.end();
}

main().catch(e => { console.error(e); pool.end(); });
