import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { Readable } from "stream";
import cloudinary from "@/lib/cloudinary";
import pool from "@/lib/db";
import { createEspecial, addEspecialPagina } from "@/lib/especiales";
import slugify from "slugify";

const ADMIN_SECRET = process.env.ADMIN_SECRET;
const UA = "Mozilla/5.0 (compatible; sitio-media-bot/1.0)";

const CODE_OR_NOISE = /JavaScript|CSS|código|script|function\(|var\s|const\s|let\s|\{|\}|querySelector|getElementById/i;
const PARRAFO_SKIP =
  /copyright|©|all rights reserved|reservados|footer|credits|créditos|cookie|subscribe|newsletter|leave a reply/i;
const IMG_SKIP = /logo|icon|avatar|sprite|pixel|1x1|tracking|badge|button/i;
const MAX_ITEMS = 50;

const ADSENSE_FACEBOOK_RULE = `CONTENIDO APTO PARA ADSENSE Y FACEBOOK: El artículo curado debe cumplir estrictamente las políticas de contenido de Google AdSense y Facebook Ads. Esto significa:
- PROHIBIDO mencionar explícitamente: violación, abuso sexual, canibalismo, pedofilia, torturas, suicidio, automutilación, pornografía, drogas ilegales, armas de fuego en contexto violento, o cualquier contenido sexualmente explícito.
- Si el artículo original contiene estos elementos, debés REEMPLAZARLOS por versiones suavizadas que mantengan la esencia de la historia sin mencionar los elementos prohibidos. Por ejemplo: 'abuso' → 'encuentro no deseado', 'canibalismo' → 'acto macabro', 'violación' → omitir o referir como 'fue aprovechada mientras dormía'.
- Cuando el artículo mencione muerte, enfermedad, pérdida o situaciones oscuras, usá lenguaje empático: 'falleció', 'partió', 'dejó este mundo' en lugar de 'murió'. Evitá detalles gráficos o perturbadores.
- Transformá siempre el enfoque hacia lo emotivo y humano.`;

function filterParrafos(arr: string[]): string[] {
  return arr.filter((p) => {
    const t = p.trim();
    if (t.length < 50) return false;
    if (CODE_OR_NOISE.test(t)) return false;
    if (PARRAFO_SKIP.test(t)) return false;
    return true;
  });
}

function isParagraphValid(text: string): boolean {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length < 50) return false;
  if (PARRAFO_SKIP.test(t)) return false;
  if (CODE_OR_NOISE.test(t)) return false;
  return true;
}

function isParagraphLong(text: string): boolean {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 100 && isParagraphValid(text);
}

function isImageValid($: cheerio.CheerioAPI, el: unknown, src: string): boolean {
  if (!src || src.startsWith("data:")) return false;
  if (IMG_SKIP.test(src)) return false;
  const $el = $(el as Parameters<typeof $>[0]);
  if (/logo|icon|avatar/i.test($el.attr("class") || "")) return false;
  return true;
}

function auth(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret");
  return !!ADMIN_SECRET && secret === ADMIN_SECRET;
}

function sseMessage(obj: object): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

type Bloque = { tipo: "imagen"; url: string } | { tipo: "parrafo"; texto: string };
type RawItem = { titulo: string; bloques: Bloque[]; imagenUrl: string | null };

function parrafosFromBloques(bloques: Bloque[]): string[] {
  return bloques.filter((b): b is { tipo: "parrafo"; texto: string } => b.tipo === "parrafo").map((b) => b.texto);
}

/** Resuelve src de una img y normaliza URL. */
function resolveImgSrc($: cheerio.CheerioAPI, el: unknown, baseUrl: string): string | null {
  const $el = $(el as Parameters<typeof $>[0]);
  const src =
    $el.attr("data-layzr") ||
    $el.attr("data-lazy-src") ||
    $el.attr("data-src") ||
    $el.attr("src") ||
    "";
  if (!src || !isImageValid($, el, src)) return null;
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return src;
  }
}

/** ESTRATEGIA 1 — Headings: h2/h3/h4, título = heading, bloques = primera imagen + párrafos hasta el siguiente heading. */
function extraerPorHeadings($: cheerio.CheerioAPI, baseUrl: string): RawItem[] {
  const items: RawItem[] = [];
  const headings = $("h2, h3, h4").toArray();
  for (let i = 0; i < headings.length && items.length < MAX_ITEMS; i++) {
    const el = headings[i];
    const $el = $(el);
    const titulo = $el.text().trim();
    if (!titulo || titulo.length < 2) continue;
    const nextHeading = headings[i + 1];
    const $block = nextHeading ? $el.nextUntil($(nextHeading)) : $el.nextAll();
    const bloques: Bloque[] = [];
    let imagenUrl: string | null = null;
    const $firstImg = $block.find("img").first().length ? $block.find("img").first() : $block.filter("img").first();
    const src =
      $firstImg.attr("data-layzr") ||
      $firstImg.attr("data-lazy-src") ||
      $firstImg.attr("data-src") ||
      $firstImg.attr("src") ||
      "";
    const imgEl = $firstImg.length ? $firstImg[0] : null;
    if (src && imgEl && isImageValid($, imgEl, src)) {
      try {
        imagenUrl = new URL(src, baseUrl).href;
        bloques.push({ tipo: "imagen", url: imagenUrl });
      } catch {
        imagenUrl = src;
        bloques.push({ tipo: "imagen", url: src });
      }
    }
    $block.find("p").each((_, p) => {
      const t = $(p).text().trim();
      if (isParagraphValid(t)) {
        const filtered = filterParrafos([t]);
        if (filtered.length > 0) bloques.push({ tipo: "parrafo", texto: filtered[0] });
      }
    });
    items.push({ titulo, bloques, imagenUrl });
  }
  return items.slice(0, MAX_ITEMS);
}

/** ESTRATEGIA 2 — Orden DOM: recorrer body en orden; cada imagen válida inicia ítem; párrafos e imágenes siguientes se agregan como bloques. */
function extraerPorImagenes($: cheerio.CheerioAPI, baseUrl: string): RawItem[] {
  const items: RawItem[] = [];
  const elements = $("body").find("img, p").toArray();
  let leadingBloques: Bloque[] = [];
  let currentItem: RawItem | null = null;

  for (const el of elements) {
    if (items.length >= MAX_ITEMS) break;
    const tagName = (el as { name?: string }).name ?? "";
    if (tagName === "img") {
      const url = resolveImgSrc($, el, baseUrl);
      if (url != null) {
        if (leadingBloques.length > 0 && items.length === 0) {
          const firstP = leadingBloques.find((b): b is { tipo: "parrafo"; texto: string } => b.tipo === "parrafo");
          const titulo = firstP ? firstP.texto.slice(0, 80).trim() : "";
          items.push({ titulo: titulo || "", bloques: leadingBloques, imagenUrl: null });
          leadingBloques = [];
        }
        currentItem = { titulo: "", bloques: [{ tipo: "imagen", url }], imagenUrl: url };
        items.push(currentItem);
      }
    } else if (tagName === "p") {
      const text = $(el).text().trim().replace(/\s+/g, " ");
      if (!isParagraphValid(text)) continue;
      const filtered = filterParrafos([text]);
      if (filtered.length === 0) continue;
      const bloque: Bloque = { tipo: "parrafo", texto: filtered[0] };
      if (currentItem != null) {
        currentItem.bloques.push(bloque);
        if (!currentItem.titulo) currentItem.titulo = filtered[0].slice(0, 80).trim();
      } else {
        leadingBloques.push(bloque);
      }
    }
  }
  for (const it of items) {
    if (!it.titulo) {
      const firstP = it.bloques.find((b): b is { tipo: "parrafo"; texto: string } => b.tipo === "parrafo");
      if (firstP) it.titulo = firstP.texto.slice(0, 80).trim();
    }
  }
  return items.slice(0, MAX_ITEMS);
}

/** ESTRATEGIA 3 — Solo párrafos: párrafos > 100 chars agrupados en bloques de 2–3 por ítem, sin imagen. */
function extraerPorParrafos($: cheerio.CheerioAPI): RawItem[] {
  const all: string[] = [];
  $("body p").each((_, el) => {
    const t = $(el).text().trim().replace(/\s+/g, " ");
    if (isParagraphLong(t)) all.push(t);
  });
  const filtered = filterParrafos(all);
  const items: RawItem[] = [];
  for (let i = 0; i < filtered.length && items.length < MAX_ITEMS; ) {
    const parrafos = filtered.slice(i, i + 3);
    if (parrafos.length === 0) break;
    const titulo = parrafos[0].slice(0, 80).trim() || "";
    const bloques: Bloque[] = parrafos.map((texto) => ({ tipo: "parrafo" as const, texto }));
    items.push({ titulo, bloques, imagenUrl: null });
    i += parrafos.length;
  }
  return items.slice(0, MAX_ITEMS);
}

/** Intenta extraer ítems desde JSON embebido o APIs (ESTRATEGIA 0). */
async function extraerPorJson(
  html: string,
  $: cheerio.CheerioAPI,
  urlBase: string,
  enq: (obj: object) => void
): Promise<RawItem[]> {
  const items: RawItem[] = [];

  const pushItems = (candidates: RawItem[]) => {
    for (const it of candidates) {
      if (!it) continue;
      if (!it.titulo && (!it.bloques || it.bloques.length === 0)) continue;
      items.push(it);
      if (items.length >= MAX_ITEMS) break;
    }
  };

  const extractFromJsonNode = (node: unknown) => {
    if (!node || items.length >= MAX_ITEMS) return;
    if (Array.isArray(node)) {
      for (const el of node) {
        extractFromJsonNode(el);
        if (items.length >= MAX_ITEMS) break;
      }
      return;
    }
    if (typeof node === "object") {
      const obj = node as Record<string, any>;
      const keys = Object.keys(obj);
      const hasTitle = keys.some((k) => /title|titulo|name/i.test(k));
      const hasContent = keys.some((k) => /content|contenido|body|text|description|descripcion/i.test(k));
      if (hasContent) {
        const getField = (names: RegExp): any => {
          const key = keys.find((k) => names.test(k));
          return key ? obj[key] : undefined;
        };
        const rawTitle = getField(/title|titulo|name/i);
        const rawContent = (() => {
          const c = getField(/content|contenido|body|text/i);
          if (c && typeof c === "object" && typeof c.rendered === "string") return c.rendered;
          return c;
        })();
        const rawDesc = getField(/description|descripcion/i);
        const rawImage = (() => {
          const img = getField(/image|imagen|thumbnail|featured_image|picture/i);
          if (img && typeof img === "object") {
            if (typeof img.url === "string") return img.url;
            if (typeof img.src === "string") return img.src;
          }
          return img;
        })();

        const titulo =
          (typeof rawTitle === "string" && rawTitle.trim()) ||
          (typeof rawDesc === "string" && rawDesc.trim().slice(0, 80)) ||
          "";

        let contenidoTexto = "";
        const elegir = rawContent || rawDesc;
        if (typeof elegir === "string") {
          if (elegir.includes("<")) {
            const $frag = cheerio.load(elegir);
            contenidoTexto = $frag("body").text().trim() || $frag.root().text().trim();
          } else {
            contenidoTexto = elegir;
          }
        }
        const parrafos = filterParrafos(
          contenidoTexto
            .split(/\n{2,}|\r{2,}/)
            .map((s) => s.trim().replace(/\s+/g, " "))
            .filter(Boolean)
        );

        let imagenUrl: string | null = null;
        if (typeof rawImage === "string" && rawImage.trim()) {
          try {
            imagenUrl = new URL(rawImage, urlBase).href;
          } catch {
            imagenUrl = rawImage;
          }
        }

        if (titulo || parrafos.length > 0) {
          const bloques: Bloque[] = [];
          if (imagenUrl) bloques.push({ tipo: "imagen", url: imagenUrl });
          for (const p of parrafos) bloques.push({ tipo: "parrafo", texto: p });
          pushItems([{ titulo: titulo.slice(0, 120), bloques, imagenUrl }]);
        }
      }

      for (const value of Object.values(obj)) {
        extractFromJsonNode(value);
        if (items.length >= MAX_ITEMS) break;
      }
    }
  };

  // 0.1 Scripts JSON embebidos
  try {
    enq({ mensaje: "Estrategia 0: buscando <script type=\"application/json\"> / ld+json..." });
    const scripts = $('script[type="application/json"], script[type="application/ld+json"]').toArray();
    for (const el of scripts) {
      const txt = $(el).html() || "";
      try {
        const json = JSON.parse(txt);
        extractFromJsonNode(json);
        if (items.length >= 2) {
          enq({ mensaje: `Estrategia 0: JSON embebido produjo ${items.length} ítems (parcial)` });
          break;
        }
      } catch {
        // ignorar parseos fallidos
      }
    }
  } catch {
    // ignorar
  }

  // 0.2 Window globals tipo __INITIAL_STATE__ / __NEXT_DATA__ / __REDUX_STATE__
  if (items.length < 2) {
    try {
      enq({ mensaje: "Estrategia 0: buscando window.__INITIAL_STATE__/__NEXT_DATA__/__REDUX_STATE__..." });
      const patterns = [
        /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/,
        /window\.__NEXT_DATA__\s*=\s*({[\s\S]*?});/,
        /window\.__REDUX_STATE__\s*=\s*({[\s\S]*?});/,
      ];
      for (const re of patterns) {
        const match = html.match(re);
        if (match && match[1]) {
          try {
            const json = JSON.parse(match[1]);
            extractFromJsonNode(json);
            enq({ mensaje: `Estrategia 0: encontrado bloque JSON global (${re.source}), ítems acumulados: ${items.length}` });
            if (items.length >= 2) break;
          } catch {
            // seguir con otros patrones
          }
        }
      }
    } catch {
      // ignorar
    }
  }

  // 0.3 WordPress wp-json posts?slug=...
  if (items.length < 2) {
    try {
      const u = new URL(urlBase);
      const path = u.pathname.replace(/\/+$/, "");
      const segs = path.split("/").filter(Boolean);
      const slug = segs[segs.length - 1] || "";
      if (slug) {
        const wpUrl = `${u.origin}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_embed=true`;
        enq({ mensaje: `Estrategia 0: intentando WordPress wp-json: ${wpUrl}` });
        const wpRes = await fetch(wpUrl, { headers: { "User-Agent": UA } });
        if (wpRes.ok) {
          const wpData = (await wpRes.json().catch(() => null)) as
            | { content?: { rendered?: string }; [k: string]: any }[]
            | null;
          if (Array.isArray(wpData) && wpData.length > 0) {
            const post = wpData[0];
            const contentHtml =
              (post.content && typeof post.content.rendered === "string" && post.content.rendered) || "";
            if (contentHtml) {
              const $post = cheerio.load(contentHtml);
              const wpItems = extraerPorImagenes($post, urlBase);
              enq({ mensaje: `Estrategia 0: wp-json devolvió ${wpItems.length} ítems` });
              pushItems(wpItems);
            }
          } else {
            enq({ mensaje: "Estrategia 0: wp-json no devolvió posts para ese slug" });
          }
        } else {
          enq({ mensaje: `Estrategia 0: wp-json status=${wpRes.status}` });
        }
      } else {
        enq({ mensaje: "Estrategia 0: no se pudo determinar slug para wp-json" });
      }
    } catch {
      // ignorar errores de wp-json
    }
  }

  if (items.length >= 2) {
    enq({ mensaje: `Estrategia 0: total ítems JSON/wp-json = ${items.length}` });
  } else {
    enq({ mensaje: `Estrategia 0: no se encontraron al menos 2 ítems (encontrados=${items.length})` });
  }

  return items.slice(0, MAX_ITEMS);
}

export async function POST(req: NextRequest) {
  if (!auth(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let urlBase: string;
  let idioma: string;
  let usarImagenesIA: boolean;
  try {
    const body = await req.json();
    urlBase = String(body.urlBase ?? "").trim();
    idioma = String(body.idioma ?? "es").trim().toLowerCase();
    if (idioma !== "es" && idioma !== "en" && idioma !== "original") idioma = "es";
    usarImagenesIA = Boolean(body.usarImagenesIA ?? body.usarImagenesIa);
    if (!urlBase) {
      return NextResponse.json({ error: "Falta urlBase" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const googleApiKey = process.env.GOOGLE_API_KEY;
  if (!anthropicKey || !googleApiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY o GOOGLE_API_KEY no configuradas" },
      { status: 500 }
    );
  }
  const anthropicKeyStr: string = anthropicKey;
  const googleApiKeyStr: string = googleApiKey;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      let closed = false;
      const enq = (obj: object) => {
        try {
          if (!closed) controller.enqueue(enc.encode(sseMessage(obj)));
        } catch (_) {}
      };
      const close = () => {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch (_) {}
        }
      };
      try {
        enq({ mensaje: "SCRAPER VERSION 2 - con estrategia 0 JSON" });
        enq({ mensaje: "Descargando artículo..." });
        const res = await fetch(urlBase, { headers: { "User-Agent": UA } });
        const html = await res.text();
        const $ = cheerio.load(html);

        const h3Texts = $("h3")
          .toArray()
          .map((el) => $(el).text().trim())
          .filter(Boolean);
        const h4Texts = $("h4")
          .toArray()
          .map((el) => $(el).text().trim())
          .filter(Boolean);
        enq({ mensaje: `Headings encontrados: h3=${h3Texts.length} h4=${h4Texts.length}` });
        if (h3Texts.length > 0) enq({ mensaje: `h3: ${h3Texts.slice(0, 10).join(" | ")}` });
        if (h4Texts.length > 0) enq({ mensaje: `h4: ${h4Texts.slice(0, 10).join(" | ")}` });

        const parrafosPreview = $("p")
          .toArray()
          .map((el) => $(el).text().trim().replace(/\s+/g, " "))
          .filter((t) => t.length > 50)
          .slice(0, 5);
        if (parrafosPreview.length > 0) {
          for (let i = 0; i < parrafosPreview.length; i++) {
            enq({ mensaje: `P${i + 1} preview: ${parrafosPreview[i].slice(0, 500)}` });
          }
        } else {
          enq({ mensaje: "P preview: (ninguno > 50 chars)" });
        }

        const imgsPreview: string[] = [];
        $("img").each((_, el) => {
          if (imgsPreview.length >= 5) return;
          const $img = $(el);
          const src =
            $img.attr("data-layzr") ||
            $img.attr("data-lazy-src") ||
            $img.attr("data-src") ||
            $img.attr("src") ||
            "";
          if (!src) return;
          if (src.startsWith("data:")) return;
          if (/logo|icon|avatar|sprite|pixel|1x1|tracking|badge|button/i.test(src)) return;
          try {
            imgsPreview.push(new URL(src, urlBase).href);
          } catch {
            imgsPreview.push(src);
          }
        });
        enq({ mensaje: `IMG src (primeras 5): ${imgsPreview.join(" | ") || "(ninguna)"}` });

        let articuloTitulo = ($("h1").first().text() || $("title").text() || "Especial").trim();
        if (idioma !== "original" && articuloTitulo) {
          try {
            enq({ mensaje: "Curando título principal con Claude..." });
            const prompt =
              idioma === "es"
                ? `${ADSENSE_FACEBOOK_RULE}

Reescribí este título por completo en español neutro latinoamericano. Usá 'ustedes' en lugar de 'vosotros', conjugaciones sin voseo español ('saben' no 'sabéis', 'pueden' no 'podéis'). Debe sonar natural para lectores de cualquier país de América Latina. Debe ser intrigante, viral, máximo 12 palabras. No copies el original. Devolvé SOLO el título reescrito, sin comillas ni explicación.

Título original: ${articuloTitulo}`
                : `${ADSENSE_FACEBOOK_RULE}

Rewrite this title completely. It must be intriguing, viral, max 12 words, in English. Do not copy the original. Return ONLY the rewritten title, no quotes or explanation.

Original title: ${articuloTitulo}`;
            const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": anthropicKeyStr,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 256,
                messages: [{ role: "user", content: prompt }],
              }),
            });
            const data = await claudeRes.json().catch(() => ({}));
            const text = (data.content?.[0]?.text ?? "").trim().replace(/^["']|["']$/g, "");
            if (text) articuloTitulo = text;
          } catch {
            // mantener título original
          }
        }
        let items: RawItem[] = [];
        let estrategiaUsada = "";

        // Estrategia 0: JSON embebido / APIs antes que nada
        const items0 = await extraerPorJson(html, $, urlBase, enq);
        if (items0.length >= 2) {
          items = items0;
          estrategiaUsada = "JSON embebido / APIs (Estrategia 0)";
        }

        // Estrategia 1: Headings
        if (items.length === 0) {
          const items1 = extraerPorHeadings($, urlBase);
          if (items1.length >= 2) {
            items = items1;
            estrategiaUsada = "Headings (h2/h3/h4)";
          }
        }

        // Estrategia 2: Imagen + párrafos
        if (items.length === 0) {
          enq({ mensaje: "Estrategia 1 (Headings) insuficiente; probando Estrategia 2 (imagen+párrafos)..." });
          const items2 = extraerPorImagenes($, urlBase);
          if (items2.length >= 2) {
            items = items2;
            estrategiaUsada = "Bloques imagen+texto";
          }
        }

        // Estrategia 3: Solo párrafos
        if (items.length === 0) {
          enq({ mensaje: "Estrategia 2 insuficiente; probando Estrategia 3 (solo párrafos)..." });
          const items3 = extraerPorParrafos($);
          if (items3.length >= 2) {
            items = items3;
            estrategiaUsada = "Solo párrafos";
          }
        }

        if (items.length === 0) {
          enq({ status: "error", mensaje: "Ninguna estrategia devolvió al menos 2 ítems" });
          close();
          return;
        }
        enq({ mensaje: `Estrategia usada: ${estrategiaUsada}. Ítems: ${items.length}` });

        const total = items.length;
        const baseSlug = slugify(articuloTitulo, { lower: true, strict: true }) || "especial";
        let slug = baseSlug;
        let n = 0;
        for (;;) {
          const exists = await pool.query("SELECT 1 FROM especiales WHERE slug = $1", [slug]);
          if (exists.rows.length === 0) break;
          n++;
          slug = `${baseSlug}-${n}`;
        }

        const especialId = await createEspecial(slug, articuloTitulo, total, urlBase, idioma, usarImagenesIA);
        enq({ mensaje: `Especial creado: ${slug}. Procesando ${total} ítems...` });

        for (let idx = 0; idx < items.length; idx++) {
          const numero = idx + 1;
          const item = items[idx];
          let tituloItem = item.titulo;
          let bloques: Bloque[] = [...item.bloques];
          let parrafos: string[] = parrafosFromBloques(bloques);

          if (idioma !== "original" && (item.titulo || parrafos.length > 0)) {
            try {
              enq({ mensaje: `Claude: reescribiendo ítem ${numero}...` });
              const langInstruction =
                idioma === "es"
                  ? "Reescribí en español neutro latinoamericano. Usá 'ustedes' en lugar de 'vosotros', conjugaciones sin voseo español ('saben' no 'sabéis', 'pueden' no 'podéis'). Debe sonar natural para lectores de cualquier país de América Latina. Manteniendo el sentido. Título breve y atractivo; párrafos claros."
                  : "Rewrite in English, keeping the same meaning. Short catchy title; clear paragraphs.";
              const payload = { titulo: item.titulo, parrafos };
              const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-api-key": anthropicKeyStr,
                  "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify({
                  model: "claude-haiku-4-5-20251001",
                  max_tokens: 2048,
                  messages: [
                    {
                      role: "user",
                      content: `${ADSENSE_FACEBOOK_RULE}

${langInstruction} Devolvé SOLO un JSON: { "titulo": "string", "parrafos": ["string", ...] }.

${JSON.stringify(payload)}`,
                    },
                  ],
                }),
              });
              const data = await claudeRes.json().catch(() => ({}));
              const text = (data.content?.[0]?.text ?? "").trim();
              const objMatch = text.match(/\{[\s\S]*\}/);
              if (objMatch) {
                const parsed = JSON.parse(objMatch[0]) as { titulo?: string; parrafos?: string[] };
                if (typeof parsed.titulo === "string" && parsed.titulo.trim()) tituloItem = parsed.titulo.trim();
                if (Array.isArray(parsed.parrafos)) parrafos = parsed.parrafos.filter((x): x is string => typeof x === "string");
                let pi = 0;
                bloques = item.bloques.map((b) => {
                  if (b.tipo === "parrafo") {
                    const texto = parrafos[pi++] ?? b.texto;
                    return { tipo: "parrafo" as const, texto };
                  }
                  return b;
                });
              }
            } catch {
              // keep original
            }
          }

          let imagenUrl: string | null = null;
          let imagenOriginalUrl: string | null = item.imagenUrl;

          if (item.imagenUrl) {
            if (!usarImagenesIA) {
              try {
                enq({ mensaje: `Subiendo imagen original ítem ${numero}...` });
                const imgRes = await fetch(item.imagenUrl, { headers: { "User-Agent": UA } });
                if (imgRes.ok) {
                  const buf = Buffer.from(await imgRes.arrayBuffer());
                  imagenUrl = await new Promise<string>((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                      { folder: "sitio-media/especiales" },
                      (err, result) => {
                        if (err) reject(err);
                        else resolve(result!.secure_url);
                      }
                    );
                    Readable.from(buf).pipe(uploadStream);
                  });
                }
              } catch (e) {
                enq({ mensaje: `Error subiendo imagen ítem ${numero}: ${e instanceof Error ? e.message : String(e)}` });
              }
            } else {
              let descripcionVisual: string | null = null;
              try {
                enq({ mensaje: `Claude vision ítem ${numero}...` });
                const visionRes = await fetch("https://api.anthropic.com/v1/messages", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-api-key": anthropicKeyStr,
                    "anthropic-version": "2023-06-01",
                  },
                  body: JSON.stringify({
                    model: "claude-haiku-4-5-20251001",
                    max_tokens: 150,
                    messages: [
                      {
                        role: "user",
                        content: [
                          { type: "image", source: { type: "url", url: item.imagenUrl } },
                          {
                            type: "text",
                            text: "Describe all the visual elements of this image in one sentence: people, animals, setting, objects, colors, lighting. Do NOT mention text, logos, brands, or violence.",
                          },
                        ],
                      },
                    ],
                  }),
                });
                const visionData = await visionRes.json().catch(() => ({}));
                descripcionVisual = visionData.content?.[0]?.text?.trim() ?? null;
              } catch {
                // continue without
              }

              const pageText = `${tituloItem}. ${parrafos.join(" ")}`;
              const claudePromptForGemini = `You are a prompt engineer for AI image generation. Based on the scene description and the item text below, write a single detailed cinematic prompt for an AI image generator. The prompt must be photorealistic, documentary style, National Geographic quality. Do NOT include text, logos, watermarks, or violent imagery. Write ONLY the image generation prompt, nothing else.

Scene from reference image: ${descripcionVisual ?? "Not described"}
Item text: ${pageText}`;

              let promptParaGemini: string;
              try {
                const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-api-key": anthropicKeyStr,
                    "anthropic-version": "2023-06-01",
                  },
                  body: JSON.stringify({
                    model: "claude-haiku-4-5-20251001",
                    max_tokens: 1024,
                    messages: [{ role: "user", content: claudePromptForGemini }],
                  }),
                });
                const claudeBody = await claudeRes.json().catch(() => null);
                promptParaGemini = (claudeBody?.content?.[0]?.text ?? "").trim();
                if (!promptParaGemini) throw new Error("Claude no devolvió prompt");
              } catch {
                promptParaGemini = descripcionVisual ?? "Photorealistic documentary scene.";
              }

              promptParaGemini = `${promptParaGemini.trim()} Important: do not include any weapons, guns, knives, firearms, or violent imagery of any kind.`;
              const promptConRef = "Based on this reference image, create a photorealistic version maintaining the same subject and composition. " + promptParaGemini;

              try {
                enq({ mensaje: `Gemini 2.5 ítem ${numero}...` });
                const imgRes = await fetch(item.imagenUrl, { headers: { "User-Agent": UA } });
                if (!imgRes.ok) throw new Error("No se pudo descargar imagen de referencia");
                const imgBuf = Buffer.from(await imgRes.arrayBuffer());
                const refBase64 = imgBuf.toString("base64");
                const contentType = imgRes.headers.get("content-type") ?? "";
                const refMime = contentType.startsWith("image/") ? contentType.split(";")[0].trim() : "image/png";

                const geminiRes = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${googleApiKeyStr}`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      contents: [
                        {
                          parts: [
                            { inlineData: { mimeType: refMime, data: refBase64 } },
                            { text: promptConRef },
                          ],
                        },
                      ],
                      generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
                    }),
                  }
                );
                const geminiData = await geminiRes.json().catch(() => ({}));
                const parts = geminiData.candidates?.[0]?.content?.parts ?? [];
                const imagePart = parts.find((p: { inlineData?: { mimeType?: string; data?: string } }) => p.inlineData?.mimeType?.startsWith("image/"));
                const imageBase64 = imagePart?.inlineData?.data;

                if (imageBase64) {
                  enq({ mensaje: `Subiendo imagen IA ítem ${numero}...` });
                  const buf = Buffer.from(imageBase64, "base64");
                  imagenUrl = await new Promise<string>((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                      { folder: "sitio-media/especiales" },
                      (err, result) => {
                        if (err) reject(err);
                        else resolve(result!.secure_url);
                      }
                    );
                    Readable.from(buf).pipe(uploadStream);
                  });
                } else {
                  throw new Error("Gemini no devolvió imagen");
                }
              } catch (e) {
                enq({ mensaje: `Fallback imagen original ítem ${numero}: ${e instanceof Error ? e.message : String(e)}` });
                try {
                  const imgRes = await fetch(item.imagenUrl, { headers: { "User-Agent": UA } });
                  if (imgRes.ok) {
                    const buf = Buffer.from(await imgRes.arrayBuffer());
                    imagenUrl = await new Promise<string>((resolve, reject) => {
                      const uploadStream = cloudinary.uploader.upload_stream(
                        { folder: "sitio-media/especiales" },
                        (err, result) => {
                          if (err) reject(err);
                          else resolve(result!.secure_url);
                        }
                      );
                      Readable.from(buf).pipe(uploadStream);
                    });
                  }
                } catch {
                  // leave imagenUrl null
                }
              }
            }
          }

          if (imagenUrl != null) {
            const firstImgIdx = bloques.findIndex((b) => b.tipo === "imagen");
            if (firstImgIdx >= 0) {
              const prev = bloques[firstImgIdx];
              if (prev.tipo === "imagen") bloques[firstImgIdx] = { tipo: "imagen", url: imagenUrl };
            }
          }
          try {
            await addEspecialPagina(especialId, numero, tituloItem, imagenUrl, imagenOriginalUrl, parrafos, bloques);
            await pool.query(
              `UPDATE especiales SET total_paginas = (SELECT COUNT(*) FROM especial_paginas WHERE especial_id = $1), updated_at = NOW() WHERE id = $1`,
              [especialId]
            );
          } catch (e) {
            enq({
              pagina: numero,
              total,
              status: "error",
              mensaje: `Error DB ítem ${numero}: ${e instanceof Error ? e.message : String(e)}`,
            });
          }

          enq({
            pagina: numero,
            total,
            status: "ok",
            mensaje: `Ítem ${numero} procesado`,
          });
        }

        enq({ done: true, especialSlug: slug });
      } catch (e) {
        enq({
          status: "error",
          mensaje: e instanceof Error ? e.message : String(e),
        });
      } finally {
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}
