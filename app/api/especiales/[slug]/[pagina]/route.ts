import { NextRequest, NextResponse } from "next/server";
import { getEspecialBySlug } from "@/lib/especiales";

type Params = { params: Promise<{ slug: string; pagina: string }> };

/** GET: devuelve { titulo_item, imagen_url, parrafos, numero, total_paginas } para ese slug y página. Cualquier status (igual que stories). */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { slug, pagina } = await params;
    const numero = Math.max(1, parseInt(pagina, 10) || 1);
    const { especial, paginas } = await getEspecialBySlug(slug);
    if (!especial) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    const paginaData = paginas.find((p) => p.numero === numero);
    if (!paginaData) {
      return NextResponse.json({ error: "Página no encontrada" }, { status: 404 });
    }
    const parrafos = Array.isArray(paginaData.parrafos)
      ? (paginaData.parrafos as string[]).filter((p) => typeof p === "string" && p.trim())
      : [];
    const bloques = Array.isArray(paginaData.bloques) ? paginaData.bloques : [];
    return NextResponse.json({
      titulo_item: paginaData.titulo_item ?? "",
      imagen_url: paginaData.imagen_url ?? null,
      parrafos,
      bloques,
      numero: paginaData.numero,
      total_paginas: especial.total_paginas ?? paginas.length,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
