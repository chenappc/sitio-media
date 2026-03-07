import { NextRequest, NextResponse } from "next/server";
import { getStoryBySlug } from "@/lib/stories";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: "Falta slug" }, { status: 400 });
  }
  const { story, paginas } = await getStoryBySlug(slug);
  if (!story) {
    return NextResponse.json({ error: "Story no encontrada" }, { status: 404 });
  }
  return NextResponse.json({
    id: story.id,
    slug: story.slug,
    titulo: story.titulo,
    status: story.status,
    total_paginas: story.total_paginas,
    paginas: paginas.map((p) => ({
      numero: p.numero,
      imagen_url: p.imagen_url,
      parrafos: p.parrafos,
    })),
  });
}
