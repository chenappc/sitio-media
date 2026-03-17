/**
 * Script temporal para debug del scraper de stories.
 * Usa la misma lógica de imagen y párrafos que app/api/stories/scrape/route.ts
 * Uso: node scripts/debug-scraper.js
 */
const cheerio = require("cheerio");

const URL =
  "https://kingbuiltbullies.com/las-estrellas-de-los-80-celebridades-que-transformaron-hollywood-y-dejaron-una-huella-historica/1/";

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

  console.log("\n--- H1 ---");
  const h1s = $("h1").toArray();
  console.log("Total h1:", h1s.length);
  h1s.forEach((el, i) => {
    console.log(`  [${i}]`, $(el).text().trim());
  });

  console.log("\n--- H2 ---");
  const h2s = $("h2").toArray();
  console.log("Total h2:", h2s.length);
  h2s.forEach((el, i) => {
    console.log(`  [${i}]`, $(el).text().trim());
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

  console.log("\n--- Imagen principal (lógica del scraper) ---");
  if (imagenPrincipal) {
    console.log("  URL:", imagenPrincipal);
  } else {
    console.log("  (ninguna imagen elegida)");
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

  console.log("\n--- Párrafos (parrafosRaw, luego filterParrafos) ---");
  console.log("Total parrafosRaw (>= 50 chars):", parrafosRaw.length);
  console.log("Total después de filterParrafos:", parrafosFiltrados.length);
  parrafosFiltrados.slice(0, 5).forEach((p, i) => {
    console.log(`  [${i}] (${p.length} chars)`, p.slice(0, 80) + (p.length > 80 ? "..." : ""));
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
