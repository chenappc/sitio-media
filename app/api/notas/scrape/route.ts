import { NextRequest, NextResponse } from "next/server";
import { curarNotaFromBody, CurarHttpError } from "@/lib/curar-nota";
import { createNota } from "@/lib/notas";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "sitio2026";

function auth(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret");
  return secret === ADMIN_SECRET;
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
