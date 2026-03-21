import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import sharp from "sharp";
import cloudinary from "@/lib/cloudinary";
import pool from "@/lib/db";
import { createNota } from "@/lib/notas";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "sitio2026";

function auth(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret");
  return secret === ADMIN_SECRET;
}

// --- Prompts EN / original (antes en lib/curar-prompts-idioma.ts) ---
const ORIGINAL_SYSTEM_SUFFIX = `\n\nIDIOMA DE SALIDA: Escribí titulo, cuerpo y entradilla en el MISMO idioma que el artículo original que te paso abajo. No traduzcas al español si el original está en inglés u otro idioma. Si el original ya está en español, mantené español.`;

const ORIGINAL_USER_SUFFIX = `\n\nRECORDATORIO CRÍTICO: titulo, cuerpo y entradilla deben estar en el mismo idioma predominante del cuerpo original del artículo.`;

const SYSTEM_PROMPT_EN = `You are a viral news editor for Vahica.com. Your job is to curate articles for English-speaking audiences. Follow these rules strictly:

1. LENGTH: The curated article must have exactly the same word count as the original, within 5% (no more, no less).
2. ACCURACY: Do not exaggerate or invent facts. If the story mentions views or numbers, use the exact figures from the source.
3. LANGUAGE: Use natural, friendly, everyday English appropriate for the selected audience region. Avoid unnecessary jargon.
4. VIRALITY: Keep what made the story viral: emotional hook, surprising data, conflict, or curiosity. Do not soften or remove them.
5. ORIGINALITY: Rewrite completely; never copy phrases from the source. It must pass plagiarism checks.
6. NAMES AND PLACES: Always mention proper names, people, places, cities, countries, institutions, and brands from the source. Do not replace them with vague references.
7. CAPITALIZATION: Follow English capitalization rules. Only capitalize sentence starts and proper nouns.
8. CLEANUP: Remove ads, navigation, widgets, unrelated fragments, and anything that is not core news content.
9. ADSENSE AND FACEBOOK SAFETY: The curated article must comply with Google AdSense and Facebook Ads policies. Do not explicitly mention prohibited topics (sexual violence, self-harm, illegal drugs in a promotional way, etc.). Soften or omit as in the Spanish pipeline. If the source is too explicit to sanitize, return JSON with titulo: "CONTENIDO_INAPROPIADO", cuerpo: "", entradilla: "".
10. GEO: When the article mentions cities or regions, add the country on first mention when helpful (e.g. "Guadalajara, Mexico").

Always respond ONLY with valid JSON, no markdown or code fences.`;

function buildUserPromptEn(params: {
  manualModeIntro: string;
  paisStr: string;
  listaNombres: string;
  tituloOriginal: string;
  cuerpoLimpio: string;
  nombreMedio: string;
}): string {
  const {
    manualModeIntro,
    paisStr,
    listaNombres,
    tituloOriginal,
    cuerpoLimpio,
    nombreMedio,
  } = params;
  return `${manualModeIntro}Audience region: ${paisStr}.

PROPER NAMES THAT MUST APPEAR IN YOUR ANSWER (from the source): ${listaNombres}

If any of these are missing from your curated version, the response will be rejected.

MANDATORY INSTRUCTIONS:
- Use ALL proper names, nicknames, places, cities, countries, institutions, brands, and exact figures from the original text.
- Do not replace names with "a person", "a place", etc.
- Double-check before sending.

ARTICLE TO CURATE:

Original title:
${tituloOriginal}

Original body (plain text). Ignore unrelated side topics.

${cuerpoLimpio}

Source outlet name (for the closing paragraph): ${nombreMedio}

CAPITALIZATION: Follow English rules; only proper nouns and sentence starts.

Return ONLY a JSON object with these keys (no markdown, no \`\`\`):
- "titulo": curated headline in English, viral hook, max 80 characters. The headline must NOT mention personal names—use generic references ("A young man", "The woman", "The couple").
- "cuerpo": curated body in HTML. Each paragraph in its own <p> tag only. About 300–500 words. Do not add "Originally published at..." at the end.
- "entradilla": exactly 2 short sentences separated by a period, max 150 characters total. The lead must NOT mention personal names—use "the man", "the woman", "the couple", etc. Names appear only in the body. No quotes or line breaks.`;
}

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const UA = "Mozilla/5.0 (compatible; sitio-media-bot/1.0)";

function resolveUrl(base: string, path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  try {
    return new URL(path, base).href;
  } catch {
    return path;
  }
}

function metaContent(html: string, property: string): string | null {
  const esc = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m =
    html.match(new RegExp(`<meta[^>]+property=["']${esc}["'][^>]+content=["']([^"']+)["']`, "i")) ||
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${esc}["']`, "i"));
  return m ? m[1].trim() : null;
}

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

class CurarHttpError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "CurarHttpError";
  }
}

type CurarResult = {
  titulo: string;
  cuerpo: string;
  entradilla: string;
  imagen_url: string | null;
  imagen2_url: string | null;
  fuente_nombre: string;
  fuente_url: string;
  pais: string;
  idioma: "es" | "en" | "original";
};

function parseIdioma(body: Record<string, unknown>): "es" | "en" | "original" {
  let idioma = String(body.idioma ?? "es").trim().toLowerCase();
  if (idioma !== "es" && idioma !== "en" && idioma !== "original") idioma = "es";
  return idioma as "es" | "en" | "original";
}

async function curarNotaFromBody(body: Record<string, unknown>): Promise<CurarResult> {
  const paisStr = typeof body.pais === "string" ? body.pais.trim() : "general";
  const idiomaCurar = parseIdioma(body);

  let cuerpoOriginal: string;
  let tituloOriginal: string;
  let nombreMedio: string;
  let urlClean: string;
  let imagenPrincipal: string | null = null;
  let manualMode: boolean;
  let imagen_url: string | null = null;
  let imagen2_url: string | null = null;

  if (body.texto != null && typeof body.texto === "string") {
    const texto = body.texto.trim();
    const lineCount = texto.split(/\r?\n/).length;
    if (lineCount < 10) {
      throw new CurarHttpError(400, "El texto debe tener al menos 10 líneas.");
    }
    const fuenteNombre = body.fuente_nombre != null ? String(body.fuente_nombre).trim() : "";
    const fuenteUrl = body.fuente_url != null ? String(body.fuente_url).trim() : "";
    if (!fuenteNombre || !fuenteUrl) {
      throw new CurarHttpError(400, "Faltan nombre de la fuente o URL de la fuente.");
    }
    if (!body.imagenBase64 || typeof body.imagenBase64 !== "string") {
      throw new CurarHttpError(400, "En modo manual la Foto 1 (principal) es obligatoria.");
    }
    cuerpoOriginal = texto;
    tituloOriginal = texto.split(/\r?\n/).find((l: string) => l.trim().length > 0)?.trim().slice(0, 80) || "Nota";
    nombreMedio = fuenteNombre;
    urlClean = fuenteUrl;
    manualMode = true;
  } else {
    const url = body.url;
    if (!url || typeof url !== "string") {
      throw new CurarHttpError(400, "Falta url");
    }
    urlClean = url.trim();
    const jinaRes = await fetch(`https://r.jina.ai/${urlClean}`, {
      headers: { "User-Agent": UA },
    });
    if (!jinaRes.ok) {
      throw new CurarHttpError(400, `No se pudo obtener el contenido (Jina: ${jinaRes.status})`);
    }
    cuerpoOriginal = (await jinaRes.text()).trim();

    if (cuerpoOriginal.length < 200) {
      throw new CurarHttpError(
        422,
        "No fue posible extraer el contenido del artículo. El sitio puede estar bloqueando el acceso automático. Intentá con otra URL o pegá el texto del artículo manualmente."
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
    throw new CurarHttpError(422, "El contenido es demasiado corto (mínimo 200 caracteres).");
  }

  const lineasSucias = ["Reproducir", "Espaciadora", "Pantalla Completa", "Silenciar", "Adelantar", "Retroceder", "Subtítulos", "Increase", "Decrease"];
  const cuerpoLimpio = cuerpoOriginal
    .split("\n")
    .filter((linea) => {
      const matches = lineasSucias.filter((palabra) => linea.includes(palabra)).length;
      return matches < 2;
    })
    .join("\n");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new CurarHttpError(500, "ANTHROPIC_API_KEY no configurada");
  }

  const systemPromptES = `Sos un editor de noticias virales para Vahica.com. Tu tarea es curar artículos para audiencias hispanohablantes. Seguís estas reglas estrictamente:

1. EXTENSIÓN: El artículo curado debe tener exactamente la misma cantidad de palabras que el original, con una variación máxima del 5% (ni más ni menos).
2. PRECISIÓN: No exagerés ni inventés datos. Si la nota dice que un video tiene visitas, usá el número exacto mencionado. Si no hay número confirmado, no digas 'millones' ni agregues cifras que no están en el original.
3. LENGUAJE: Usá español neutro latinoamericano (como en especiales: natural para lectores de cualquier país de América Latina; usá "ustedes" en lugar de "vosotros", sin voseo español peninsular). Evitá tecnicismos innecesarios. El texto debe ser fácil de leer y agradable.
4. VIRALIDAD: Mantené los elementos que hicieron viral la nota: el gancho emocional, el dato sorprendente, el conflicto o la curiosidad. No los suavices ni los elimines.
5. ORIGINALIDAD: Reescribí completamente, nunca copies frases del original. Debe pasar cualquier detector de plagio.
6. NOMBRES Y LUGARES: Siempre mencioná los nombres propios, personas, lugares, ciudades, países, instituciones y marcas que aparecen en el artículo original. No los omitas ni los reemplaces por referencias vagas como 'una persona', 'un lugar' o 'una institución'. Los nombres propios son parte del valor noticioso y de la viralidad.
7. MAYÚSCULAS: Respetá estrictamente las reglas del español. Solo van con mayúscula inicial: la primera palabra de una oración, los nombres propios de personas, lugares, instituciones y marcas. No capitalices sustantivos comunes, adjetivos, meses, días de la semana, nacionalidades ni cargos. Si el texto original tiene mayúsculas incorrectas, corrígelas en tu versión. Palabras como "abuelito", "abuelita", "abuelo", "abuela", "mamá", "papá", "hijo", "hija" NO son nombres propios y NO van en mayúscula salvo que inicien una oración. Si el texto original las capitaliza, corrígelas.
8. LIMPIEZA: Ignorá y eliminá cualquier fragmento que parezca contenido publicitario, texto de navegación, widgets, horarios, referencias a "AM" o "PM" sin contexto, frases sueltas sin relación con el tema principal, llamadas a la acción comerciales, o cualquier texto que claramente no pertenezca al artículo periodístico. Si un párrafo no aporta información relevante a la historia principal, omitilo.
9. CONTENIDO APTO PARA ADSENSE Y FACEBOOK: El artículo curado debe cumplir estrictamente las políticas de contenido de Google AdSense y Facebook Ads. Esto significa:
- PROHIBIDO mencionar explícitamente: violación, abuso sexual, canibalismo, pedofilia, torturas, suicidio, automutilación, pornografía, drogas ilegales, armas de fuego en contexto violento, o cualquier contenido sexualmente explícito.
- Si el artículo original contiene estos elementos, debés REEMPLAZARLOS por versiones suavizadas que mantengan la esencia de la historia sin mencionar los elementos prohibidos. Por ejemplo: "abuso" → "encuentro no deseado", "canibalismo" → "acto macabro", "violación" → omitir o referir como "fue aprovechada mientras dormía".
- Cuando el artículo mencione muerte, enfermedad, pérdida o situaciones oscuras, usá lenguaje empático: "falleció", "partió", "dejó este mundo" en lugar de "murió". Evitá detalles gráficos o perturbadores.
- Transformá siempre el enfoque hacia lo emotivo y humano. El artículo debe poder ser leído por cualquier adulto sin resultar ofensivo o perturbador.
- Si el contenido original es TAN explícito que no puede ser transformado en algo apto (ej. descripción detallada de abuso infantil), devolvé el JSON con titulo: "CONTENIDO_INAPROPIADO", cuerpo: "", entradilla: "" para que el sistema lo rechace automáticamente.
10. GEOLOCALIZACIÓN: Cuando el artículo mencione ciudades, pueblos, barrios, provincias, estados o cualquier localidad geográfica, siempre agregá el país al que pertenece entre comas si no está ya mencionado en el mismo contexto. Ejemplo: "Villa María del Triunfo" → "Villa María del Triunfo, Perú". "Guadalajara" → "Guadalajara, México" (si el artículo es mexicano). Esto es especialmente importante en la primera mención de cada lugar. El objetivo es que un lector de cualquier país hispanohablante entienda inmediatamente dónde ocurre la historia.

Siempre respondé SOLO con JSON válido sin markdown ni backticks.`;

  const nombresPropios = extraerNombresPropios(`${tituloOriginal} ${cuerpoOriginal}`).slice(0, 80);
  const listaNombres =
    nombresPropios.length > 0 ? nombresPropios.join(", ") : "(ninguno detectado automáticamente)";

  const manualModeIntro = manualMode
    ? `El texto que te paso puede contener links, URLs, código HTML, menús de navegación, publicidades, textos de redes sociales y otros elementos que no son parte del artículo principal. Tu primera tarea es identificar y extraer SOLO el artículo periodístico principal, ignorando todo lo demás. Luego aplicá las reglas de curación sobre ese texto limpio únicamente.

`
    : "";

  const userPromptES = `${manualModeIntro}País de la audiencia: ${paisStr}.

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

${cuerpoLimpio.slice(0, 12000)}

Nombre del medio de origen (usar para el párrafo final): ${nombreMedio}

IMPORTANTE SOBRE MAYÚSCULAS: Revisá que tu respuesta no tenga mayúsculas incorrectas. En español solo van en mayúscula la primera letra de una oración y los nombres propios. Palabras como "Doctor", "Presidente", "Enero", "Lunes", "Argentino" NO van en mayúscula salvo que inicien una oración.

Devuelve ÚNICAMENTE un objeto JSON con estas tres claves (sin markdown, sin \`\`\`):
- "titulo": título curado en español neutro latinoamericano, manteniendo el gancho viral, máximo 80 caracteres. IMPORTANTE: El titular NO debe mencionar nombres propios de personas, solo referencias genéricas (ej.: "Un joven", "La mujer", "La pareja").
- "cuerpo": cuerpo curado en HTML. Cada párrafo debe ir envuelto en su propia etiqueta <p>. No uses otros contenedores: solo <p> para cada párrafo separado. 300-500 palabras, en español neutro latinoamericano. No agregues al final ninguna frase del tipo "Nota original publicada en...".
- "entradilla": exactamente 2 oraciones breves separadas por punto seguido, máximo 150 caracteres en total, que resuman el gancho principal de la nota. IMPORTANTE: La entradilla NO debe mencionar nombres propios de personas (ni protagonistas ni secundarios). En su lugar usá referencias genéricas como "el hombre", "la mujer", "la pareja", "el joven", "la familia", "los protagonistas", etc. Los nombres aparecerán solo en el cuerpo de la nota. Formato ejemplo: "Un joven cumplió el sueño de su abuela de 84 años. La foto que compartió emocionó a miles en las redes." Sin comillas, sin saltos de línea, sin puntos suspensivos.`;

  let systemPrompt = systemPromptES;
  let userPrompt = userPromptES;
  if (idiomaCurar === "en") {
    systemPrompt = SYSTEM_PROMPT_EN;
    userPrompt = buildUserPromptEn({
      manualModeIntro,
      paisStr,
      listaNombres,
      tituloOriginal,
      cuerpoLimpio: cuerpoLimpio.slice(0, 12000),
      nombreMedio,
    });
  } else if (idiomaCurar === "original") {
    systemPrompt = systemPromptES + ORIGINAL_SYSTEM_SUFFIX;
    userPrompt = userPromptES + ORIGINAL_USER_SUFFIX;
  }

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
    throw new CurarHttpError(502, `Error de Claude: ${claudeRes.status}`);
  }

  const claudeData = (await claudeRes.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = claudeData.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
  let jsonStr = text;
  const codeMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeMatch) jsonStr = codeMatch[1].trim();
  let parsed: { titulo?: string; cuerpo?: string; entradilla?: string };
  try {
    parsed = JSON.parse(jsonStr) as { titulo?: string; cuerpo?: string; entradilla?: string };
  } catch {
    throw new CurarHttpError(502, "Claude no devolvió JSON válido");
  }

  const titulo = String(parsed.titulo ?? tituloOriginal).trim();
  const cuerpo = String(parsed.cuerpo ?? "").trim();
  const entradilla = String(parsed.entradilla ?? "").trim();

  if (titulo === "CONTENIDO_INAPROPIADO") {
    throw new CurarHttpError(
      422,
      "El contenido original no es apto para AdSense y Facebook. No puede ser publicado."
    );
  }

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
  } else if (imagenPrincipal) {
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

  if (urlClean) {
    try {
      await pool.query(
        `UPDATE candidatos_buzzsumo SET status = 'aprobado' WHERE url = $1 AND status = 'pendiente'`,
        [urlClean]
      );
    } catch (e) {
      console.error("Error actualizando candidato:", e);
    }
  }

  return {
    titulo,
    cuerpo,
    entradilla,
    imagen_url,
    imagen2_url,
    fuente_nombre: fuenteNombre,
    fuente_url: urlClean,
    pais: paisStr,
    idioma: idiomaCurar,
  };
}

/**
 * Scraper de notas virales: misma curación que POST /api/curar (body.idioma como especiales/scrape),
 * pero persiste la nota en BD con columna idioma.
 * Body: igual que /api/curar + opcional publicado, shares_buzzsumo.
 */
export async function POST(req: NextRequest) {
  if (!auth(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const curado = await curarNotaFromBody(body);
    const publicado = Boolean(body.publicado);
    const shares_buzzsumo = Number(body.shares_buzzsumo) || 0;

    const nota = await createNota({
      titulo: curado.titulo,
      entradilla: curado.entradilla,
      cuerpo: curado.cuerpo,
      imagen_url: curado.imagen_url ?? undefined,
      imagen2_url: curado.imagen2_url,
      imagen_alt: curado.titulo,
      fuente_nombre: curado.fuente_nombre,
      fuente_url: curado.fuente_url,
      shares_buzzsumo,
      pais: curado.pais,
      publicado,
      idioma: curado.idioma,
    });
    return NextResponse.json(nota);
  } catch (err) {
    if (err instanceof CurarHttpError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al scrapear nota" },
      { status: 500 }
    );
  }
}
