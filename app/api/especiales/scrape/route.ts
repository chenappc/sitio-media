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

function isImageValid($: cheerio.CheerioAPI, el: cheerio.Element, src: string): boolean {
  if (!src || src.startsWith("data:")) return false;
  if (IMG_SKIP.test(src)) return false;
  if (/logo|icon|avatar/i.test($(el).attr("class") || "")) return false;
  return true;
}

function auth(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret");
  return !!ADMIN_SECRET && secret === ADMIN_SECRET;
}

function sseMessage(obj: object): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

type RawItem = { titulo: string; imagenUrl: string | null; parrafos: string[] };

/** Resuelve src de una img y normaliza URL. */
function resolveImgSrc($: cheerio.CheerioAPI, el: cheerio.Element, baseUrl: string): string | null {
  const $el = $(el);
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

/** ESTRATEGIA 1 — Headings: h2/h3/h4, título = heading, primera imagen del bloque, párrafos hasta el siguiente heading. */
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
    let imagenUrl: string | null = null;
    const $firstImg = $block.find("img").first().length ? $block.find("img").first() : $block.filter("img").first();
    const src =
      $firstImg.attr("data-layzr") ||
      $firstImg.attr("data-lazy-src") ||
      $firstImg.attr("data-src") ||
      $firstImg.attr("src") ||
      "";
    const imgEl = $firstImg.length ? ($firstImg[0] as cheerio.Element) : null;
    if (src && imgEl && isImageValid($, imgEl, src)) {
      try {
        imagenUrl = new URL(src, baseUrl).href;
      } catch {
        imagenUrl = src;
      }
    }
    const parrafosRaw: string[] = [];
    $block.find("p").each((_, p) => {
      const t = $(p).text().trim();
      if (isParagraphValid(t)) parrafosRaw.push(t);
    });
    items.push({ titulo, imagenUrl, parrafos: filterParrafos(parrafosRaw) });
  }
  return items.slice(0, MAX_ITEMS);
}

/** ESTRATEGIA 2 — Bloques imagen+texto: orden DOM, cada imagen inicia ítem; título = primeros 80 chars del primer p. */
function extraerPorImagenes($: cheerio.CheerioAPI, baseUrl: string): RawItem[] {
  const items: RawItem[] = [];
  const elements = $("body").find("img, p").toArray();
  let leadingParrafos: string[] = [];
  let currentItem: RawItem | null = null;

  for (const el of elements) {
    if (items.length >= MAX_ITEMS) break;
    const tagName = (el as { name?: string }).name ?? "";
    if (tagName === "img") {
      const imagenUrl = resolveImgSrc($, el, baseUrl);
      if (imagenUrl != null) {
        if (leadingParrafos.length > 0 && items.length === 0) {
          const titulo = leadingParrafos[0].slice(0, 80).trim() || "";
          items.push({ titulo, imagenUrl: null, parrafos: filterParrafos(leadingParrafos) });
          leadingParrafos = [];
        }
        currentItem = { titulo: "", imagenUrl, parrafos: [] };
        items.push(currentItem);
      }
    } else if (tagName === "p") {
      const text = $(el).text().trim().replace(/\s+/g, " ");
      if (!isParagraphValid(text)) continue;
      const filtered = filterParrafos([text]);
      if (filtered.length === 0) continue;
      const t = filtered[0];
      if (currentItem != null) {
        currentItem.parrafos.push(t);
        if (!currentItem.titulo) currentItem.titulo = t.slice(0, 80).trim();
      } else {
        leadingParrafos.push(t);
      }
    }
  }
  for (const it of items) {
    if (!it.titulo && it.parrafos.length > 0) it.titulo = it.parrafos[0].slice(0, 80).trim();
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
    const parrafos = filtered.slice(i, i + 3); // 2 o 3 párrafos por ítem
    if (parrafos.length === 0) break;
    const titulo = parrafos[0].slice(0, 80).trim() || "";
    items.push({ titulo, imagenUrl: null, parrafos });
    i += parrafos.length;
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
        let items: RawItem[] = [];
        let estrategiaUsada = "";

        const items1 = extraerPorHeadings($, urlBase);
        if (items1.length >= 2) {
          items = items1;
          estrategiaUsada = "Headings (h2/h3/h4)";
        }
        if (items.length === 0) {
          enq({ mensaje: "Estrategia 1 (Headings) insuficiente; probando Estrategia 2 (imagen+párrafos)..." });
          const items2 = extraerPorImagenes($, urlBase);
          if (items2.length >= 2) {
            items = items2;
            estrategiaUsada = "Bloques imagen+texto";
          }
        }
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
