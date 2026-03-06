import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getStoryPagina } from "@/lib/stories";
import AdSense from "@/components/AdSense";
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
  const hasAnterior = numero > 1;
  const hasSiguiente = numero < totalPaginas;
  const midIndex = parrafos.length > 1 ? Math.floor(parrafos.length / 2) : 0;

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row md:gap-8">
        <main className="min-w-0 flex-1">
          <header className="mb-6">
            <h1 className="font-serif text-2xl font-bold text-[var(--negro)] md:text-3xl">
              {story.titulo}
            </h1>
            <p className="mt-1 text-sm text-[var(--negro)]/60">
              Página {numero} de {totalPaginas}
            </p>
          </header>

          {paginaData.imagen_url && (
            <div className="relative mb-6 h-96 w-full overflow-hidden rounded-lg bg-[var(--negro)]/5">
              <Image
                src={paginaData.imagen_url}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 672px"
              />
            </div>
          )}

          <div className="prose prose-lg max-w-none text-[var(--negro)]">
            {parrafos.map((texto, i) => (
              <div key={i}>
                <p className="mb-4 leading-relaxed">{texto}</p>
                {i === midIndex && midIndex > 0 && (
                  <div className="my-6">
                    <AdSense slot="8801356773" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <nav
            className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--negro)]/10 pt-6"
            aria-label="Navegación entre páginas"
          >
            {hasAnterior ? (
              <Link
                href={`/stories/${slug}/${numero - 1}`}
                className="rounded border border-[var(--negro)]/20 px-4 py-2 text-sm font-medium text-[var(--negro)] hover:bg-[var(--negro)]/5 no-underline"
              >
                ← Anterior
              </Link>
            ) : (
              <span />
            )}
            {hasSiguiente ? (
              <Link
                href={`/stories/${slug}/${numero + 1}`}
                className="rounded border border-[var(--rojo)]/60 px-4 py-2 text-sm font-medium text-[var(--rojo)] hover:bg-[var(--rojo)]/10 no-underline"
              >
                Próximo →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </main>

        <aside className="hidden shrink-0 md:block md:w-[300px]">
          <div className="sticky top-4 h-[600px] w-[300px] overflow-hidden rounded border border-[var(--negro)]/10 bg-[var(--negro)]/5">
            <AdSense slot="8801356773" />
          </div>
        </aside>
      </div>
    </div>
  );
}
