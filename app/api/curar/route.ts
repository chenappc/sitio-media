import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import sharp from "sharp";
import cloudinary from "@/lib/cloudinary";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "sitio2026";
const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const UA = "Mozilla/5.0 (compatible; sitio-media-bot/1.0)";

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

/** Extrae content de meta property con regex (property antes o después de content). */
function metaContent(html: string, property: string): string | null {
  const esc = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m =
    html.match(new RegExp(`<meta[^>]+property=["']${esc}["'][^>]+content=["']([^"']+)["']`, "i")) ||
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${esc}["']`, "i"));
  return m ? m[1].trim() : null;
}

/** Extrae og:image del HTML con las dos variantes de orden de atributos. */
function getOgImage(html: string): string | null {
  const m =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return m ? m[1].trim() : null;
}

const TARGET_W = 1200;
const TARGET_H = 630;
const MAX_KB = 100;

async function processImageForCloudinary(buf: Buffer): Promise<Buffer> {
  const meta = await sharp(buf).metadata();
  const w = meta.width ?? 1;
  const h = meta.height ?? 1;
  const ratio = w / h;

  const useContain = ratio < 1.7;
  const resizeOpts = useContain
    ? {
        fit: "contain" as const,
        position: "center" as const,
        background: { r: 0, g: 0, b: 0 },
      }
    : { fit: "cover" as const, position: "center" as const };

  for (const q of [75, 60, 45]) {
    const out = await sharp(buf)
      .resize(TARGET_W, TARGET_H, resizeOpts)
      .jpeg({ quality: q })
      .toBuffer();
    if (out.length <= MAX_KB * 1024) return out;
  }
  return sharp(buf)
    .resize(TARGET_W, TARGET_H, resizeOpts)
    .jpeg({ quality: 45 })
    .toBuffer();
}

async function uploadBufferToCloudinary(buf: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "sitio-media" },
      (err, result) => {
        if (err) reject(err);
        else resolve(result!.secure_url);
      }
    );
    Readable.from(buf).pipe(uploadStream);
  });
}

/** Extrae palabras con mayúscula que no son inicio de oración (candidatos a nombres propios). */
function extraerNombresPropios(texto: string): string[] {
  const text = (texto || "").trim();
  if (!text) return [];
  const re = /\b([A-ZÁÉÍÓÚÑ][a-zA-ZáéíóúñÁÉÍÓÚÑ\-']*)\b/g;
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const word = m[1];
    if (word.length < 2) continue;
    let i = m.index - 1;
    while (i >= 0 && /\s/.test(text[i])) i--;
    if (i >= 0 && /[.!?]/.test(text[i])) continue;
    set.add(word);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export async function POST(req: NextRequest) {
  if (!auth(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const paisStr = typeof body.pais === "string" ? body.pais.trim() : "general";

    let cuerpoOriginal: string;
    let tituloOriginal: string;
    let nombreMedio: string;
    let urlClean: string;
    let imagenPrincipal: string | null = null;
    let manualMode: boolean;
    let imagen_url: string | null = null;
    let imagen2_url: string | null = null;

    if (body.texto != null && typeof body.texto === "string") {
      // Modo manual: texto pegado + fuente + imágenes en body
      const texto = body.texto.trim();
      const lineCount = texto.split(/\r?\n/).length;
      if (lineCount < 10) {
        return NextResponse.json(
          { error: "El texto debe tener al menos 10 líneas." },
          { status: 400 }
        );
      }
      const fuenteNombre = body.fuente_nombre != null ? String(body.fuente_nombre).trim() : "";
      const fuenteUrl = body.fuente_url != null ? String(body.fuente_url).trim() : "";
      if (!fuenteNombre || !fuenteUrl) {
        return NextResponse.json(
          { error: "Faltan nombre de la fuente o URL de la fuente." },
          { status: 400 }
        );
      }
      if (!body.imagenBase64 || typeof body.imagenBase64 !== "string") {
        return NextResponse.json(
          { error: "En modo manual la Foto 1 (principal) es obligatoria." },
          { status: 400 }
        );
      }
      cuerpoOriginal = texto;
      tituloOriginal = texto.split(/\r?\n/).find((l: string) => l.trim().length > 0)?.trim().slice(0, 80) || "Nota";
      nombreMedio = fuenteNombre;
      urlClean = fuenteUrl;
      manualMode = true;
    } else {
      // Modo URL: fetch Jina + página original
      const url = body.url;
      if (!url || typeof url !== "string") {
        return NextResponse.json({ error: "Falta url" }, { status: 400 });
      }
      urlClean = url.trim();
      const jinaRes = await fetch(`https://r.jina.ai/${urlClean}`, {
        headers: { "User-Agent": UA },
      });
      if (!jinaRes.ok) {
        return NextResponse.json(
          { error: `No se pudo obtener el contenido (Jina: ${jinaRes.status})` },
          { status: 400 }
        );
      }
      cuerpoOriginal = (await jinaRes.text()).trim();

      if (cuerpoOriginal.length < 200) {
        return NextResponse.json(
          {
            error:
              "No fue posible extraer el contenido del artículo. El sitio puede estar bloqueando el acceso automático. Intentá con otra URL o pegá el texto del artículo manualmente.",
          },
          { status: 422 }
        );
      }

      tituloOriginal = "";
      nombreMedio = "la fuente";
      try {
        const pageRes = await fetch(urlClean, { headers: { "User-Agent": UA } });
        if (pageRes.ok) {
          const html = await pageRes.text();
          tituloOriginal = metaContent(html, "og:title") || "";
          if (!tituloOriginal) {
            const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
            if (titleMatch) tituloOriginal = titleMatch[1].trim();
          }
          const siteName = metaContent(html, "og:site_name");
          if (siteName) nombreMedio = siteName;
          else {
            try {
              nombreMedio = new URL(urlClean).hostname.replace(/^www\./, "") || "la fuente";
            } catch {
              // keep default
            }
          }
          const ogImage = getOgImage(html);
          if (ogImage) imagenPrincipal = resolveUrl(urlClean, ogImage);
        }
      } catch (e) {
        console.error("Error obteniendo meta de la URL:", e);
      }
      manualMode = false;
    }

    if (cuerpoOriginal.length < 200) {
      return NextResponse.json(
        { error: "El contenido es demasiado corto (mínimo 200 caracteres)." },
        { status: 422 }
      );
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

    const nombresPropios = extraerNombresPropios(
      `${tituloOriginal} ${cuerpoOriginal}`
    ).slice(0, 80);
    const listaNombres =
      nombresPropios.length > 0
        ? nombresPropios.join(", ")
        : "(ninguno detectado automáticamente)";

    const manualModeIntro = manualMode
      ? `El texto que te paso puede contener links, URLs, código HTML, menús de navegación, publicidades, textos de redes sociales y otros elementos que no son parte del artículo principal. Tu primera tarea es identificar y extraer SOLO el artículo periodístico principal, ignorando todo lo demás. Luego aplicá las reglas de curación sobre ese texto limpio únicamente.

`
      : "";

    const userPrompt = `${manualModeIntro}País de la audiencia: ${paisStr}.

NOMBRES PROPIOS OBLIGATORIOS QUE DEBEN APARECER EN TU RESPUESTA (extraídos del original): ${listaNombres}

Si alguno de estos nombres no aparece en tu versión curada, tu respuesta será rechazada. Verificá que todos estén presentes antes de responder.

INSTRUCCIONES OBLIGATORIAS:
- Usá TODOS los nombres propios, apellidos, apodos, lugares, ciudades, países, instituciones, marcas y cifras exactas que aparecen en el texto original. No los omitas bajo ningún concepto.
- Si en el original dice 'Zoe' o 'Mati' o 'Buenos Aires' o '8 años', el artículo curado DEBE mencionar esos mismos datos.
- No reemplaces nombres por 'una persona', 'un lugar', 'una institución' u otras referencias vagas.
- Revisá tu respuesta antes de enviarla y verificá que cada nombre propio del original esté presente en tu versión curada.

ARTÍCULO ORIGINAL A CURAR:

Título original del artículo:
${tituloOriginal}

Cuerpo original (texto plano). El texto que te paso ya está limpio. Si ves referencias a otras notas o temas que no tienen relación con el tema principal, ignoralas completamente.

${cuerpoOriginal.slice(0, 12000)}

Nombre del medio de origen (usar para el párrafo final): ${nombreMedio}

Devuelve ÚNICAMENTE un objeto JSON con estas tres claves (sin markdown, sin \`\`\`):
- "titulo": título curado en español del país, manteniendo el gancho viral, máximo 80 caracteres. IMPORTANTE: El titular NO debe mencionar nombres propios de personas, solo referencias genéricas (ej.: "Un joven", "La mujer", "La pareja").
- "cuerpo": cuerpo curado en HTML. Cada párrafo debe ir envuelto en su propia etiqueta <p>. No uses otros contenedores: solo <p> para cada párrafo separado. 300-500 palabras, en el español del país elegido. No agregues al final ninguna frase del tipo "Nota original publicada en...".
- "entradilla": exactamente 2 oraciones breves separadas por punto seguido, máximo 150 caracteres en total, que resuman el gancho principal de la nota. IMPORTANTE: La entradilla NO debe mencionar nombres propios de personas (ni protagonistas ni secundarios). En su lugar usá referencias genéricas como "el hombre", "la mujer", "la pareja", "el joven", "la familia", "los protagonistas", etc. Los nombres aparecerán solo en el cuerpo de la nota. Formato ejemplo: "Un joven cumplió el sueño de su abuela de 84 años. La foto que compartió emocionó a miles en las redes." Sin comillas, sin saltos de línea, sin puntos suspensivos.`;

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
        temperature: 0.3,
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
    let parsed: { titulo?: string; cuerpo?: string; entradilla?: string };
    try {
      parsed = JSON.parse(jsonStr) as { titulo?: string; cuerpo?: string; entradilla?: string };
    } catch {
      return NextResponse.json(
        { error: "Claude no devolvió JSON válido" },
        { status: 502 }
      );
    }

    const titulo = String(parsed.titulo ?? tituloOriginal).trim();
    const cuerpo = String(parsed.cuerpo ?? "").trim();
    const entradilla = String(parsed.entradilla ?? "").trim();

    if (manualMode) {
      if (body.imagenBase64 && typeof body.imagenBase64 === "string") {
        try {
          const base64Data = body.imagenBase64.replace(/^data:image\/[^;]+;base64,/, "");
          const buf = Buffer.from(base64Data, "base64");
          const out = await processImageForCloudinary(buf);
          imagen_url = await uploadBufferToCloudinary(out);
        } catch (e) {
          console.error("Error subiendo Foto 1 a Cloudinary:", e);
        }
      }
      if (body.imagen2Base64 && typeof body.imagen2Base64 === "string") {
        try {
          const base64Data = body.imagen2Base64.replace(/^data:image\/[^;]+;base64,/, "");
          const buf = Buffer.from(base64Data, "base64");
          const out = await processImageForCloudinary(buf);
          imagen2_url = await uploadBufferToCloudinary(out);
        } catch (e) {
          console.error("Error subiendo Foto 2 a Cloudinary:", e);
        }
      }
    } else {
      if (imagenPrincipal) {
        try {
          const imgRes = await fetch(imagenPrincipal, {
            headers: { "User-Agent": UA },
          });
          if (imgRes.ok) {
            const buf = Buffer.from(await imgRes.arrayBuffer());
            const out = await processImageForCloudinary(buf);
            imagen_url = await uploadBufferToCloudinary(out);
          }
        } catch (e) {
          console.error("Error subiendo imagen a Cloudinary:", e);
        }
      }
    }

    const fuenteNombre =
      manualMode && body.fuente_nombre
        ? String(body.fuente_nombre).trim()
        : (() => {
            try {
              return new URL(urlClean).hostname.replace(/^www\./, "") || "Fuente";
            } catch {
              return "Fuente";
            }
          })();

    return NextResponse.json({
      titulo,
      cuerpo,
      entradilla,
      imagen_url,
      imagen2_url,
      fuente_nombre: fuenteNombre,
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
