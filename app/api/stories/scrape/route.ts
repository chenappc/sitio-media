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
  try {
    const body = await req.json();
    urlBase = String(body.urlBase ?? "").trim();
    paginaInicio = Math.max(1, parseInt(String(body.paginaInicio ?? 1), 10) || 1);
    paginaFin = Math.max(paginaInicio, parseInt(String(body.paginaFin ?? 1), 10) || 1);
    if (!urlBase) {
      return NextResponse.json({ error: "Falta urlBase" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!anthropicKey || !openaiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY u OPENAI_API_KEY no configuradas" },
      { status: 500 }
    );
  }

  const total = paginaFin - paginaInicio + 1;
  let storyId: number | null = null;
  let storySlug: string = "";

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
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
            const firstImg = $("article img, .content img, main img, .post img, img").first();
            if (firstImg.length) {
              const src = firstImg.attr("src");
              if (src) {
                try {
                  imagenPrincipal = new URL(src, url).href;
                } catch {
                  imagenPrincipal = src;
                }
              }
            }
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

          let imagenUrl: string | null = null;
          const descripcionImagen = await (async () => {
            if (!imagenPrincipal) return null;
            try {
              controller.enqueue(enc.encode(sseMessage({ mensaje: `Analizando imagen original con Claude...` })));
              const claudeVisionRes = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-api-key": anthropicKey,
                  "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify({
                  model: "claude-haiku-4-5-20251001",
                  max_tokens: 300,
                  messages: [{
                    role: "user",
                    content: [
                      {
                        type: "image",
                        source: {
                          type: "url",
                          url: imagenPrincipal,
                        },
                      },
                      {
                        type: "text",
                        text: "Describe this image in one sentence focusing on the main subject, setting, mood and visual elements. Be specific and visual. Reply only with the description, no preamble.",
                      },
                    ],
                  }],
                }),
              });
              const visionData = await claudeVisionRes.json().catch(() => ({}));
              const desc = visionData.content?.[0]?.text?.trim() ?? null;
              if (desc) controller.enqueue(enc.encode(sseMessage({ mensaje: `Imagen descrita: ${desc}` })));
              return desc;
            } catch {
              return null;
            }
          })();

          const temaBase = descripcionImagen
            ? `${descripcionImagen}. Context: ${tituloRewritten}`
            : (tituloRewritten && parrafos[0]
              ? `${tituloRewritten}. ${parrafos[0].slice(0, 300)}`
              : (tituloRewritten || parrafos[0]?.slice(0, 400) || "Escena narrativa"));

          const descripcion = `Photorealistic photograph, journalistic style, natural lighting, high resolution. Scene: ${temaBase}. No text, no words, no letters, no signs, no watermarks, no logos. Cinematic composition, emotionally engaging, warm tones.`;
          try {
            controller.enqueue(enc.encode(sseMessage({ mensaje: `Generando imagen DALL-E para página ${p}...` })));
            const dallRes = await fetch("https://api.openai.com/v1/images/generations", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${openaiKey}`,
              },
              body: JSON.stringify({
                model: "dall-e-3",
                prompt: descripcion,
                n: 1,
                size: "1024x1024",
                quality: "standard",
              }),
            });
            const dallData = await dallRes.json().catch(() => ({}));
            controller.enqueue(enc.encode(sseMessage({ mensaje: `DALL-E response: ${JSON.stringify(dallData).slice(0, 300)}` })));
            const imgUrl = dallData.data?.[0]?.url;
            if (imgUrl) {
              controller.enqueue(enc.encode(sseMessage({ mensaje: `Subiendo imagen a Cloudinary...` })));
              const imgBuf = await fetch(imgUrl).then((r) => r.arrayBuffer());
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
              controller.enqueue(enc.encode(sseMessage({ mensaje: `Imagen subida: ${imagenUrl}` })));
            }
          } catch (e) {
            controller.enqueue(enc.encode(sseMessage({
              pagina: p,
              total,
              status: "error",
              mensaje: `Error DALL-E/Cloudinary: ${e instanceof Error ? e.message : String(e)}`,
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
            if (p === paginaInicio) {
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
              storyId = await createStory(slug, tituloRewritten || `Story ${p}`, total);
            }
            if (storyId != null) {
              await addStoryPagina(storyId, p, imagenUrl, parrafos);
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
