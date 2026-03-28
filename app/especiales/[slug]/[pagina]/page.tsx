import { notFound } from "next/navigation";
import { getEspecialBySlug } from "@/lib/especiales";
import type { Metadata } from "next";

export const revalidate = 0;
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string; pagina: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { especial, paginas } = await getEspecialBySlug(slug);
  if (!especial) return { title: "Especial no encontrado" };
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
  await params;
  notFound();
}
