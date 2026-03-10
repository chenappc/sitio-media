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

  const total = paginaFin - paginaInicio + 1;
  let storyId: number | null = null;
  let storySlug: string = "";

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      let descripcionProtagonista: string | null = null;
      let protagonistaFijo: string | null = null;
      if (initialStoryId != null) {
        storyId = initialStoryId;
        storySlug = initialStorySlug;
        const row = await pool.query<{ descripcion_protagonista: string | null }>(
          "SELECT descripcion_protagonista FROM stories WHERE id = $1",
          [storyId]
        );
        protagonistaFijo = row.rows[0]?.descripcion_protagonista?.trim() ?? null;
      }
      let imagenReferenciaBase64: string | null = null;
      let imagenReferenciaMimeType: string = "image/png";
      try {
        for (let p = paginaInicio; p <= paginaFin; p++) {
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
            continue;
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
                  "x-api-key": anthropicKey,
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

          let descripcionVisual: string | null = null;
          if (imagenPrincipal) {
            try {
              controller.enqueue(enc.encode(sseMessage({ mensaje: `Analizando imagen con Claude vision...` })));
              const visionRes = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-api-key": anthropicKey,
                  "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify({
                  model: "claude-haiku-4-5-20251001",
                  max_tokens: 150,
                  messages: [{
                    role: "user",
                    content: [
                      {
                        type: "image",
                        source: { type: "url", url: imagenPrincipal },
                      },
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
              if (descripcionVisual) controller.enqueue(enc.encode(sseMessage({ mensaje: `Visual: ${descripcionVisual}` })));
            } catch {
              // ignorar, usar texto como fallback
            }
          }

          const imagenTienePersonaAfterVisual = descripcionVisual
            ? /\b(man|woman|person|people|elder|elderly|old|young|hombre|mujer|persona|anciano|anciana|dog|cat|horse|bird|animal|pet|puppy|kitten|perro|gato|caballo|pájaro|animal|mascota|cachorro|tiger|lion|bear|wolf|tigre|león|oso|lobo)\b/i.test(descripcionVisual)
            : false;
          if (imagenTienePersonaAfterVisual && !protagonistaFijo && descripcionVisual?.trim()) {
            try {
              controller.enqueue(enc.encode(sseMessage({ mensaje: "Extrayendo descripción fija del protagonista..." })));
              const protRes = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-api-key": anthropicKey,
                  "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify({
                  model: "claude-haiku-4-5-20251001",
                  max_tokens: 200,
                  messages: [{
                    role: "user",
                    content: `From this image description, extract a precise physical description of the main protagonist (person or animal) that will remain consistent throughout all images. Include: for humans: ethnicity, approximate age, hair color and style, eye color, distinctive facial features, typical clothing style. For animals: species, breed, size, coat color and pattern, distinctive markings. Be very specific. Respond in English in one paragraph. Description: ${descripcionVisual}`,
                  }],
                }),
              });
              const protData = await protRes.json().catch(() => ({}));
              const extracted = protData.content?.[0]?.text?.trim();
              if (extracted) {
                protagonistaFijo = extracted;
                controller.enqueue(enc.encode(sseMessage({ mensaje: `Protagonista fijo: ${extracted.slice(0, 80)}...` })));
              }
            } catch {
              // ignorar
            }
          }

          if (p === paginaInicio && parrafos.length > 0) {
            try {
              const extractRes = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-api-key": anthropicKey,
                  "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify({
                  model: "claude-haiku-4-5-20251001",
                  max_tokens: 100,
                  messages: [{
                    role: "user",
                    content: `From this text, extract a brief physical description of the main character (age, appearance, clothing, distinguishing features). If no clear physical description exists, infer from context. Reply in one sentence in English, only the physical description, no preamble:\n\n${parrafos.slice(0, 3).join(" ")}`,
                  }],
                }),
              });
              const extractData = await extractRes.json().catch(() => ({}));
              descripcionProtagonista = extractData.content?.[0]?.text?.trim() ?? null;
              if (descripcionProtagonista) controller.enqueue(enc.encode(sseMessage({ mensaje: `Protagonista: ${descripcionProtagonista}` })));
            } catch {
              // ignorar
            }
          }

          let imagenUrl: string | null = null;
          const temaBase = descripcionVisual
            ? descripcionVisual
            : (tituloRewritten && parrafos[0]
              ? `${tituloRewritten}. ${parrafos[0].slice(0, 300)}`
              : (tituloRewritten || parrafos[0]?.slice(0, 400) || "Escena narrativa"));

          const imagenTienePersona = descripcionVisual
            ? /\b(man|woman|person|people|elder|elderly|old|young|hombre|mujer|persona|anciano|anciana|dog|cat|horse|bird|animal|pet|puppy|kitten|perro|gato|caballo|pájaro|animal|mascota|cachorro|tiger|lion|bear|wolf|tigre|león|oso|lobo)\b/i.test(descripcionVisual)
            : false;
          const protagonistaLine = protagonistaFijo
            ? ` CRITICAL: The protagonist is ALWAYS this SAME individual, do not change ANY physical trait: ${protagonistaFijo}.`
            : (imagenTienePersona && descripcionProtagonista ? ` Main character physical appearance: ${descripcionProtagonista}.` : "");
          const descripcion = `RAW photo, DSLR, photorealistic, hyperrealistic, real photograph, NOT a painting, NOT illustrated, NOT digital art, NOT CGI. Canon EOS R5, 85mm lens, f/2.8, natural lighting. Recreate this scene: ${temaBase}.${protagonistaLine} Documentary photojournalism style, National Geographic. Sharp focus, film grain, real textures. Peaceful, non-violent scene. No dangerous objects. No text, no words, no letters, no signs, no logos, no watermarks, no icons, no symbols. No text, no words, no letters, no signs, no logos, no watermarks, no brands, no labels. Single image only, no split screen, no collage, no grid, no multiple panels, no divided image, no side by side comparison, no before and after, one single unified scene.`;
          try {
            controller.enqueue(enc.encode(sseMessage({ mensaje: `Generando imagen con Gemini 2.5 para página ${p}...` })));
            controller.enqueue(enc.encode(sseMessage({ mensaje: `DEBUG: imagenReferenciaBase64=${imagenReferenciaBase64 ? "SÍ (" + imagenReferenciaMimeType + ")" : "NO"}, protagonistaFijo=${protagonistaFijo ? "SÍ: " + protagonistaFijo.slice(0, 80) + "..." : "NO"}` })));

            const geminiRes: Response = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${process.env.GOOGLE_API_KEY}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{
                    parts: [
                      ...(imagenReferenciaBase64 ? [{
                        inlineData: {
                          mimeType: imagenReferenciaMimeType,
                          data: imagenReferenciaBase64,
                        },
                      }] : []),
                      {
                        text: imagenReferenciaBase64
                          ? `${descripcion} IMPORTANT: Maintain the exact same protagonist appearance as shown in the reference image. Same face, same age, same hair, same clothing style.`
                          : descripcion,
                      },
                    ],
                  }],
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

            if (imagePart?.inlineData?.data) {
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
              // Guardar primera imagen con persona como referencia
              if (!imagenReferenciaBase64 && imagenTienePersona && imagePart?.inlineData?.data) {
                imagenReferenciaBase64 = imagePart.inlineData.data;
                imagenReferenciaMimeType = imagePart.inlineData.mimeType ?? "image/png";
                controller.enqueue(enc.encode(sseMessage({ mensaje: `Imagen de referencia del protagonista guardada (página ${p})` })));
                controller.enqueue(enc.encode(sseMessage({ mensaje: `DEBUG referencia guardada: imagenTienePersona=${imagenTienePersona}, page=${p}` })));
              }
            } else {
              throw new Error("Gemini no devolvió imagen");
            }
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

          try {
            if (p === paginaInicio && storyId == null) {
              const baseSlug = slugify(tituloRewritten || "story", { lower: true, strict: true });
              let slug = baseSlug;
              let n = 0;
              for (;;) {
                const exists = await pool.query("SELECT 1 FROM stories WHERE slug = $1", [slug]);
                if (exists.rows.length === 0) break;
                n++;
                slug = `${baseSlug}-${n}`;
              }
              storySlug = slug;
              storyId = await createStory(slug, tituloRewritten || `Story ${p}`, total, urlBase || null);
            }
            if (storyId != null) {
              await addStoryPagina(storyId, p, imagenUrl, parrafos);
              await pool.query(
                `UPDATE stories SET total_paginas = (SELECT COUNT(*) FROM story_paginas WHERE story_id = $1), updated_at = NOW() WHERE id = $1`,
                [storyId]
              );
              if (protagonistaFijo) {
                await pool.query(
                  "UPDATE stories SET descripcion_protagonista = $1, updated_at = NOW() WHERE id = $2",
                  [protagonistaFijo, storyId]
                );
              }
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
