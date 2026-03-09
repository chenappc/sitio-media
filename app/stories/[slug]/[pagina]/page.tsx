import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
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

  const optimizarImagenCloudinary = (url: string) => {
    if (!url || !url.includes("res.cloudinary.com")) return url;
    return url.replace("/upload/", "/upload/w_600,c_fit,q_auto/");
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto flex max-w-5xl gap-6 px-4 py-6">
        <main className="min-w-0 max-w-2xl flex-1">
          <h1 className="font-serif text-2xl font-bold text-[var(--negro)]">
            {story.titulo}
          </h1>

          {paginaData.imagen_url && (
            <div className="relative mt-4 w-full">
              <Image
                src={optimizarImagenCloudinary(paginaData.imagen_url)}
                alt={story.titulo}
                width={600}
                height={600}
                className="w-full h-auto"
                priority
              />
            </div>
          )}

          <div className="mt-6 space-y-6 text-[var(--negro)]">
            {parrafos.map((texto, i) => (
              <div key={i}>
                <p className="text-xl leading-relaxed">{texto}</p>
                {i === midIndex && midIndex > 0 && (
                  <div className="my-4 min-h-[90px] rounded-sm bg-[var(--negro)]/5">
                    {/* AdSense - agregar código */}
                  </div>
                )}
              </div>
            ))}
          </div>

          <nav
            className="mt-8 border-t border-[var(--negro)]/10 pt-6"
            aria-label="Navegación entre páginas"
          >
            {hasAnterior && hasSiguiente ? (
              <div className="flex gap-2">
                <Link
                  href={`/stories/${slug}/${numero - 1}`}
                  className="flex-1 rounded-sm py-4 text-center text-lg font-semibold text-white no-underline hover:opacity-95"
                  style={{ backgroundColor: "#1a56db" }}
                >
                  ← Anterior
                </Link>
                <Link
                  href={`/stories/${slug}/${numero + 1}`}
                  className="flex-1 rounded-sm py-4 text-center text-lg font-semibold text-white no-underline hover:opacity-95"
                  style={{ backgroundColor: "#1a56db" }}
                >
                  Próximo →
                </Link>
              </div>
            ) : hasSiguiente ? (
              <Link
                href={`/stories/${slug}/${numero + 1}`}
                className="block w-full rounded-sm py-4 text-center text-lg font-semibold text-white no-underline hover:opacity-95"
                style={{ backgroundColor: "#1a56db" }}
              >
                Próximo →
              </Link>
            ) : hasAnterior ? (
              <div className="space-y-2">
                <Link
                  href={`/stories/${slug}/${numero - 1}`}
                  className="block w-full rounded-sm py-4 text-center text-lg font-semibold text-white no-underline hover:opacity-95"
                style={{ backgroundColor: "#1a56db" }}
                >
                  ← Anterior
                </Link>
                <Link
                  href="/"
                  className="block w-full rounded-sm py-4 text-center text-lg font-semibold text-white no-underline hover:opacity-95"
                style={{ backgroundColor: "#1a56db" }}
                >
                  Más historias
                </Link>
              </div>
            ) : null}
          </nav>
        </main>

        <aside className="hidden w-72 shrink-0 md:block">
          <div className="sticky top-6 space-y-4">
            <div className="flex min-h-[250px] w-full items-center justify-center rounded-sm bg-[var(--negro)]/5 text-[var(--negro)]/30">
              {/* AdSense sidebar */}
            </div>
            <div className="flex min-h-[600px] w-[160px] items-center justify-center rounded-sm bg-[var(--negro)]/5 text-[var(--negro)]/30">
              {/* AdSense sidebar */}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
