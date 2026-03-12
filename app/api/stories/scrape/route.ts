import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { Readable } from "stream";
import cloudinary from "@/lib/cloudinary";
import pool from "@/lib/db";
import { createStory, addStoryPagina } from "@/lib/stories";
import slugify from "slugify";

const ADMIN_SECRET = process.env.ADMIN_SECRET;
const UA = "Mozilla/5.0 (compatible; sitio-media-bot/1.0)";

const CODE_OR_NOISE = /JavaScript|CSS|código|script|function\(|var\s|const\s|let\s|\{|\}|querySelector|getElementById/i;

function filterParrafos(arr: string[]): string[] {
  return arr.filter((p) => {
    const t = p.trim();
    if (t.length < 30) return false;
    if (CODE_OR_NOISE.test(t)) return false;
    return true;
  });
}

const SPLIT_SCREEN_PATTERNS = [
  "composite image",
  "split screen",
  "two scenes",
  "left side",
  "right side",
  "collage",
  "split image",
  "two photos",
  "divided",
];

function descripcionVisualIndicaSplitScreen(descripcionVisual: string): boolean {
  const lower = descripcionVisual.toLowerCase();
  return SPLIT_SCREEN_PATTERNS.some((p) => lower.includes(p));
}

const HUMAN_FOREGROUND_PATTERNS = [
  /\b(a man|a woman|a person)\b/i,
  /\bman with\b/i,
  /\bwoman with\b/i,
  /\bwearing\b/i,
  /\bshirt\b/i,
  /\bstanding\b/i,
  /\bsitting\b/i,
];

function descripcionVisualTieneHumanoEnPrimerPlano(descripcionVisual: string): boolean {
  const count = HUMAN_FOREGROUND_PATTERNS.filter((re) => re.test(descripcionVisual)).length;
  return count >= 2;
}

const BACK_VIEW_PHRASES = [
  "from behind",
  "desde atrás",
  "de espaldas",
  "back of",
  "rear view",
  "facing away",
];

function descripcionVisualIndicaHumanoDeEspaldas(descripcionVisual: string): boolean {
  const lower = descripcionVisual.toLowerCase();
  return BACK_VIEW_PHRASES.some((phrase) => lower.includes(phrase));
}

const ANIMAL_KEYWORDS = /\b(dog|cat|horse|bird|animal|pet|puppy|kitten|species|breed|coat|tiger|lion|bear|wolf|cub|perro|gato|caballo|mascota)\b/i;

function splitProtagonistaFijoEnAnimalYHumano(protagonistaFijo: string): { animal: string; human: string } {
  const chunks = protagonistaFijo
    .split(/\n\s*\d+\.\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const animal: string[] = [];
  const human: string[] = [];
  for (const chunk of chunks) {
    if (ANIMAL_KEYWORDS.test(chunk)) animal.push(chunk);
    else human.push(chunk);
  }
  return {
    animal: animal.join(" ").trim() || protagonistaFijo,
    human: human.join(" ").trim() || protagonistaFijo,
  };
}

function auth(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret");
  return !!ADMIN_SECRET && secret === ADMIN_SECRET;
}

function sseMessage(obj: object): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

export async function POST(req: NextRequest) {
  if (!auth(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let urlBase: string;
  let paginaInicio: number;
  let paginaFin: number;
  let initialStoryId: number | null = null;
  let initialStorySlug: string = "";
  try {
    const body = await req.json();
    urlBase = String(body.urlBase ?? "").trim();
    paginaInicio = Math.max(1, parseInt(String(body.paginaInicio ?? 1), 10) || 1);
    paginaFin = Math.max(paginaInicio, parseInt(String(body.paginaFin ?? 1), 10) || 1);
    if (!urlBase) {
      return NextResponse.json({ error: "Falta urlBase" }, { status: 400 });
    }
    if (body.storyId != null) {
      const sid = parseInt(String(body.storyId), 10);
      if (!Number.isNaN(sid)) {
        const row = await pool.query<{ slug: string }>("SELECT slug FROM stories WHERE id = $1", [sid]);
        if (row.rows.length === 0) {
          return NextResponse.json({ error: "Story no encontrada" }, { status: 404 });
        }
        initialStoryId = sid;
        initialStorySlug = row.rows[0].slug;
      }
    }
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  if (initialStoryId != null && urlBase) {
    await pool.query("UPDATE stories SET url_base = $1 WHERE id = $2", [urlBase, initialStoryId]);
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

  const total = paginaFin - paginaInicio + 1;
  let storyId: number | null = null;
  let storySlug: string = "";

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      let descripcionProtagonista: string | null = null;
      let protagonistaFijo: string | null = null;
      let imagenReferenciaHumanoBase64: string | null = null;
      let imagenReferenciaHumanoMimeType: string = "image/png";
      let imagenReferenciaAnimalBase64: string | null = null;
      let imagenReferenciaAnimalMimeType: string = "image/png";
      let imagenReferenciaUrlToSave: string | null = null;
      let contextoPaginas: string = "";
      let descripcionAnimalOriginal: string | null = null;
      if (initialStoryId != null) {
        storyId = initialStoryId;
        storySlug = initialStorySlug;
        const row = await pool.query<{ descripcion_protagonista: string | null; imagen_referencia_url: string | null }>(
          "SELECT descripcion_protagonista, imagen_referencia_url FROM stories WHERE id = $1",
          [storyId]
        );
        protagonistaFijo = row.rows[0]?.descripcion_protagonista?.trim() ?? null;
        const imagenRefUrl = row.rows[0]?.imagen_referencia_url?.trim();
        if (imagenRefUrl) {
          try {
            const imgRes = await fetch(imagenRefUrl, { headers: { "User-Agent": UA } });
            if (imgRes.ok) {
              const buf = Buffer.from(await imgRes.arrayBuffer());
              const b64 = buf.toString("base64");
              const contentType = imgRes.headers.get("content-type") ?? "";
              const mime = contentType.startsWith("image/") ? contentType.split(";")[0].trim() : "image/png";
              imagenReferenciaHumanoBase64 = b64;
              imagenReferenciaHumanoMimeType = mime;
            }
          } catch {
            // ignorar, seguir sin referencia
          }
        }
      }
      try {
        type PageData = {
          p: number;
          tituloRewritten: string;
          parrafos: string[];
          imagenPrincipal: string | null;
          descripcionVisual: string | null;
        };

        const phase1End = Math.min(paginaFin, 5);
        const paginasFase1: PageData[] = [];

        async function leerYProcesarPagina(p: number): Promise<PageData | null> {
          const url = `${urlBase.replace(/\/$/, "")}/${p}/`;
          let titulo = "";
          let imagenPrincipal: string | null = null;
          let parrafosRaw: string[] = [];

          try {
            const res = await fetch(url, { headers: { "User-Agent": UA } });
            const html = await res.text();
            const $ = cheerio.load(html);
            titulo = ($("h1").first().text() || $("title").text() || "").trim();
            if (!titulo) {
              const headings = $("h1, h2, .titulo, .title").toArray();
              for (const el of headings) {
                const t = $(el).text().trim();
                if (t.length > 3) {
                  titulo = t;
                  break;
                }
              }
            }
            imagenPrincipal = null;
            $("img").each((_, el) => {
              if (imagenPrincipal) return;
              const src =
                $(el).attr("data-layzr") ||
                $(el).attr("data-lazy-src") ||
                $(el).attr("data-src") ||
                $(el).attr("src") || "";
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
            $("p").each((_, el) => {
              const text = $(el).text().trim();
              if (text.length >= 50) parrafosRaw.push(text);
            });
          } catch (e) {
            controller.enqueue(enc.encode(sseMessage({
              pagina: p,
              total,
              status: "error",
              mensaje: `Error fetch: ${e instanceof Error ? e.message : String(e)}`,
            })));
            return null;
          }

          const parrafosFiltrados = filterParrafos(parrafosRaw);
          let tituloRewritten = titulo;
          let parrafos: string[] = parrafosFiltrados;
          if (parrafosFiltrados.length > 0 || titulo) {
            try {
              const payload = titulo
                ? { titulo, parrafos: parrafosFiltrados }
                : { parrafos: parrafosFiltrados };
              const prompt = titulo
                ? `Reescribí el título y los párrafos siguientes.

TÍTULO (obligatorio):
- Reescribí el título por completo, no copies el original.
- El título debe tener sentido propio sin conocer la historia (el lector no sabe de qué trata).
- Debe ser intrigante y generar curiosidad, estilo viral.
- Máximo 12 palabras.
- No uses el nombre del sitio fuente ni la URL.

PÁRRAFOS:
- Mantené el hilo narrativo. No copies el texto original; reescribilo con tus propias palabras manteniendo hechos y secuencia.

Devolvé SOLO un JSON válido con esta forma: { "titulo": "string", "parrafos": ["string", ...] }.\n\n${JSON.stringify(payload)}`
                : `Reescribí estos párrafos manteniendo el hilo narrativo. No copies el texto original; reescribilo con tus propias palabras manteniendo hechos y secuencia. Devolvé SOLO un JSON array de strings: ["párrafo1", "párrafo2", ...].\n\n${JSON.stringify(parrafosFiltrados)}`;
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
                  messages: [{ role: "user", content: prompt }],
                }),
              });
              const data = await claudeRes.json().catch(() => ({}));
              const text = (data.content?.[0]?.text ?? "").trim();
              if (titulo) {
                const objMatch = text.match(/\{[\s\S]*\}/);
                if (objMatch) {
                  const parsed = JSON.parse(objMatch[0]) as { titulo?: string; parrafos?: string[] };
                  if (typeof parsed.titulo === "string" && parsed.titulo.trim()) tituloRewritten = parsed.titulo.trim();
                  if (Array.isArray(parsed.parrafos)) parrafos = parsed.parrafos.filter((x): x is string => typeof x === "string");
                }
              } else {
                const jsonMatch = text.match(/\[[\s\S]*\]/);
                if (jsonMatch) parrafos = JSON.parse(jsonMatch[0]) as string[];
              }
            } catch {
              // keep tituloRewritten and parrafosFiltrados
            }
          }

          const pageText = `Page ${p}:\n` + parrafos.join("\n");
          contextoPaginas += (contextoPaginas ? "\n\n" : "") + pageText;

          let descripcionVisual: string | null = null;
          if (imagenPrincipal) {
            try {
              controller.enqueue(enc.encode(sseMessage({ mensaje: `Analizando imagen con Claude vision (página ${p})...` })));
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
                  messages: [{
                    role: "user",
                    content: [
                      { type: "image", source: { type: "url", url: imagenPrincipal } },
                      {
                        type: "text",
                        text: "Describe all the visual elements of this image in one sentence: all people and animals present (their species, breed, size, color, distinctive features, age, appearance, clothing for humans), their positions and interactions with each other, the setting, objects, colors, and lighting. Do NOT mention actions involving conflict or violence. Do NOT mention text, logos, brands or websites. Be specific about how many people and animals are in the scene and what they are doing together.",
                      },
                    ],
                  }],
                }),
              });
              const visionData = await visionRes.json().catch(() => ({}));
              descripcionVisual = visionData.content?.[0]?.text?.trim() ?? null;
              if (descripcionVisual) controller.enqueue(enc.encode(sseMessage({ mensaje: `Visual p${p}: ${descripcionVisual}` })));

              if (p === 1 && imagenPrincipal && descripcionVisual && ANIMAL_KEYWORDS.test(descripcionVisual)) {
                try {
                  controller.enqueue(enc.encode(sseMessage({ mensaje: "Obteniendo descripción detallada del animal de la imagen original..." })));
                  const animalDetailRes = await fetch("https://api.anthropic.com/v1/messages", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "x-api-key": anthropicKeyStr,
                      "anthropic-version": "2023-06-01",
                    },
                    body: JSON.stringify({
                      model: "claude-haiku-4-5-20251001",
                      max_tokens: 300,
                      messages: [{
                        role: "user",
                        content: [
                          { type: "image", source: { type: "url", url: imagenPrincipal } },
                          {
                            type: "text",
                            text: "Describe in extreme visual detail the animal in this image. Focus on: species, size, body shape, exact coat/fur colors and pattern distribution (which specific parts of the body are which color), ear shape, tail, face markings, distinctive features. Be specific enough that an image generator could recreate the exact same animal. Ignore any split screen, focus only on describing the animal's appearance.",
                          },
                        ],
                      }],
                    }),
                  });
                  const animalDetailData = await animalDetailRes.json().catch(() => ({}));
                  const animalDetail = animalDetailData.content?.[0]?.text?.trim();
                  if (animalDetail) {
                    descripcionAnimalOriginal = animalDetail;
                    controller.enqueue(enc.encode(sseMessage({ mensaje: "Descripción del animal guardada (imagen original)" })));
                  }
                } catch {
                  // ignorar
                }
              }
            } catch {
              // ignorar
            }
          }

          const descripcionVisualIndicaSplit = descripcionVisual ? descripcionVisualIndicaSplitScreen(descripcionVisual) : false;
          const humanoEnPrimerPlano = descripcionVisual ? descripcionVisualTieneHumanoEnPrimerPlano(descripcionVisual) : false;
          const humanoDeEspaldas = descripcionVisual ? descripcionVisualIndicaHumanoDeEspaldas(descripcionVisual) : false;
          const tienePersonaOAnimal = descripcionVisual
            ? /\b(man|woman|person|people|elder|elderly|old|young|hombre|mujer|persona|anciano|anciana|dog|cat|horse|bird|animal|pet|puppy|kitten|perro|gato|caballo|pájaro|animal|mascota|cachorro|tiger|lion|bear|wolf|tigre|león|oso|lobo)\b/i.test(descripcionVisual)
            : false;

          // Referencia humano: primera página con humano en primer plano, de frente o perfil (no de espaldas) y no split.
          if (!imagenReferenciaHumanoBase64 && imagenPrincipal && descripcionVisual && !descripcionVisualIndicaSplit && tienePersonaOAnimal && humanoEnPrimerPlano && !humanoDeEspaldas) {
            try {
              controller.enqueue(enc.encode(sseMessage({ mensaje: `Guardando referencia humano desde imagen original (página ${p})...` })));
              const imgRes = await fetch(imagenPrincipal, { headers: { "User-Agent": UA } });
              if (imgRes.ok) {
                const buf = Buffer.from(await imgRes.arrayBuffer());
                imagenReferenciaHumanoBase64 = buf.toString("base64");
                const contentType = imgRes.headers.get("content-type") ?? "";
                imagenReferenciaHumanoMimeType = contentType.startsWith("image/") ? contentType.split(";")[0].trim() : "image/png";
                try {
                  const refUrl = await new Promise<string>((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                      { folder: "sitio-media/stories/referencias" },
                      (err, result) => {
                        if (err) reject(err);
                        else resolve(result!.secure_url);
                      }
                    );
                    Readable.from(buf).pipe(uploadStream);
                  });
                  imagenReferenciaUrlToSave = refUrl;
                  if (storyId != null) {
                    await pool.query(
                      "UPDATE stories SET imagen_referencia_url = $1, updated_at = NOW() WHERE id = $2",
                      [imagenReferenciaUrlToSave, storyId]
                    );
                    imagenReferenciaUrlToSave = null;
                  }
                } catch {
                  // ignorar
                }
                controller.enqueue(enc.encode(sseMessage({ mensaje: `Referencia humano guardada (imagen original, p${p})` })));
              }
            } catch {
              // ignorar
            }
          }

          // Referencia animal: desde p1 intentar guardar desde imagen original si hay descripcionAnimalOriginal (aunque sea split screen).
          if (p === 1 && !imagenReferenciaAnimalBase64 && imagenPrincipal && descripcionAnimalOriginal) {
            try {
              controller.enqueue(enc.encode(sseMessage({ mensaje: "Guardando referencia animal desde imagen original (página 1)..." })));
              const imgRes = await fetch(imagenPrincipal, { headers: { "User-Agent": UA } });
              if (imgRes.ok) {
                const buf = Buffer.from(await imgRes.arrayBuffer());
                imagenReferenciaAnimalBase64 = buf.toString("base64");
                const contentType = imgRes.headers.get("content-type") ?? "";
                imagenReferenciaAnimalMimeType = contentType.startsWith("image/") ? contentType.split(";")[0].trim() : "image/png";
                try {
                  const refUrl = await new Promise<string>((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                      { folder: "sitio-media/stories/referencias" },
                      (err, result) => {
                        if (err) reject(err);
                        else resolve(result!.secure_url);
                      }
                    );
                    Readable.from(buf).pipe(uploadStream);
                  });
                  imagenReferenciaUrlToSave = refUrl;
                  if (storyId != null) {
                    await pool.query(
                      "UPDATE stories SET imagen_referencia_url = $1, updated_at = NOW() WHERE id = $2",
                      [imagenReferenciaUrlToSave, storyId]
                    );
                    imagenReferenciaUrlToSave = null;
                  }
                } catch {
                  // ignorar
                }
                controller.enqueue(enc.encode(sseMessage({ mensaje: "Referencia animal guardada (imagen original, p1)" })));
              }
            } catch {
              // ignorar
            }
          }

          return { p, tituloRewritten, parrafos, imagenPrincipal, descripcionVisual };
        }

        // FASE 1: leer y procesar páginas 1-5 (o hasta paginaFin si es menor), sin Gemini.
        for (let p = paginaInicio; p <= phase1End; p++) {
          const page = await leerYProcesarPagina(p);
          if (page) paginasFase1.push(page);
        }

        // Crear story lo antes posible si no existe (necesario para guardar protagonistaFijo en DB).
        if (storyId == null && paginasFase1.length > 0) {
          const first = paginasFase1[0];
          const baseSlug = slugify(first.tituloRewritten || "story", { lower: true, strict: true });
          let slug = baseSlug;
          let n = 0;
          for (;;) {
            const exists = await pool.query("SELECT 1 FROM stories WHERE slug = $1", [slug]);
            if (exists.rows.length === 0) break;
            n++;
            slug = `${baseSlug}-${n}`;
          }
          storySlug = slug;
          storyId = await createStory(slug, first.tituloRewritten || `Story ${paginaInicio}`, total, urlBase || null);
        }

        // Si quedó una referencia por subir a DB, y ya hay storyId, guardarla.
        if (storyId != null && imagenReferenciaUrlToSave) {
          await pool.query(
            "UPDATE stories SET imagen_referencia_url = $1, updated_at = NOW() WHERE id = $2",
            [imagenReferenciaUrlToSave, storyId]
          );
          imagenReferenciaUrlToSave = null;
        }

        // FASE 2: extraer protagonistas con contexto completo (primeras 5 páginas) + imágenes de referencia.
        if (!protagonistaFijo && contextoPaginas.trim()) {
          try {
            controller.enqueue(enc.encode(sseMessage({ mensaje: "Extrayendo protagonistas fijos (FASE 2)..." })));
            const protPromptText = `You are analyzing a story. Based on the narrative text below and the reference image(s) provided (first = human protagonist if present, second = animal protagonist if present), identify the MAIN RECURRING PROTAGONISTS and describe them with precise visual details for consistent image generation.

For each protagonist visible in the reference image(s) or named in the text: provide a detailed physical description.
- For humans: ethnicity, age range, hair color and style, eye color, distinctive features, clothing as visible or inferred.
- For animals: species/breed, age/size, hair/coat color, clothing/markings. For each animal protagonist, describe their appearance in extreme visual detail based on the reference image: species, size, body shape, exact coat colors and pattern distribution (which parts are which color), ear shape, tail, distinctive markings. Be specific enough that an image generator could recreate the exact same animal.

If reference images are provided, use them to describe the exact appearance of the character(s). Be specific and consistent.

Story text (pages 1-5):
${contextoPaginas.trim()}
${descripcionAnimalOriginal ? `\n\nIMPORTANT: The animal's appearance has been identified from the original news image as follows: ${descripcionAnimalOriginal}. Use this as the ground truth for the animal's appearance.` : ""}

Respond in English, number each protagonist, one paragraph each.`;
            const protContent: Array<{ type: "image"; source: { type: "base64"; media_type: string; data: string } } | { type: "text"; text: string }> = [];
            if (imagenReferenciaHumanoBase64) {
              protContent.push({
                type: "image",
                source: { type: "base64", media_type: imagenReferenciaHumanoMimeType, data: imagenReferenciaHumanoBase64 },
              });
            }
            if (imagenReferenciaAnimalBase64) {
              protContent.push({
                type: "image",
                source: { type: "base64", media_type: imagenReferenciaAnimalMimeType, data: imagenReferenciaAnimalBase64 },
              });
            }
            protContent.push({ type: "text", text: protPromptText });
            const protRes = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": anthropicKeyStr,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 300,
                messages: [{ role: "user", content: protContent }],
              }),
            });
            const protData = await protRes.json().catch(() => ({}));
            const extracted = protData.content?.[0]?.text?.trim();
            if (extracted) {
              protagonistaFijo = extracted;
              controller.enqueue(enc.encode(sseMessage({ mensaje: `Protagonistas fijos listos: ${extracted.slice(0, 80)}...` })));
              if (storyId != null) {
                await pool.query(
                  "UPDATE stories SET descripcion_protagonista = $1, updated_at = NOW() WHERE id = $2",
                  [protagonistaFijo, storyId]
                );
              }
            }
          } catch {
            // ignorar
          }
        }

        async function generarImagenYSubir(page: PageData): Promise<{ imagenUrl: string | null }> {
          const { p, tituloRewritten, parrafos, imagenPrincipal, descripcionVisual } = page;
          let imagenUrl: string | null = null;

          const pageText = (tituloRewritten && parrafos.length > 0)
            ? `${tituloRewritten}. ${parrafos.join(" ")}`
            : (parrafos.length > 0 ? parrafos.join(" ") : "");
          const claudePromptForGemini = `You are a prompt engineer for AI image generation. Based on the story text below and the character descriptions, write a single detailed cinematic prompt for an AI image generator. The prompt must:
1. Describe the exact scene happening in this page's text (setting, action, mood, time of day)
2. Include precise physical descriptions of every character that appears in the scene: ${protagonistaFijo ?? "None specified"}
3. Be photorealistic, documentary style, National Geographic quality
4. NOT include any text, logos, watermarks, split screens or collages
5. Be a single unified scene
6. Only include the recurring protagonists (people or animals described in protagonistaFijo) if they are explicitly mentioned or clearly implied by the text of this specific page. Do not force protagonists into scenes where the page text does not reference them. Let the scene be driven by what the page text actually describes.

Page text: ${pageText}
Original scene context: ${descripcionVisual ?? "None"}

Write ONLY the image generation prompt, nothing else, no preamble, no explanation.`;

          const CLAUDE_MODEL_PROMPT = "claude-haiku-4-5-20251001";
          const CLAUDE_MAX_TOKENS_PROMPT = 1024; // >= 500

          let promptParaGemini: string;
          try {
            controller.enqueue(enc.encode(sseMessage({ mensaje: `Claude: generando prompt cinematográfico para página ${p}...` })));
            const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": anthropicKeyStr,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: CLAUDE_MODEL_PROMPT,
                max_tokens: CLAUDE_MAX_TOKENS_PROMPT,
                messages: [{ role: "user", content: claudePromptForGemini }],
              }),
            });
            const claudeBody = await claudeRes.json().catch(() => null);
            if (!claudeRes.ok) {
              const errDetail = `Claude prompt error: HTTP ${claudeRes.status}, body: ${JSON.stringify(claudeBody)}`;
              console.error("[scrape] " + errDetail);
              controller.enqueue(enc.encode(sseMessage({
                pagina: p,
                total,
                status: "error",
                mensaje: errDetail,
              })));
              return { imagenUrl };
            }
            promptParaGemini = (claudeBody?.content?.[0]?.text ?? "").trim();
            if (!promptParaGemini) {
              const errDetail = `Claude no devolvió prompt. HTTP ${claudeRes.status}, body: ${JSON.stringify(claudeBody)}`;
              console.error("[scrape] " + errDetail);
              controller.enqueue(enc.encode(sseMessage({
                pagina: p,
                total,
                status: "error",
                mensaje: errDetail,
              })));
              return { imagenUrl };
            }
          } catch (e) {
            const errDetail = `Error Claude (prompt): ${e instanceof Error ? e.message : String(e)}`;
            console.error("[scrape] " + errDetail, e);
            controller.enqueue(enc.encode(sseMessage({
              pagina: p,
              total,
              status: "error",
              mensaje: errDetail,
            })));
            return { imagenUrl };
          }

          promptParaGemini = `${promptParaGemini.trim()} Important: do not include any weapons, guns, knives, firearms, or violent imagery of any kind.`;

          try {
            controller.enqueue(enc.encode(sseMessage({ mensaje: `Generando imagen con Gemini 2.5 para página ${p}...` })));
            const geminiRes: Response = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${googleApiKeyStr}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: promptParaGemini }] }],
                  generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
                }),
              }
            );
            type GeminiPart = { inlineData?: { mimeType?: string; data?: string } };
            const geminiData = (await geminiRes.json().catch(() => ({}))) as {
              candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
            };
            const parts: GeminiPart[] = geminiData.candidates?.[0]?.content?.parts ?? [];
            const imagePart = parts.find((part: GeminiPart) =>
              part.inlineData?.mimeType?.startsWith("image/")
            );

            if (!imagePart?.inlineData?.data) throw new Error("Gemini no devolvió imagen");

            controller.enqueue(enc.encode(sseMessage({ mensaje: `Subiendo imagen a Cloudinary...` })));
            const buf = Buffer.from(imagePart.inlineData.data, "base64");
            imagenUrl = await new Promise<string>((resolve, reject) => {
              const uploadStream = cloudinary.uploader.upload_stream(
                { folder: "sitio-media/stories" },
                (err, result) => {
                  if (err) reject(err);
                  else resolve(result!.secure_url);
                }
              );
              Readable.from(buf).pipe(uploadStream);
            });
            controller.enqueue(enc.encode(sseMessage({ mensaje: `Imagen subida: ${imagenUrl}` })));
          } catch (e) {
            controller.enqueue(enc.encode(sseMessage({
              pagina: p,
              total,
              status: "error",
              mensaje: `Error Gemini/Cloudinary: ${e instanceof Error ? e.message : String(e)}`,
            })));
          }

          if (!imagenUrl && imagenPrincipal) {
            try {
              controller.enqueue(enc.encode(sseMessage({ mensaje: `Usando imagen original como fallback...` })));
              const imgBuf = await fetch(imagenPrincipal, { headers: { "User-Agent": UA } }).then((r) => r.arrayBuffer());
              const buf = Buffer.from(imgBuf);
              imagenUrl = await new Promise<string>((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                  { folder: "sitio-media/stories" },
                  (err, result) => {
                    if (err) reject(err);
                    else resolve(result!.secure_url);
                  }
                );
                Readable.from(buf).pipe(uploadStream);
              });
              controller.enqueue(enc.encode(sseMessage({ mensaje: `Imagen fallback subida: ${imagenUrl}` })));
            } catch (e) {
              controller.enqueue(enc.encode(sseMessage({
                status: "error",
                mensaje: `Error imagen fallback: ${e instanceof Error ? e.message : String(e)}`,
              })));
            }
          }

          return { imagenUrl };
        }

        // FASE 3: generar imágenes para páginas 1-5 ya leídas, con protagonistaFijo disponible desde p1.
        for (const page of paginasFase1) {
          const gen = await generarImagenYSubir(page);
          const imagenUrl = gen.imagenUrl;
          try {
            if (storyId != null) {
              await addStoryPagina(storyId, page.p, imagenUrl, page.parrafos);
              await pool.query(
                `UPDATE stories SET total_paginas = (SELECT COUNT(*) FROM story_paginas WHERE story_id = $1), updated_at = NOW() WHERE id = $1`,
                [storyId]
              );
            }
          } catch (e) {
            controller.enqueue(enc.encode(sseMessage({
              pagina: page.p,
              total,
              status: "error",
              mensaje: `Error DB: ${e instanceof Error ? e.message : String(e)}`,
            })));
          }
          controller.enqueue(enc.encode(sseMessage({
            pagina: page.p,
            total,
            status: "ok",
            mensaje: `Página ${page.p} procesada`,
          })));
        }

        // Continuar desde página 6 en adelante con flujo normal: leer + generar en el momento.
        for (let p = Math.max(6, paginaInicio); p <= paginaFin; p++) {
          const page = await leerYProcesarPagina(p);
          if (!page) continue;
          const gen = await generarImagenYSubir(page);
          const imagenUrl = gen.imagenUrl;
          try {
            if (storyId != null) {
              await addStoryPagina(storyId, p, imagenUrl, page.parrafos);
              await pool.query(
                `UPDATE stories SET total_paginas = (SELECT COUNT(*) FROM story_paginas WHERE story_id = $1), updated_at = NOW() WHERE id = $1`,
                [storyId]
              );
            }
          } catch (e) {
            controller.enqueue(enc.encode(sseMessage({
              pagina: p,
              total,
              status: "error",
              mensaje: `Error DB: ${e instanceof Error ? e.message : String(e)}`,
            })));
            continue;
          }
          controller.enqueue(enc.encode(sseMessage({
            pagina: p,
            total,
            status: "ok",
            mensaje: `Página ${p} procesada`,
          })));
        }

        controller.enqueue(enc.encode(sseMessage({ done: true, storySlug })));
      } catch (e) {
        controller.enqueue(enc.encode(sseMessage({
          status: "error",
          mensaje: e instanceof Error ? e.message : String(e),
        })));
      } finally {
        controller.close();
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
