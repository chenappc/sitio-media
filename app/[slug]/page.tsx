import { notFound } from "next/navigation";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { getNotaBySlug } from "@/lib/notas";
import AdSense from "@/components/AdSense";
import type { Metadata } from "next";

export const revalidate = 3600;

function formatHora(fecha: Date) {
  return formatDistanceToNow(new Date(fecha), { addSuffix: true, locale: es });
}

function formatShares(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const nota = await getNotaBySlug(slug);
  if (!nota) return { title: "Nota no encontrada" };
  return {
    title: nota.titulo,
    openGraph: {
      title: nota.titulo,
      images: nota.imagen_url ? [{ url: nota.imagen_url, alt: nota.imagen_alt ?? nota.titulo }] : [],
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
      <div className="mt-4">
        <AdSense slot="4862111765" />
      </div>
      <p className="mt-2 text-sm text-[var(--negro)]/60">
        {formatHora(nota.fecha)} · {formatShares(nota.shares_buzzsumo)} shares
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
        className="prose prose-lg mt-6 max-w-none prose-p:leading-relaxed prose-a:text-[var(--rojo)] prose-a:no-underline hover:prose-a:underline"
        dangerouslySetInnerHTML={{ __html: nota.cuerpo }}
      />

      <div className="mt-8">
        <AdSense slot="8801356773" />
      </div>

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
