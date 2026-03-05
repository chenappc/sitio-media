const https = require('https');
const desde = Math.floor(Date.now()/1000) - (365*2*24*60*60);
const hasta = Math.floor(Date.now()/1000);

const keywords = [
  'abuelito OR abuelita OR anciano OR anciana',
  'emotivo OR emotiva OR conmovedor OR conmovedora',
  'increíble OR impactante OR sorprendente',
  '"la verdadera historia" OR "historia real"',
  'viral',
  'jubilado OR pensionado OR "tercera edad"',
  '"años de matrimonio" OR "años juntos"',
  '"estudio revela" OR "ciencia descubre"',
  '"cumplió su sueño" OR "sueño cumplido"',
  '"se arrepiente" OR confiesa',
  '"récord mundial"',
  '"remedio natural" OR "planta medicinal"',
  'hallazgo OR descubrimiento',
  '"animal salva" OR "perro salva" OR "gato salva"'
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

function buscar(q) {
  return new Promise((resolve) => {
    const query = encodeURIComponent(q);
    const url = 'https://api.buzzsumo.com/search/articles.json?api_key=E8TgdRL154qd5VsPCVITAcQgMm32Gsl6&q=' + query + '&num_results=5&language=es&sort_type=facebook_shares&video=0&general_article=1&begin_date=' + desde + '&end_date=' + hasta;
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

async function evaluarConClaude(titulo, url) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { error: 'ANTHROPIC_API_KEY no configurada' };
  }
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
  for (const kw of keywords) {
    console.log('\n=== ' + kw + ' ===');
    const results = await buscar(kw);
    const filtered = results
      .filter(a => a.total_facebook_shares > 5000)
      .filter(a => !['youtube.com','tiktok.com','instagram.com','twitter.com','facebook.com'].some(d => a.url.includes(d)))
      .filter(a => !a.url.match(/\/videos?\//i));
    for (const a of filtered) {
      console.log('  ' + a.total_facebook_shares + ' FB | ' + a.title + '\n  ' + a.url);
      const evalResult = await evaluarConClaude(a.title, a.url);
      if (evalResult.error) {
        console.log('  Evaluación: ERROR', evalResult.error);
      } else if (evalResult.apto !== undefined) {
        console.log('  Evaluación: apto=' + evalResult.apto + (evalResult.razon ? ', razon: ' + evalResult.razon : ''));
      } else {
        console.log('  Evaluación:', JSON.stringify(evalResult));
      }
      await new Promise(r => setTimeout(r, 500));
    }
    await new Promise(r => setTimeout(r, 800));
  }
}

run();
