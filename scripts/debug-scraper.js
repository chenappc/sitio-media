/**
 * Script temporal para debug del scraper de stories.
 * Usa la misma lógica de imagen y párrafos que app/api/stories/scrape/route.ts
 * Uso: node scripts/debug-scraper.js
 */
const cheerio = require("cheerio");

const URL = "https://www.consejosytrucos.co/online/es-farmerrevenge/1/";

const UA = "Mozilla/5.0 (compatible; sitio-media-bot/1.0)";
const CODE_OR_NOISE = /JavaScript|CSS|código|script|function\(|var\s|const\s|let\s|\{|\}|querySelector|getElementById/i;

function filterParrafos(arr) {
  return arr.filter((p) => {
    const t = p.trim();
    if (t.length < 30) return false;
    if (CODE_OR_NOISE.test(t)) return false;
    return true;
  });
}

async function main() {
  console.log("Fetching:", URL);
  const res = await fetch(URL, { headers: { "User-Agent": UA } });
  const html = await res.text();
  const $ = cheerio.load(html);
  const url = URL;

  console.log("\n--- H1 (texto completo) ---");
  const h1Text = $("h1").first().text().trim();
  console.log(h1Text || "(vacío)");

  console.log("\n--- Primeros 3 H2 ---");
  $("h2").slice(0, 3).each((i, el) => {
    console.log(`  [${i}]`, $(el).text().trim());
  });

  console.log("\n--- Primeras 6 imágenes (todos los atributos y clases) ---");
  $("img").slice(0, 6).each((i, el) => {
    const attrs = el.attribs || {};
    console.log(`\n[${i}]`, JSON.stringify(attrs, null, 2).replace(/\n/g, "\n    "));
  });

  console.log("\n--- strong y b (texto) ---");
  $("strong, b").each((i, el) => {
    const t = $(el).text().trim();
    if (t) console.log(`  [${i}]`, t);
  });

  console.log("\n--- H3 (texto) ---");
  $("h3").each((i, el) => {
    console.log(`  [${i}]`, $(el).text().trim());
  });

  console.log("\n--- Imágenes con clase wp-image (todas) ---");
  $('img[class*="wp-image"]').each((i, el) => {
    const attrs = el.attribs || {};
    console.log(`\n[${i}]`, JSON.stringify(attrs, null, 2).replace(/\n/g, "\n    "));
  });

  // Misma lógica de imagen que el scraper
  let imagenPrincipal = null;
  const imgClassContent = /entry-thumb|post-thumbnail|wp-post-image|featured|attachment/i;
  $("img").each((_, el) => {
    if (imagenPrincipal) return;
    const cls = $(el).attr("class") || "";
    const src =
      $(el).attr("data-layzr") ||
      $(el).attr("data-lazy-src") ||
      $(el).attr("data-src") ||
      $(el).attr("src") ||
      "";
    if (!src) return;
    if (src.startsWith("data:")) return;
    if (/logo|icon|avatar|sprite|pixel|1x1|tracking|badge|button/i.test(src)) return;
    if (/logo|icon|avatar/i.test(cls)) return;
    if (!imgClassContent.test(cls)) return;
    try {
      imagenPrincipal = new URL(src, url).href;
    } catch {
      imagenPrincipal = src;
    }
  });
  if (!imagenPrincipal) {
    $("img").each((_, el) => {
      if (imagenPrincipal) return;
      const src =
        $(el).attr("data-layzr") ||
        $(el).attr("data-lazy-src") ||
        $(el).attr("data-src") ||
        $(el).attr("src") ||
        "";
      if (!src) return;
      if (src.startsWith("data:")) return;
      if (/logo|icon|avatar|sprite|pixel|1x1|tracking|badge|button/i.test(src)) return;
      if (/logo|icon|avatar/i.test($(el).attr("class") || "")) return;
      try {
        imagenPrincipal = new URL(src, url).href;
      } catch {
        imagenPrincipal = src;
      }
    });
  }

  console.log("\n--- Imagen seleccionada (entry-thumb primero, luego fallback) ---");
  if (imagenPrincipal) {
    console.log(imagenPrincipal);
  } else {
    console.log("(ninguna)");
  }

  // Misma lógica de párrafos que el scraper
  const parrafosRaw = [];
  $("p").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length >= 50) parrafosRaw.push(text);
  });
  if (parrafosRaw.length < 2) {
    const contentSelectors = [".entry-content p", ".post-content p", ".td-post-content p", "article p"];
    for (const sel of contentSelectors) {
      $(sel).each((_, el) => {
        const text = $(el).text().trim();
        if (text.length >= 50) parrafosRaw.push(text);
      });
      if (parrafosRaw.length >= 2) break;
    }
  }
  if (parrafosRaw.length < 2) {
    const divSelectors = [".entry-content div", ".post-content div"];
    for (const sel of divSelectors) {
      $(sel).each((_, el) => {
        const text = $(el).text().trim();
        if (text.length >= 50 && !CODE_OR_NOISE.test(text)) parrafosRaw.push(text);
      });
      if (parrafosRaw.length >= 2) break;
    }
  }

  const parrafosFiltrados = filterParrafos(parrafosRaw);

  console.log("\n--- Los 2 párrafos que encontró ---");
  parrafosFiltrados.slice(0, 2).forEach((p, i) => {
    console.log(`\n[${i + 1}]`, p);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
