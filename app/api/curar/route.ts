import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import sharp from "sharp";

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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY no configurada" },
        { status: 500 }
      );
    }

    const systemPrompt = `Sos un editor de noticias virales para el sitio sitio.media. Tu tarea es curar artículos para audiencias hispanohablantes manteniendo los elementos que los hicieron virales. Siempre respondé en JSON válido sin markdown.`;
    const userPrompt = `País de la audiencia: ${paisStr}.

Título original del artículo:
${tituloOriginal}

Cuerpo original (texto plano):
${cuerpoOriginal.slice(0, 12000)}

Devuelve ÚNICAMENTE un objeto JSON con estas tres claves (sin markdown, sin \`\`\`):
- "titulo": título curado en español del país, manteniendo el gancho viral, máximo 80 caracteres.
- "cuerpo": cuerpo curado en HTML limpio (párrafos con <p>), 300-500 palabras, en el español del país elegido.
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

    let imagenBase64: string | null = null;
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
          imagenBase64 = `data:image/jpeg;base64,${out.toString("base64")}`;
        }
      } catch (e) {
        console.error("Error procesando imagen:", e);
      }
    }

    return NextResponse.json({
      titulo,
      cuerpo,
      adcopy,
      imagenBase64,
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
