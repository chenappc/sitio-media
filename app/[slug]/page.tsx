// v2
import { notFound } from "next/navigation";
import { getNotaBySlug, incrementarVisitas } from "@/lib/notas";
import NotaInfiniteScroll from "@/components/NotaInfiniteScroll";
import type { Metadata } from "next";

export const revalidate = 0;
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const nota = await getNotaBySlug(slug);
  if (!nota) return {};
  return {
    title: nota.titulo,
    description: nota.entradilla,
    openGraph: {
      title: nota.titulo,
      description: nota.entradilla,
      images: nota.imagen_url ? [{ url: nota.imagen_url, width: 1200, height: 630 }] : [],
      type: "article",
      url: `https://vahica.com/${nota.slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: nota.titulo,
      description: nota.entradilla,
      images: nota.imagen_url ? [nota.imagen_url] : [],
    },
  };
}

export default async function NotaPage({ params }: Props) {
  const { slug } = await params;
  if (slug === "en") notFound();
  const nota = await getNotaBySlug(slug);
  if (!nota) notFound();
  await incrementarVisitas(nota.id);

  return (
    <>
      <article className="min-w-0 w-full">
        <NotaInfiniteScroll
          notaInicial={{
            id: nota.id,
            slug: nota.slug,
            titulo: nota.titulo,
            entradilla: nota.entradilla,
            cuerpo: nota.cuerpo,
            imagen_url: nota.imagen_url,
            imagen2_url: nota.imagen2_url,
            imagen_alt: nota.imagen_alt,
            fuente_nombre: nota.fuente_nombre,
            fuente_url: nota.fuente_url ?? null,
            pais: nota.pais,
            fecha: nota.fecha,
          }}
          idioma="es"
        />
      </article>

      {/* <aside className="hidden shrink-0 self-start md:block md:w-1/4">
        <AdXSlot slotId="gpt-vahica-single-left" />
        <div className="sticky top-4 mt-6">
          <AdXSlot slotId="gpt-vahica-single-right" />
        </div>
      </aside> */}
    </>
  );
}
