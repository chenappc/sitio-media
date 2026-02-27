import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import * as cheerio from "cheerio";
import sharp from "sharp";
import cloudinary from "@/lib/cloudinary";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "sitio2026";
const CLAUDE_MODEL = "claude-sonnet-4-20250514";

function auth(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret");
  return secret === ADMIN_SECRET;
}

function resolveUrl(base: string, path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  try {
    return new URL(path, base).href;
  } catch {
    return path;
  }
}

export async function POST(req: NextRequest) {
  if (!auth(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { url, pais } = body;
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Falta url" }, { status: 400 });
    }
    const urlClean = url.trim();
    const paisStr = typeof pais === "string" ? pais.trim() : "general";

    const res = await fetch(urlClean, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; sitio-media-bot/1.0)",
      },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `No se pudo obtener la URL: ${res.status}` },
        { status: 400 }
      );
    }
    const html = await res.text();
    const $ = cheerio.load(html);

    const tituloOriginal =
      $('meta[property="og:title"]').attr("content")?.trim() ||
      $("title").first().text().trim() ||
      "";

    let cuerpoOriginal = "";
    const article =
      $("article").first().length > 0
        ? $("article").first()
        : $('[role="article"]').first().length > 0
          ? $('[role="article"]').first()
          : $("main").first().length > 0
            ? $("main").first()
            : $(".post-content, .article-body, .content, .entry-content").first();
    if (article.length) {
      cuerpoOriginal = article.find("p").length
        ? article
            .find("p")
            .map((_, el) => $(el).text().trim())
            .get()
            .filter(Boolean)
            .join("\n\n")
        : article.text().trim();
    }
    if (!cuerpoOriginal && $("p").length) {
      cuerpoOriginal = $("p")
        .slice(0, 20)
        .map((_, el) => $(el).text().trim())
        .get()
        .filter(Boolean)
        .join("\n\n");
    }
    if (!cuerpoOriginal) cuerpoOriginal = $("body").text().trim().slice(0, 8000);

    let imagenPrincipal =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content");
    if (!imagenPrincipal) {
      const img = $("article img, main img, .post-content img, .article-body img, .content img").first();
      if (img.length) imagenPrincipal = img.attr("src") || undefined;
    }
    if (!imagenPrincipal) {
      const img = $("img[src]").first();
      if (img.length) imagenPrincipal = img.attr("src");
    }
    if (imagenPrincipal) {
      imagenPrincipal = resolveUrl(urlClean, imagenPrincipal);
    }

    let nombreMedio =
      $('meta[property="og:site_name"]').attr("content")?.trim() || "";
    if (!nombreMedio) {
      try {
        nombreMedio = new URL(urlClean).hostname.replace(/^www\./, "");
      } catch {
        nombreMedio = "la fuente";
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY no configurada" },
        { status: 500 }
      );
    }

    const systemPrompt = `Sos un editor de noticias virales para sitio.media. Tu tarea es curar artículos para audiencias hispanohablantes. Seguís estas reglas estrictamente:

1. EXTENSIÓN: El artículo curado debe tener exactamente la misma cantidad de palabras que el original, con una variación máxima del 5% (ni más ni menos).
2. PRECISIÓN: No exagerés ni inventés datos. Si la nota dice que un video tiene visitas, usá el número exacto mencionado. Si no hay número confirmado, no digas 'millones' ni agregues cifras que no están en el original.
3. LENGUAJE: Usá un español cotidiano, amigable y natural del país elegido. Evitá tecnicismos innecesarios. El texto debe ser fácil de leer, agradable y culturalmente apropiado para ese país.
4. VIRALIDAD: Mantené los elementos que hicieron viral la nota: el gancho emocional, el dato sorprendente, el conflicto o la curiosidad. No los suavices ni los elimines.
5. ORIGINALIDAD: Reescribí completamente, nunca copies frases del original. Debe pasar cualquier detector de plagio.
6. NOMBRES Y LUGARES: Siempre mencioná los nombres propios, personas, lugares, ciudades, países, instituciones y marcas que aparecen en el artículo original. No los omitas ni los reemplaces por referencias vagas como 'una persona', 'un lugar' o 'una institución'. Los nombres propios son parte del valor noticioso y de la viralidad.

Siempre respondé SOLO con JSON válido sin markdown ni backticks.`;
    const userPrompt = `País de la audiencia: ${paisStr}.

Título original del artículo:
${tituloOriginal}

Cuerpo original (texto plano):
${cuerpoOriginal.slice(0, 12000)}

Nombre del medio de origen (usar para el párrafo final): ${nombreMedio}

Devuelve ÚNICAMENTE un objeto JSON con estas tres claves (sin markdown, sin \`\`\`):
- "titulo": título curado en español del país, manteniendo el gancho viral, máximo 80 caracteres.
- "cuerpo": cuerpo curado en HTML. Cada párrafo debe ir envuelto en su propia etiqueta <p>. No uses otros contenedores: solo <p> para cada párrafo separado. 300-500 palabras, en el español del país elegido. Al final del cuerpo, antes de cerrar, agregá un último párrafo en etiqueta <p> normal (sin negrita ni estilo especial) con exactamente este texto: "Nota original publicada en ${nombreMedio}." Ese párrafo es parte natural del artículo.
- "adcopy": texto para Facebook, máximo 3 líneas cortas, sin hashtags, que genere curiosidad y clicks sin revelar todo.`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error("Claude API error:", claudeRes.status, errText);
      return NextResponse.json(
        { error: `Error de Claude: ${claudeRes.status}` },
        { status: 502 }
      );
    }

    const claudeData = (await claudeRes.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text =
      claudeData.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
    let jsonStr = text;
    const codeMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeMatch) jsonStr = codeMatch[1].trim();
    let parsed: { titulo?: string; cuerpo?: string; adcopy?: string };
    try {
      parsed = JSON.parse(jsonStr) as { titulo?: string; cuerpo?: string; adcopy?: string };
    } catch {
      return NextResponse.json(
        { error: "Claude no devolvió JSON válido" },
        { status: 502 }
      );
    }

    const titulo = String(parsed.titulo ?? tituloOriginal).trim();
    const cuerpo = String(parsed.cuerpo ?? "").trim();
    const adcopy = String(parsed.adcopy ?? "").trim();

    let imagen_url: string | null = null;
    if (imagenPrincipal) {
      try {
        const imgRes = await fetch(imagenPrincipal, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; sitio-media-bot/1.0)" },
        });
        if (imgRes.ok) {
          const buf = Buffer.from(await imgRes.arrayBuffer());
          const out = await sharp(buf)
            .resize(1200, 630, { fit: "cover", position: "center" })
            .jpeg({ quality: 85 })
            .toBuffer();
          imagen_url = await new Promise<string>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              { folder: "sitio-media" },
              (err, result) => {
                if (err) reject(err);
                else resolve(result!.secure_url);
              }
            );
            Readable.from(out).pipe(uploadStream);
          });
        }
      } catch (e) {
        console.error("Error subiendo imagen a Cloudinary:", e);
      }
    }

    return NextResponse.json({
      titulo,
      cuerpo,
      adcopy,
      imagen_url,
      fuente_url: urlClean,
      pais: paisStr,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al curar" },
      { status: 500 }
    );
  }
}
