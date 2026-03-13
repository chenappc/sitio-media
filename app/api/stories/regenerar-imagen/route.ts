import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import * as cheerio from "cheerio";
import cloudinary from "@/lib/cloudinary";
import { getStoryBySlug, getStoryPagina, updateStoryPaginaImagen } from "@/lib/stories";

const ADMIN_SECRET = process.env.ADMIN_SECRET;
const UA = "Mozilla/5.0 (compatible; sitio-media-bot/1.0)";

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

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const googleApiKey = process.env.GOOGLE_API_KEY;
  if (!anthropicKey || !googleApiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY o GOOGLE_API_KEY no configuradas" },
      { status: 500 }
    );
  }

  let storySlug: string;
  let pagina: number;
  let urlPagina: string | undefined;
  let descripcionCustom: string | undefined;
  try {
    const body = await req.json();
    storySlug = String(body.storySlug ?? "").trim();
    pagina = Math.max(1, parseInt(String(body.pagina ?? 1), 10) || 1);
    urlPagina = typeof body.urlPagina === "string" && body.urlPagina.trim() ? body.urlPagina.trim() : undefined;
    descripcionCustom = typeof body.descripcionCustom === "string" ? body.descripcionCustom : undefined;
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

        let imagenReferenciaBase64: string | null = null;
        let imagenReferenciaMimeType: string = "image/png";
        if (pagina > 1) {
          const paginaAnterior = paginas.find((p) => p.numero === pagina - 1);
          const imagenAnteriorUrl = paginaAnterior?.imagen_url?.trim();
          if (imagenAnteriorUrl) {
            try {
              controller.enqueue(enc.encode(sseMessage({ mensaje: "Cargando imagen de la página anterior como referencia..." })));
              const imgRes = await fetch(imagenAnteriorUrl, { headers: { "User-Agent": UA } });
              if (imgRes.ok) {
                const buf = Buffer.from(await imgRes.arrayBuffer());
                imagenReferenciaBase64 = buf.toString("base64");
                const contentType = imgRes.headers.get("content-type") ?? "";
                imagenReferenciaMimeType = contentType.startsWith("image/") ? contentType.split(";")[0].trim() : "image/png";
              }
            } catch {
              // ignorar
            }
          }
        }

        const descripcionProtagonistaFijo = story.descripcion_protagonista?.trim() ?? null;
        const protagonistaLine = descripcionProtagonistaFijo
          ? (() => {
              const { animal: descAnimal, human: descHumano } = splitProtagonistaFijoEnAnimalYHumano(descripcionProtagonistaFijo);
              return ` MANDATORY: If this scene includes a dog or animal, it MUST be depicted as: ${descAnimal}. If this scene includes a person, they MUST look exactly like: ${descHumano}. Use the reference image provided as the visual guide. Same individual, same appearance, every single image, no exceptions.`;
            })()
          : "";

        const parrafos = Array.isArray(pageRow.parrafos)
          ? (pageRow.parrafos as string[]).filter((p) => typeof p === "string" && p.trim())
          : [];
        const titulo = story.titulo;

        let descripcion: string;
        if (descripcionCustom?.trim()) {
          const instruccionesRefYNarrativa = " CRITICAL INSTRUCTIONS: (1) The reference image is ONLY for knowing how the characters look. DO NOT copy the composition, pose, setting or scene from the reference image. Generate a completely new scene. (2) The image MUST illustrate specifically what is happening in the text of this page. The scene, action, place and context must faithfully reflect the narrative content of the text. Do not generate generic scenes.";
          descripcion = descripcionCustom.trim() + protagonistaLine + instruccionesRefYNarrativa + ". No text, no words, no letters, no signs, no logos, no watermarks, no brands, no labels. Single image only, no split screen, no collage, no grid, no multiple panels, no divided image, no side by side comparison, no before and after, one single unified scene.";
          controller.enqueue(enc.encode(sseMessage({ mensaje: "Usando prompt custom" })));
        } else {
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

        let imagenPrincipalBase64: string | null = null;
        let imagenPrincipalMimeType: string = "image/png";
        if (imagenPrincipal) {
          try {
            controller.enqueue(enc.encode(sseMessage({ mensaje: "Descargando imagen de referencia..." })));
            const imgRes = await fetch(imagenPrincipal, { headers: { "User-Agent": UA } });
            if (imgRes.ok) {
              const buf = Buffer.from(await imgRes.arrayBuffer());
              imagenPrincipalBase64 = buf.toString("base64");
              const ct = imgRes.headers.get("content-type") ?? "";
              imagenPrincipalMimeType = ct.startsWith("image/") ? ct.split(";")[0].trim() : "image/png";
            }
          } catch {
            // ignorar
          }
        }

        let descripcionVisual: string | null = null;
        if (imagenPrincipal && !imagenPrincipalBase64) {
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
                      text: "Describe all the visual elements of this image in one sentence: all people present (their age, appearance, clothing), their positions and interactions with each other, the setting, objects, colors, and lighting. Do NOT mention actions involving conflict or violence. Do NOT mention text, logos, brands or websites. Be specific about how many people are in the scene and what they are doing together.",
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

        const useImageToImage = !!imagenPrincipalBase64;
        if (useImageToImage) {
          // El prompt se definirá más abajo según si hay referencia de personajes o no.
          descripcion =
            "Recreate this scene in a cinematic, photorealistic style. Keep the exact same people from the reference image — same faces, same physical appearance, same clothing. Only reinterpret the visual style to be more cinematic: improve lighting, depth, atmosphere and composition. Do not change who is in the scene. Important: do not include any weapons, guns, knives, firearms, or violent imagery of any kind.";
        } else {
          const imagenTienePersona = descripcionVisual
            ? /\b(man|woman|person|people|elder|elderly|old|young|hombre|mujer|persona|anciano|anciana)\b/i.test(descripcionVisual)
            : false;
          const instruccionesRefYNarrativa = " CRITICAL INSTRUCTIONS: (1) The reference image is ONLY for knowing how the characters look. DO NOT copy the composition, pose, setting or scene from the reference image. Generate a completely new scene. (2) The image MUST illustrate specifically what is happening in the text of this page. The scene, action, place and context must faithfully reflect the narrative content of the text. Do not generate generic scenes.";
          descripcion = `RAW photo, DSLR, photorealistic, hyperrealistic, real photograph, NOT a painting, NOT illustrated, NOT digital art, NOT CGI. Canon EOS R5, 85mm lens, f/2.8, natural lighting. Recreate this scene: ${temaBase}.${protagonistaLine}${instruccionesRefYNarrativa}${imagenTienePersona && descripcionProtagonista ? ` Main character physical appearance: ${descripcionProtagonista}.` : ""} Documentary photojournalism style, National Geographic. Sharp focus, film grain, real textures. Peaceful, non-violent scene. No dangerous objects. No text, no words, no letters, no signs, no logos, no watermarks, no icons, no symbols. No text, no words, no letters, no signs, no logos, no watermarks, no brands, no labels. Single image only, no split screen, no collage, no grid, no multiple panels, no divided image, no side by side comparison, no before and after, one single unified scene.`;
        }

        const geminiBodyParts: Array<{ inlineData?: { mimeType: string; data: string } } | { text: string }> = [];
        if (useImageToImage && imagenPrincipalBase64) {
          if (imagenReferenciaBase64) {
            const promptCadena =
              "The second image defines the scene — use it to determine the setting, composition, atmosphere, and which characters appear. The first image is a character reference — if any person in the second image resembles a character from the first image, render them with the exact same face, appearance and clothing as in the first image. Do not add any characters that are not already present in the second image. Reinterpret the scene cinematically with dramatic lighting. Important: do not include any weapons, guns, knives, firearms, or violent imagery of any kind.";
            geminiBodyParts.push({ inlineData: { mimeType: imagenReferenciaMimeType, data: imagenReferenciaBase64 } });
            geminiBodyParts.push({ inlineData: { mimeType: imagenPrincipalMimeType, data: imagenPrincipalBase64 } });
            geminiBodyParts.push({ text: promptCadena });
          } else {
            const promptUnica =
              "Recreate this scene in a cinematic, photorealistic style. Keep the exact same people — same faces, same physical appearance, same clothing. Reinterpret the visual style to be more cinematic: improve lighting, depth, atmosphere and composition. Important: do not include any weapons, guns, knives, firearms, or violent imagery of any kind.";
            geminiBodyParts.push({ inlineData: { mimeType: imagenPrincipalMimeType, data: imagenPrincipalBase64 } });
            geminiBodyParts.push({ text: promptUnica });
          }
        } else {
          geminiBodyParts.push(
            ...(imagenReferenciaBase64 ? [{ inlineData: { mimeType: imagenReferenciaMimeType, data: imagenReferenciaBase64 } }] : []),
          );
          geminiBodyParts.push({ text: descripcion });
        }
        controller.enqueue(enc.encode(sseMessage({ mensaje: "Generando imagen con Gemini 2.5..." })));
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${googleApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: geminiBodyParts }],
              generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
            }),
          }
        );
        const geminiData = await geminiRes.json().catch(() => ({}));
        const parts = geminiData.candidates?.[0]?.content?.parts ?? [];
        const imagePart = parts.find((part: { inlineData?: { mimeType?: string; data?: string } }) =>
          part.inlineData?.mimeType?.startsWith("image/")
        );
        const imageBase64 = imagePart?.inlineData?.data;
        if (!imageBase64) {
          controller.enqueue(enc.encode(sseMessage({
            status: "error",
            mensaje: geminiData.error?.message ?? "Gemini no devolvió imagen",
          })));
          controller.close();
          return;
        }

        controller.enqueue(enc.encode(sseMessage({ mensaje: "Subiendo a Cloudinary..." })));
        const buf = Buffer.from(imageBase64, "base64");
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
