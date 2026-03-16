import { NextRequest, NextResponse } from "next/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

function auth(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret");
  return !!ADMIN_SECRET && secret === ADMIN_SECRET;
}

/** POST: { slug, numero }. Regenera imagen de la página del especial. Por ahora stub. */
export async function POST(req: NextRequest) {
  if (!auth(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    const numero = Math.max(1, parseInt(String(body.numero ?? 1), 10) || 1);
    if (!slug) {
      return NextResponse.json({ error: "Falta slug" }, { status: 400 });
    }
    // TODO: obtener página de DB, subir a Cloudinary en sitio-media/especiales/, actualizar imagen_url, devolver { ok: true, imagen_url }
    return NextResponse.json({ ok: false, error: "No implementado" }, { status: 501 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al regenerar imagen" },
      { status: 500 }
    );
  }
}
