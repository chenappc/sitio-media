// v2
import { notFound } from "next/navigation";
import { getNotaBySlug } from "@/lib/notas";
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

export default async function NotaPage({ params: _params }: Props) {
  if (true) notFound();
}
