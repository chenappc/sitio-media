import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { Readable } from "stream";
import cloudinary from "@/lib/cloudinary";
import pool from "@/lib/db";
import { createStory, addStoryPagina } from "@/lib/stories";
import slugify from "slugify";
import sharp from "sharp";

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
  let sinImagenesIa = false;
  let initialStoryId: number | null = null;
  let initialStorySlug: string = "";
  try {
    const body = await req.json();
    urlBase = String(body.urlBase ?? "").trim();
    paginaInicio = Math.max(1, parseInt(String(body.paginaInicio ?? 1), 10) || 1);
    paginaFin = Math.max(paginaInicio, parseInt(String(body.paginaFin ?? 1), 10) || 1);
    sinImagenesIa = Boolean(body.sinImagenesIa);
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
      let contextoPaginas: string = "";
      if (initialStoryId != null) {
        storyId = initialStoryId;
        storySlug = initialStorySlug;
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

          return { p, tituloRewritten, parrafos, imagenPrincipal, descripcionVisual: null };
        }

        for (let p = paginaInicio; p <= phase1End; p++) {
          const page = await leerYProcesarPagina(p);
          if (page) paginasFase1.push(page);
        }

        // Crear story lo antes posible si no existe.
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

        async function generarImagenYSubir(page: PageData): Promise<{ imagenUrl: string | null }> {
          const { p, tituloRewritten, parrafos, imagenPrincipal } = page;
          let imagenUrl: string | null = null;

          let promptParaGemini: string;
          let imagenBase64: string | null = null;
          let imagenMimeType: string = "image/png";

          if (sinImagenesIa) {
            if (imagenPrincipal) {
              try {
                controller.enqueue(enc.encode(sseMessage({ mensaje: `Usando imagen original para página ${p} (sin IA)...` })));
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
                controller.enqueue(enc.encode(sseMessage({ mensaje: `Imagen original subida: ${imagenUrl}` })));
              } catch (e) {
                controller.enqueue(enc.encode(sseMessage({
                  status: "error",
                  mensaje: `Error imagen original: ${e instanceof Error ? e.message : String(e)}`,
                })));
              }
            }
            return { imagenUrl };
          }

          if (imagenPrincipal) {
            try {
              controller.enqueue(enc.encode(sseMessage({ mensaje: `Descargando imagen de referencia para página ${p}...` })));
              console.log(`[DEBUG página ${p}] imagenPrincipal =`, imagenPrincipal ?? "(null)");
              const imgRes = await fetch(imagenPrincipal, { headers: { "User-Agent": UA } });
              if (imgRes.ok) {
                const buf = Buffer.from(await imgRes.arrayBuffer());
                imagenBase64 = buf.toString("base64");
                const ct = imgRes.headers.get("content-type") ?? "";
                imagenMimeType = ct.startsWith("image/") ? ct.split(";")[0].trim() : "image/png";
              }
            } catch {
              // seguir sin imagen de referencia
            }
          }

          if (imagenBase64) {
            promptParaGemini =
              "You are a cinematic image generator. Recreate this scene as a brand new cinematic illustration. Do NOT copy or upscale the original image — generate a completely new artistic interpretation. Rules: 1. Identify the characters, setting and action in the image. 2. Redraw the entire scene from scratch in a cinematic, photorealistic style with dramatic lighting, rich colors and depth. 3. Keep the same characters, setting and action but render them as if shot by a professional cinematographer. 4. The output must look visually different from the input — new camera angle, new lighting, richer atmosphere. 5. Do not include any weapons, guns, knives, firearms, or violent imagery of any kind. Output: a single cinematic photorealistic scene.";
          } else {
            const pageText = (tituloRewritten && parrafos.length > 0)
              ? `${tituloRewritten}. ${parrafos.join(" ")}`
              : (parrafos.length > 0 ? parrafos.join(" ") : "");
            const claudePromptForGemini = `You are a prompt engineer for AI image generation. Based on the story text below, write a single detailed cinematic prompt for an AI image generator. The prompt must:
1. Describe the exact scene happening in this page's text (setting, action, mood, time of day)
2. Be photorealistic, documentary style, National Geographic quality
3. NOT include any text, logos, watermarks, split screens or collages
4. Be a single unified scene

Page text: ${pageText}

Write ONLY the image generation prompt, nothing else, no preamble, no explanation.`;
            const CLAUDE_MODEL_PROMPT = "claude-haiku-4-5-20251001";
            const CLAUDE_MAX_TOKENS_PROMPT = 1024;
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
              if (!claudeRes.ok || !(claudeBody?.content?.[0]?.text?.trim())) {
                const errDetail = claudeRes.ok ? "Claude no devolvió prompt" : `Claude prompt error: HTTP ${claudeRes.status}`;
                controller.enqueue(enc.encode(sseMessage({ pagina: p, total, status: "error", mensaje: errDetail })));
                return { imagenUrl };
              }
              promptParaGemini = (claudeBody.content[0].text ?? "").trim() + " Important: do not include any weapons, guns, knives, firearms, or violent imagery of any kind.";
            } catch (e) {
              controller.enqueue(enc.encode(sseMessage({
                pagina: p,
                total,
                status: "error",
                mensaje: `Error Claude (prompt): ${e instanceof Error ? e.message : String(e)}`,
              })));
              return { imagenUrl };
            }
          }

          try {
            controller.enqueue(enc.encode(sseMessage({ mensaje: `Generando imagen con Gemini 2.5 para página ${p}...` })));
            const geminiParts: Array<{ inlineData?: { mimeType: string; data: string } } | { text: string }> = [
              ...(imagenBase64 ? [{ inlineData: { mimeType: imagenMimeType, data: imagenBase64 } }] : []),
              { text: promptParaGemini },
            ];
            console.log(
              `[DEBUG página ${p}] imagenBase64:`,
              !!imagenBase64,
            );
            const geminiRes: Response = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${googleApiKeyStr}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts: geminiParts }],
                  generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
                }),
              }
            );
            type GeminiPart = { inlineData?: { mimeType?: string; data?: string } };
            const geminiData = (await geminiRes.json().catch(() => ({}))) as {
              candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
            };
            console.log(
              `[DEBUG página ${p}] Gemini candidates:`,
              JSON.stringify(geminiData?.candidates?.length),
              "| parts:",
              JSON.stringify(
                geminiData?.candidates?.[0]?.content?.parts?.map(
                  (prt: GeminiPart) => prt.inlineData?.mimeType ?? "text"
                )
              )
            );
            const parts: GeminiPart[] = geminiData.candidates?.[0]?.content?.parts ?? [];
            const imagePart = parts.find((part: GeminiPart) =>
              part.inlineData?.mimeType?.startsWith("image/")
            );

            if (!imagePart?.inlineData?.data) throw new Error("Gemini no devolvió imagen");

            controller.enqueue(enc.encode(sseMessage({ mensaje: `Subiendo imagen a Cloudinary...` })));
            const buf = await sharp(Buffer.from(imagePart.inlineData.data, "base64"))
              .resize({ height: 550, fit: "inside", withoutEnlargement: true })
              .toBuffer();
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
            console.log(`[DEBUG página ${p}] Cloudinary upload exitoso:`, imagenUrl);
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
              const buf = await sharp(Buffer.from(imgBuf))
                .resize({ height: 550, fit: "inside", withoutEnlargement: true })
                .toBuffer();
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
              console.log(`[DEBUG página ${p}] FALLBACK usado, imagenUrl:`, imagenUrl);
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
