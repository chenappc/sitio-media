// v2
import { notFound } from "next/navigation";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { getNotaBySlug } from "@/lib/notas";
import AdSense from "@/components/AdSense";
import WhatsAppButton from "@/components/WhatsAppButton";
import type { Metadata } from "next";
import styles from "./page.module.css";

export const revalidate = 0;
export const dynamic = "force-dynamic";

function formatHora(fecha: Date) {
  return formatDistanceToNow(new Date(fecha), { addSuffix: true, locale: es });
}

/** Inserta imagen2 en el centro del cuerpo (después del párrafo que está a la mitad). */
function cuerpoConImagen2(cuerpo: string, imagen2_url: string | null, alt: string): string {
  if (!imagen2_url?.trim()) return cuerpo;
  const paragraphs = cuerpo.match(/<p[^>]*>[\s\S]*?<\/p>/gi);
  if (!paragraphs || paragraphs.length === 0) return cuerpo;
  const mid = Math.floor((paragraphs.length - 1) / 2);
  const escapedAlt = alt.replace(/"/g, "&quot;");
  const img = `<img src="${imagen2_url.replace(/"/g, "&quot;")}" alt="${escapedAlt}" style="width:100%; height:auto; margin: 24px 0;" />`;
  const before = paragraphs.slice(0, mid + 1).join("");
  const after = paragraphs.slice(mid + 1).join("");
  return before + img + after;
}

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
      url: `https://sitio.media/${nota.slug}`,
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
  const nota = await getNotaBySlug(slug);
  if (!nota) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-6">
      <span className="inline-block rounded bg-[var(--rojo)] px-2 py-0.5 text-sm font-semibold text-white">
        🔥 Viral
      </span>
      <h1 className="mt-3 font-serif text-2xl font-bold leading-tight md:text-3xl">
        {nota.titulo}
      </h1>
      {/* <div className="mt-4">
        <AdSense slot="4862111765" />
      </div> */}
      <p className="mt-2 text-sm text-[var(--negro)]/60">
        {formatHora(nota.fecha)}
      </p>

      {nota.imagen_url && (
        <div className="relative mt-4 aspect-video w-full overflow-hidden rounded-lg bg-[var(--negro)]/5">
          <Image
            src={nota.imagen_url}
            alt={nota.imagen_alt ?? nota.titulo}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 672px"
            priority
          />
        </div>
      )}

      <p className="mt-4 text-lg font-medium text-[var(--negro)]/90">
        {nota.entradilla}
      </p>

      <div
        className={`prose prose-lg mt-6 max-w-none prose-a:text-[var(--rojo)] prose-a:no-underline hover:prose-a:underline ${styles.cuerpo}`}
        dangerouslySetInnerHTML={{
          __html: cuerpoConImagen2(nota.cuerpo, nota.imagen2_url, nota.imagen_alt ?? nota.titulo),
        }}
      />

      <div className="mt-8">
        <AdSense slot="8801356773" />
      </div>

      <WhatsAppButton titulo={nota.titulo} slug={nota.slug} />

      {nota.fuente_url && (
        <p style={{ fontSize: 14, color: "#666", marginTop: 24 }}>
          Fuente:{" "}
          <a
            href={nota.fuente_url}
            target="_blank"
            rel="nofollow noopener noreferrer"
          >
            {nota.fuente_nombre || "Enlace externo"}
          </a>
        </p>
      )}
    </article>
  );
}
