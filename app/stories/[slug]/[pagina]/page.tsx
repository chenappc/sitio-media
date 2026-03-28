import { notFound } from "next/navigation";
import { getStoryPagina } from "@/lib/stories";
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
  await params;
  notFound();
}
