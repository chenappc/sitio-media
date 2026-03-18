import { notFound } from "next/navigation";
import { getStoryPagina } from "@/lib/stories";
import StoryPaginaClient from "./StoryPaginaClient";
import type { Metadata } from "next";

export const revalidate = 0;
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string; pagina: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, pagina } = await params;
  const numero = Math.max(1, parseInt(pagina, 10) || 1);
  const { story } = await getStoryPagina(slug, numero);
  if (!story) return { title: "Story no encontrada" };
  return {
    title: `${story.titulo} — Página ${numero}`,
    description: `Story: ${story.titulo}, página ${numero} de ${story.total_paginas}`,
  };
}

export default async function StoryPaginaPage({ params }: Props) {
  const { slug, pagina } = await params;
  const numero = Math.max(1, parseInt(pagina, 10) || 1);
  const { story, pagina: paginaData } = await getStoryPagina(slug, numero);

  if (!story || !paginaData) notFound();

  const parrafos = Array.isArray(paginaData.parrafos)
    ? (paginaData.parrafos as string[]).filter((p) => typeof p === "string" && p.trim())
    : [];
  const totalPaginas = story.total_paginas ?? 1;

  return (
    <div className="min-h-screen bg-white">
      <StoryPaginaClient
        slug={slug}
        numero={numero}
        totalPaginas={totalPaginas}
        storyTitulo={story.titulo}
        imagenUrl={paginaData.imagen_url ?? null}
        parrafos={parrafos}
      />
    </div>
  );
}
