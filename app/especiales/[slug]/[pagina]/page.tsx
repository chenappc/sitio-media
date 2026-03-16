import { notFound } from "next/navigation";
import Image from "next/image";
import { getEspecialBySlug } from "@/lib/especiales";
import EspecialInfiniteScroll from "./EspecialInfiniteScroll";
import type { Metadata } from "next";

export const revalidate = 0;
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string; pagina: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, pagina } = await params;
  const numero = Math.max(1, parseInt(pagina, 10) || 1);
  const { especial } = await getEspecialBySlug(slug);
  if (!especial) return { title: "Especial no encontrado" };
  return {
    title: especial.titulo,
    description: `${especial.titulo}, parte ${numero} de ${especial.total_paginas}`,
  };
}

export default async function EspecialPaginaPage({ params }: Props) {
  const { slug, pagina } = await params;
  const numero = Math.max(1, parseInt(pagina, 10) || 1);
  const { especial, paginas } = await getEspecialBySlug(slug);

  if (!especial) notFound();

  const paginaData = paginas.find((p) => p.numero === numero);
  if (!paginaData) notFound();

  const parrafos = Array.isArray(paginaData.parrafos)
    ? (paginaData.parrafos as string[]).filter((p) => typeof p === "string" && p.trim())
    : [];
  const bloques = Array.isArray(paginaData.bloques) ? paginaData.bloques : undefined;
  const totalPaginas = especial.total_paginas ?? paginas.length;

  const initialPage = {
    numero: paginaData.numero,
    titulo_item: paginaData.titulo_item ?? "",
    imagen_url: paginaData.imagen_url ?? null,
    parrafos,
    ...(bloques?.length ? { bloques } : {}),
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="font-serif text-2xl font-bold text-[var(--negro)]">{especial.titulo}</h1>
        <div className="mt-4 border-t border-[var(--negro)]/10" aria-hidden />
        <EspecialInfiniteScroll
          slug={slug}
          totalPaginas={totalPaginas}
          initialNumero={numero}
          initialPage={initialPage}
        />
      </div>
    </div>
  );
}
