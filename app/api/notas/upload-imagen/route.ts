import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import sharp from "sharp";
import cloudinary from "@/lib/cloudinary";
import { getNotaById, updateNotaImagenUrl } from "@/lib/notas";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

function auth(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret");
  return !!ADMIN_SECRET && secret === ADMIN_SECRET;
}

export async function POST(req: NextRequest) {
  if (!auth(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const notaIdStr = formData.get("notaId") as string | null;
    if (!file || !notaIdStr) {
      return NextResponse.json(
        { error: "Faltan file o notaId en el formulario" },
        { status: 400 }
      );
    }
    const notaId = parseInt(notaIdStr, 10);
    if (Number.isNaN(notaId)) {
      return NextResponse.json({ error: "notaId inválido" }, { status: 400 });
    }
    const nota = await getNotaById(notaId);
    if (!nota) {
      return NextResponse.json({ error: "Nota no encontrada" }, { status: 404 });
    }

    const bytes = await file.arrayBuffer();
    const buf = Buffer.from(bytes);
    const out = await sharp(buf)
      .resize(1200, 630, { fit: "cover", position: "center" })
      .jpeg({ quality: 85 })
      .toBuffer();

    const imagen_url = await new Promise<string>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: "sitio-media" },
        (err, result) => {
          if (err) reject(err);
          else resolve(result!.secure_url);
        }
      );
      Readable.from(out).pipe(uploadStream);
    });

    const updated = await updateNotaImagenUrl(notaId, imagen_url);
    if (!updated) {
      return NextResponse.json({ error: "No se pudo actualizar la nota" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, imagen_url });
  } catch (err) {
    console.error("upload-imagen error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al subir imagen" },
      { status: 500 }
    );
  }
}
