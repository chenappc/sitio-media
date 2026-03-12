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

type RawItem = { titulo: string; imagenUrl: string | null; parrafos: string[] };

/** Extrae ítems del HTML: cada h2/h3 y su bloque de contenido (img + párrafos) hasta el siguiente h2/h3. */
function extraerItems($: cheerio.CheerioAPI, baseUrl: string): RawItem[] {
  const items: RawItem[] = [];
  const headings = $("h2, h3").toArray();
  for (let i = 0; i < headings.length; i++) {
    const el = headings[i];
    const $el = $(el);
    const titulo = $el.text().trim();
    if (!titulo || titulo.length < 2) continue;
    const nextHeading = headings[i + 1];
    const $block = nextHeading
      ? $el.nextUntil($(nextHeading))
      : $el.nextAll();
    let imagenUrl: string | null = null;
    const $firstImg = $block.find("img").first().length ? $block.find("img").first() : $block.filter("img").first();
    const src =
      $firstImg.attr("data-layzr") ||
      $firstImg.attr("data-lazy-src") ||
      $firstImg.attr("data-src") ||
      $firstImg.attr("src") ||
      "";
    if (src && !src.startsWith("data:") && !/logo|icon|avatar|sprite|pixel|1x1|tracking|badge|button/i.test(src)) {
      try {
        imagenUrl = new URL(src, baseUrl).href;
      } catch {
        imagenUrl = src;
      }
    }
    const parrafosRaw: string[] = [];
    $block.find("p").each((_, p) => {
      const t = $(p).text().trim();
      if (t.length >= 50) parrafosRaw.push(t);
    });
    const parrafos = filterParrafos(parrafosRaw);
    items.push({ titulo, imagenUrl, parrafos });
  }
  return items;
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

        const articuloTitulo = ($("h1").first().text() || $("title").text() || "Especial").trim();
        const items = extraerItems($, urlBase);
        if (items.length === 0) {
          enq({ status: "error", mensaje: "No se encontraron ítems (h2/h3 con contenido)" });
          close();
          return;
        }

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
          let parrafos: string[] = item.parrafos;

          if (idioma !== "original" && (item.titulo || item.parrafos.length > 0)) {
            try {
              enq({ mensaje: `Claude: reescribiendo ítem ${numero}...` });
              const langInstruction =
                idioma === "es"
                  ? "Reescribí en español neutro, manteniendo el sentido. Título breve y atractivo; párrafos claros."
                  : "Rewrite in English, keeping the same meaning. Short catchy title; clear paragraphs.";
              const payload = { titulo: item.titulo, parrafos: item.parrafos };
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
                      content: `${langInstruction} Devolvé SOLO un JSON: { "titulo": "string", "parrafos": ["string", ...] }.\n\n${JSON.stringify(payload)}`,
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

          try {
            await addEspecialPagina(especialId, numero, tituloItem, imagenUrl, imagenOriginalUrl, parrafos);
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
