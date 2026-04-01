import { notFound } from "next/navigation";
import { getEspecialBySlug } from "@/lib/especiales";
import type { Metadata } from "next";
import EspecialInfiniteScroll from "./EspecialInfiniteScroll";
import type { Bloque } from "@/lib/types";

export const revalidate = 0;
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string; pagina: string }>;
};

function especialPermitidoEnEstaRuta(idioma: string | null | undefined): boolean {
  return idioma?.trim().toLowerCase() === "en";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { especial, paginas } = await getEspecialBySlug(slug);
  if (!especial || !especialPermitidoEnEstaRuta(especial.idioma)) {
    return { title: "Especial no encontrado" };
  }
  const paginaUno = paginas.find((p) => p.numero === 1);
  return {
    title: { absolute: especial.titulo },
    description: especial.titulo,
    openGraph: {
      title: especial.titulo,
      description: especial.titulo,
      images: paginaUno?.imagen_url ? [{ url: paginaUno.imagen_url, width: 1200, height: 630 }] : [],
      type: "article",
      siteName: "Vahica.com",
    },
  };
}

export default async function EspecialPaginaPage({ params }: Props) {
  const { slug, pagina } = await params;
  const { especial, paginas } = await getEspecialBySlug(slug);
  if (!especial) notFound();
  if (!especialPermitidoEnEstaRuta(especial.idioma)) notFound();

  const numero = Math.max(1, parseInt(pagina, 10) || 1);
  const pageRow = paginas.find((p) => p.numero === numero);
  if (!pageRow) notFound();

  const parrafos = Array.isArray(pageRow.parrafos)
    ? (pageRow.parrafos as string[]).filter((p) => typeof p === "string" && p.trim())
    : [];
  const bloques: Bloque[] = Array.isArray(pageRow.bloques) ? pageRow.bloques : [];

  return (
    <article className="min-w-0 w-full">
      <div className="mx-auto max-w-6xl px-4 pt-6">
        <h1 className="font-serif text-2xl font-bold text-[var(--negro)] md:text-4xl">{especial.titulo}</h1>
      </div>
      <EspecialInfiniteScroll
        slug={slug}
        totalPaginas={especial.total_paginas ?? paginas.length}
        initialNumero={numero}
        initialPage={{
          numero: pageRow.numero,
          titulo_item: pageRow.titulo_item ?? "",
          imagen_url: pageRow.imagen_url ?? null,
          parrafos,
          bloques,
        }}
      />
    </article>
  );
}
