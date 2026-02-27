import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import sharp from "sharp";
import { getTodasNotas, createNota } from "@/lib/notas";
import cloudinary from "@/lib/cloudinary";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

function auth(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret");
  return !!ADMIN_SECRET && secret === ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!auth(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const notas = await getTodasNotas();
    return NextResponse.json(notas);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al listar notas" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!auth(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const {
      titulo,
      entradilla,
      cuerpo,
      imagen_url: imagenUrlBody,
      imagenBase64,
      imagen2Base64,
      imagen_alt,
      fuente_nombre,
      fuente_url,
      shares_buzzsumo,
      pais,
      publicado,
    } = body;
    if (!titulo || !entradilla || !cuerpo || !fuente_nombre || !fuente_url) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: titulo, entradilla, cuerpo, fuente_nombre, fuente_url" },
        { status: 400 }
      );
    }

    let imagen_url: string | undefined = imagenUrlBody ? String(imagenUrlBody).trim() : undefined;
    if (imagenBase64 && typeof imagenBase64 === "string") {
      try {
        const base64Data = imagenBase64.replace(/^data:image\/[^;]+;base64,/, "");
        const buf = Buffer.from(base64Data, "base64");
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
      } catch (e) {
        console.error("Error subiendo imagenBase64 a Cloudinary:", e);
        return NextResponse.json(
          { error: "No se pudo procesar la imagen" },
          { status: 400 }
        );
      }
    }

    let imagen2_url: string | null =
      body.imagen2_url != null && typeof body.imagen2_url === "string" && body.imagen2_url.trim()
        ? body.imagen2_url.trim()
        : null;
    if (!imagen2_url && imagen2Base64 && typeof imagen2Base64 === "string") {
      try {
        const base64Data = imagen2Base64.replace(/^data:image\/[^;]+;base64,/, "");
        const buf = Buffer.from(base64Data, "base64");
        const out = await sharp(buf)
          .resize(1200, 630, { fit: "cover", position: "center" })
          .jpeg({ quality: 85 })
          .toBuffer();
        imagen2_url = await new Promise<string>((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: "sitio-media" },
            (err, result) => {
              if (err) reject(err);
              else resolve(result!.secure_url);
            }
          );
          Readable.from(out).pipe(uploadStream);
        });
      } catch (e) {
        console.error("Error subiendo imagen2Base64 a Cloudinary:", e);
        return NextResponse.json(
          { error: "No se pudo procesar la imagen 2" },
          { status: 400 }
        );
      }
    }

    const nota = await createNota({
      titulo: String(titulo).trim(),
      entradilla: String(entradilla).trim(),
      cuerpo: String(cuerpo).trim(),
      imagen_url,
      imagen2_url,
      imagen_alt: imagen_alt ? String(imagen_alt).trim() : undefined,
      fuente_nombre: String(fuente_nombre).trim(),
      fuente_url: String(fuente_url).trim(),
      shares_buzzsumo: Number(shares_buzzsumo) || 0,
      pais: String(pais || "general").trim(),
      publicado: Boolean(publicado),
    });
    return NextResponse.json(nota);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al crear nota" },
      { status: 500 }
    );
  }
}
