import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import * as cheerio from "cheerio";
import cloudinary from "@/lib/cloudinary";
import { getStoryBySlug, getStoryPagina, updateStoryPaginaImagen } from "@/lib/stories";

const ADMIN_SECRET = process.env.ADMIN_SECRET;
const UA = "Mozilla/5.0 (compatible; sitio-media-bot/1.0)";

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

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!anthropicKey || !openaiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY u OPENAI_API_KEY no configuradas" },
      { status: 500 }
    );
  }

  let storySlug: string;
  let pagina: number;
  let urlPagina: string | undefined;
  try {
    const body = await req.json();
    storySlug = String(body.storySlug ?? "").trim();
    pagina = Math.max(1, parseInt(String(body.pagina ?? 1), 10) || 1);
    urlPagina = typeof body.urlPagina === "string" && body.urlPagina.trim() ? body.urlPagina.trim() : undefined;
    if (!storySlug) {
      return NextResponse.json({ error: "Falta storySlug" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        controller.enqueue(enc.encode(sseMessage({ mensaje: "Preparando escena..." })));

        const { story, paginas } = await getStoryBySlug(storySlug);
        if (!story) {
          controller.enqueue(enc.encode(sseMessage({ status: "error", mensaje: "Story no encontrada" })));
          controller.close();
          return;
        }
        const pageRow = paginas.find((p) => p.numero === pagina);
        if (!pageRow) {
          controller.enqueue(enc.encode(sseMessage({ status: "error", mensaje: "Página no encontrada" })));
          controller.close();
          return;
        }

        const parrafos = Array.isArray(pageRow.parrafos)
          ? (pageRow.parrafos as string[]).filter((p) => typeof p === "string" && p.trim())
          : [];
        const titulo = story.titulo;

        let descripcionProtagonista: string | null = null;
        if (pagina === 1 && parrafos.length > 0) {
          try {
            controller.enqueue(enc.encode(sseMessage({ mensaje: "Extrayendo protagonista..." })));
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
            if (descripcionProtagonista) {
              controller.enqueue(enc.encode(sseMessage({ mensaje: `Protagonista: ${descripcionProtagonista}` })));
            }
          } catch {
            // ignorar
          }
        } else if (pagina > 1) {
          try {
            controller.enqueue(enc.encode(sseMessage({ mensaje: "Extrayendo protagonista (p.1)..." })));
            const { pagina: page1 } = await getStoryPagina(storySlug, 1);
            if (page1?.parrafos && Array.isArray(page1.parrafos) && page1.parrafos.length > 0) {
              const text = (page1.parrafos as string[]).slice(0, 3).join(" ");
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
                    content: `From this text, extract a brief physical description of the main character (age, appearance, clothing, distinguishing features). If no clear physical description exists, infer from context. Reply in one sentence in English, only the physical description, no preamble:\n\n${text}`,
                  }],
                }),
              });
              const extractData = await extractRes.json().catch(() => ({}));
              descripcionProtagonista = extractData.content?.[0]?.text?.trim() ?? null;
            }
          } catch {
            // ignorar
          }
        }

        let imagenPrincipal: string | null = null;
        if (urlPagina) {
          try {
            const res = await fetch(`${urlPagina}?_=${Date.now()}`, { headers: { "User-Agent": UA, "Cache-Control": "no-cache" } });
            const html = await res.text();
            const $ = cheerio.load(html);
            $("img").each((_, el) => {
              if (imagenPrincipal) return;
              const src = $(el).attr("data-layzr") || $(el).attr("data-lazy-src") || $(el).attr("data-src") || $(el).attr("src") || "";
              if (!src || src.startsWith("data:")) return;
              if (/logo|icon|avatar|sprite|pixel|1x1|tracking|badge|button/i.test(src)) return;
              if (/logo|icon|avatar/i.test($(el).attr("class") || "")) return;
              try {
                imagenPrincipal = new URL(src, urlPagina).href;
              } catch {
                imagenPrincipal = src;
              }
            });
          } catch {
            // ignorar
          }
        }

        let descripcionVisual: string | null = null;
        if (imagenPrincipal) {
          try {
            controller.enqueue(enc.encode(sseMessage({ mensaje: "Analizando imagen original..." })));
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
                    { type: "image", source: { type: "url", url: imagenPrincipal } },
                    {
                      type: "text",
                      text: "Describe only the neutral visual elements of this image: setting, environment, people's clothing and physical appearance, objects, colors, lighting, mood. Do NOT mention any actions, conflicts, weapons, or narrative context. Do NOT mention text, logos, brands or websites. Reply in one sentence, only a calm visual description of what you literally see.",
                    },
                  ],
                }],
              }),
            });
            const visionData = await visionRes.json().catch(() => ({}));
            descripcionVisual = visionData.content?.[0]?.text?.trim() ?? null;
            if (descripcionVisual) {
              controller.enqueue(enc.encode(sseMessage({ mensaje: `Visual: ${descripcionVisual}` })));
            }
          } catch {
            // ignorar
          }
        }

        const temaBase = descripcionVisual
          ? descripcionVisual
          : (titulo && parrafos[0]
            ? `${titulo}. ${String(parrafos[0]).slice(0, 300)}`
            : (titulo || String(parrafos[0] ?? "").slice(0, 400) || "Escena narrativa"));

        controller.enqueue(enc.encode(sseMessage({ mensaje: "Generando imagen con DALL-E..." })));
        const descripcion = `RAW photo, DSLR, photorealistic, hyperrealistic, real photograph, NOT a painting, NOT illustrated, NOT digital art, NOT CGI. Canon EOS R5, 85mm lens, f/2.8, natural lighting. Recreate this scene: ${temaBase}.${descripcionProtagonista ? ` Main character physical appearance: ${descripcionProtagonista}.` : ""} Documentary photojournalism style, National Geographic. Sharp focus, film grain, real textures. Peaceful, non-violent scene. No dangerous objects. No text, no words, no letters, no signs, no logos, no watermarks, no icons, no symbols.`;

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
        const imgUrl = dallData.data?.[0]?.url;
        if (!imgUrl) {
          controller.enqueue(enc.encode(sseMessage({
            status: "error",
            mensaje: dallData.error?.message ?? "DALL-E no devolvió imagen",
          })));
          controller.close();
          return;
        }

        controller.enqueue(enc.encode(sseMessage({ mensaje: "Subiendo a Cloudinary..." })));
        const imgBuf = await fetch(imgUrl).then((r) => r.arrayBuffer());
        const buf = Buffer.from(imgBuf);
        const imagenUrl = await new Promise<string>((resolve, reject) => {
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
        await updateStoryPaginaImagen(story.id, pagina, imagenUrl);
        controller.enqueue(enc.encode(sseMessage({ done: true, imagenUrl })));
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
