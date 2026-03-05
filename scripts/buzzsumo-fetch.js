const https = require('https');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:shHjrZCGZPVUEpCeVoaHaXJtOIyCNAfu@hopper.proxy.rlwy.net:16672/railway'
});

const desde = Math.floor(Date.now()/1000) - (365*2*24*60*60);
const hasta = Math.floor(Date.now()/1000);

const keywords = [
  'abuelito OR abuelita OR anciano OR anciana',
  'emotivo OR emotiva OR conmovedor OR conmovedora',
  'increíble OR impactante OR sorprendente',
  '"la verdadera historia" OR "historia real"',
  'viral',
  'jubilado OR pensionado OR "tercera edad"',
  '"se arrepiente" OR confiesa',
  '"récord mundial"',
  'hallazgo OR descubrimiento',
  'gato OR gatos OR perro OR perros OR mascota OR mascotas'
];

const EVAL_PROMPT = `Evaluá si este artículo es apto para un portal de noticias hispanohablante dirigido a personas de 50+ años. Debe ser apto para Facebook y AdSense. Respondé SOLO con JSON sin markdown: {"apto": true/false, "razon": "breve razón"}

Rechazá SOLO si:
- Es sobre un famoso reconocido internacionalmente (actor, cantante, político, deportista profesional)
- Es sobre crimen violento, muerte o catástrofes
- Es contenido político partidario
- La URL es de YouTube, TikTok, Instagram, Twitter o Facebook
- Es claramente un anuncio o spam
- Es una recomendación de película, serie o contenido de streaming (Netflix, HBO, Disney+, etc.)

Aprobá si:
- Es una historia humana emotiva, curiosa, polémica o inspiradora
- Es sobre ciencia, naturaleza, animales, historia o curiosidades
- Es sobre personas comunes en situaciones extraordinarias
- Puede ser controversial o polémica pero sin violencia ni política
- El tema es interesante para personas de 50+

Título: [titulo]
URL: [url]`;

function buscar(q, apiKey) {
  return new Promise((resolve) => {
    const query = encodeURIComponent(q);
    const url = 'https://api.buzzsumo.com/search/articles.json?api_key=' + encodeURIComponent(apiKey) + '&q=' + query + '&num_results=5&language=es&sort_type=facebook_shares&video=0&general_article=1&begin_date=' + desde + '&end_date=' + hasta;
    https.get(url, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d).results || []); }
        catch(e) { resolve([]); }
      });
    });
  });
}

async function evaluarConClaude(titulo, url, apiKey) {
  const prompt = EVAL_PROMPT
    .replace('[titulo]', titulo || '')
    .replace('[url]', url || '');
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    const text = data.content?.[0]?.text?.trim() || data.error?.message || '';
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
    } catch {
      return { raw: text };
    }
  } catch (err) {
    return { error: err.message };
  }
}

async function run() {
  const buzzsumoKey = process.env.BUZZSUMO_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!buzzsumoKey) {
    console.error('BUZZSUMO_API_KEY no configurada');
    process.exit(1);
  }
  if (!anthropicKey) {
    console.error('ANTHROPIC_API_KEY no configurada');
    process.exit(1);
  }

  let nuevos = 0;
  let yaExisten = 0;

  for (const kw of keywords) {
    console.log('\n=== ' + kw + ' ===');
    const results = await buscar(kw, buzzsumoKey);
    const filtered = results
      .filter(a => a.total_facebook_shares > 5000)
      .filter(a => !['youtube.com','tiktok.com','instagram.com','twitter.com','facebook.com'].some(d => a.url.includes(d)))
      .filter(a => !a.url.match(/\/videos?\//i));
    for (const a of filtered) {
      console.log('  ' + a.total_facebook_shares + ' FB | ' + a.title + '\n  ' + a.url);
      const evalResult = await evaluarConClaude(a.title, a.url, anthropicKey);
      if (evalResult.error) {
        console.log('  Evaluación: ERROR', evalResult.error);
      } else if (evalResult.apto === true) {
        console.log('  Evaluación: apto=true' + (evalResult.razon ? ', razon: ' + evalResult.razon : ''));
        const res = await pool.query(
          'INSERT INTO candidatos_buzzsumo (titulo, url, thumbnail, total_facebook_shares, keyword) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (url) DO NOTHING',
          [a.title || '', a.url || '', a.thumbnail || null, a.total_facebook_shares ?? 0, kw]
        );
        if (res.rowCount === 1) nuevos++;
        else yaExisten++;
      } else {
        console.log('  Evaluación: apto=' + evalResult.apto + (evalResult.razon ? ', razon: ' + evalResult.razon : ''));
      }
      await new Promise(r => setTimeout(r, 500));
    }
    await new Promise(r => setTimeout(r, 800));
  }

  await pool.end();
  console.log('\n' + nuevos + ' candidatos nuevos guardados, ' + yaExisten + ' ya existían');
}

run().catch((err) => { console.error(err); process.exit(1); });
