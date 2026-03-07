import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import cloudinary from "@/lib/cloudinary";
import { getStoryBySlug, getStoryPagina, updateStoryPaginaImagen } from "@/lib/stories";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

function auth(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret");
  return !!ADMIN_SECRET && secret === ADMIN_SECRET;
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
  try {
    const body = await req.json();
    storySlug = String(body.storySlug ?? "").trim();
    pagina = Math.max(1, parseInt(String(body.pagina ?? 1), 10) || 1);
    if (!storySlug) {
      return NextResponse.json({ error: "Falta storySlug" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const { story, paginas } = await getStoryBySlug(storySlug);
  if (!story) {
    return NextResponse.json({ error: "Story no encontrada" }, { status: 404 });
  }
  const pageRow = paginas.find((p) => p.numero === pagina);
  if (!pageRow) {
    return NextResponse.json({ error: "Página no encontrada" }, { status: 404 });
  }

  const parrafos = Array.isArray(pageRow.parrafos)
    ? (pageRow.parrafos as string[]).filter((p) => typeof p === "string" && p.trim())
    : [];
  const titulo = story.titulo;

  let descripcionProtagonista: string | null = null;
  if (pagina === 1 && parrafos.length > 0) {
    try {
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
    } catch {
      // ignorar
    }
  } else if (pagina > 1) {
    try {
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

  const temaBase = titulo && parrafos[0]
    ? `${titulo}. ${String(parrafos[0]).slice(0, 300)}`
    : (titulo || String(parrafos[0] ?? "").slice(0, 400) || "Escena narrativa");

  const descripcion = `RAW photo, DSLR, photorealistic, hyperrealistic, real photograph, NOT a painting, NOT illustrated, NOT digital art, NOT CGI. Canon EOS R5, 85mm lens, f/2.8, natural lighting. Subject: ${temaBase}.${descripcionProtagonista ? ` Main character: ${descripcionProtagonista}.` : ""} Documentary photojournalism style, National Geographic. Sharp focus, film grain, real textures. No text, no words, no letters, no signs, no logos, no watermarks, no icons, no symbols, no weapons, no guns, no knives, no firearms.`;

  let imagenUrl: string | null = null;
  try {
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
    if (imgUrl) {
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
    }
  } catch (e) {
    return NextResponse.json(
      { error: `DALL-E/Cloudinary: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }

  if (!imagenUrl) {
    return NextResponse.json(
      { error: "No se pudo generar o subir la imagen" },
      { status: 500 }
    );
  }

  await updateStoryPaginaImagen(story.id, pagina, imagenUrl);
  return NextResponse.json({ imagenUrl });
}
