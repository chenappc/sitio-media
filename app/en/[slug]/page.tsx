// Nota viral en inglés — misma UI que /[slug], enlaces y relacionadas bajo /en
import { notFound } from "next/navigation";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale";
import Link from "next/link";
import {
  getNotaBySlugYIdioma,
  getNotasRelacionadasPorIdioma,
  incrementarVisitas,
} from "@/lib/notas";
import AdXSlot from "@/components/AdXSlot";
import WhatsAppButton from "@/components/WhatsAppButton";
import type { Metadata } from "next";
import styles from "../../[slug]/page.module.css";

const IDIOMA_EN = "en";

export const revalidate = 0;
export const dynamic = "force-dynamic";

function formatHora(fecha: Date) {
  return formatDistanceToNow(new Date(fecha), { addSuffix: true, locale: enUS });
}

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

function splitCuerpoAfterParagraphs(html: string, n: number): { head: string; tail: string } {
  const re = /<p\b[^>]*>[\s\S]*?<\/p>/gi;
  const matches: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  const s = html;
  re.lastIndex = 0;
  while ((m = re.exec(s)) !== null) {
    matches.push(m);
  }
  if (matches.length <= n) return { head: html, tail: "" };
  const lastOfHead = matches[n - 1];
  const endHead = lastOfHead.index! + lastOfHead[0].length;
  return { head: html.slice(0, endHead), tail: html.slice(endHead) };
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const nota = await getNotaBySlugYIdioma(slug, IDIOMA_EN);
  if (!nota) return {};
  const urlPath = `https://vahica.com/en/${nota.slug}`;
  return {
    title: nota.titulo,
    description: nota.entradilla,
    openGraph: {
      title: nota.titulo,
      description: nota.entradilla,
      images: nota.imagen_url ? [{ url: nota.imagen_url, width: 1200, height: 630 }] : [],
      type: "article",
      url: urlPath,
    },
    twitter: {
      card: "summary_large_image",
      title: nota.titulo,
      description: nota.entradilla,
      images: nota.imagen_url ? [nota.imagen_url] : [],
    },
  };
}

export default async function NotaEnPage({ params }: Props) {
  const { slug } = await params;
  console.log('EN SLUG PAGE - slug:', slug);
  const nota = await getNotaBySlugYIdioma(slug, IDIOMA_EN);
  console.log('EN SLUG PAGE - nota encontrada:', nota?.id ?? 'NULL');
  if (!nota) notFound();
  await incrementarVisitas(nota.id);
  const relacionadas = await getNotasRelacionadasPorIdioma(nota.slug, nota.titulo, IDIOMA_EN, 4);

  const cuerpoHtml = cuerpoConImagen2(nota.cuerpo, nota.imagen2_url, nota.imagen_alt ?? nota.titulo);
  const { head: cuerpoHead, tail: cuerpoTail } = splitCuerpoAfterParagraphs(cuerpoHtml, 3);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <article className="min-w-0 w-full">
        <span className="inline-block rounded bg-[var(--rojo)] px-2 py-0.5 text-sm font-semibold text-white">
          🔥 Viral
        </span>
        <h1 className="mt-3 font-serif text-2xl font-bold leading-tight md:text-3xl">
          {nota.titulo}
        </h1>
        <p className="mt-2 text-sm text-[var(--negro)]/60">{formatHora(nota.fecha)}</p>

        <div className="relative mt-4 w-full flex justify-center">
          <img
            src={nota.imagen_url ?? ""}
            alt={nota.imagen_alt ?? nota.titulo}
            style={{ maxHeight: "550px", maxWidth: "728px", width: "100%", height: "auto" }}
          />
        </div>

        <div className="my-4 max-w-full overflow-hidden rounded border border-[var(--negro)]/10 p-3 flex flex-col items-center">
          <AdXSlot slotId="div-gpt-ad-1774066671869-0" showLabel />
        </div>

        <p className="mt-4 text-lg font-medium text-[var(--negro)]/90">{nota.entradilla}</p>

        <WhatsAppButton titulo={nota.titulo} slug={nota.slug} pathPrefix="/en" />

        {cuerpoHead && (
          <div
            className={`prose prose-lg mt-6 max-w-none prose-a:text-[var(--rojo)] prose-a:no-underline hover:prose-a:underline ${styles.cuerpo}`}
            dangerouslySetInnerHTML={{ __html: cuerpoHead }}
          />
        )}
        {cuerpoTail && (
          <>
            <div className="my-6 max-w-full overflow-hidden rounded border border-[var(--negro)]/10 p-3 flex flex-col items-center">
              <AdXSlot slotId="div-gpt-ad-1774066837194-0" showLabel />
            </div>
            <div
              className={`prose prose-lg max-w-none prose-a:text-[var(--rojo)] prose-a:no-underline hover:prose-a:underline ${styles.cuerpo}`}
              dangerouslySetInnerHTML={{ __html: cuerpoTail }}
            />
          </>
        )}
        <div className="mt-8 max-w-full overflow-hidden rounded border border-[var(--negro)]/10 p-3 flex flex-col items-center">
          <AdXSlot slotId="div-gpt-ad-1774066088689-0" showLabel />
        </div>

        {nota.fuente_url && (
          <p style={{ fontSize: 14, color: "#666", marginTop: 24 }}>
            Source:{" "}
            <a href={nota.fuente_url} target="_blank" rel="nofollow noopener noreferrer">
              {nota.fuente_nombre || "External link"}
            </a>
          </p>
        )}

        {relacionadas.length > 0 && (
          <section className="mt-10">
            <h2 className="font-serif text-2xl font-bold text-[var(--negro)] mb-4 md:text-3xl">
              You may also like:
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {relacionadas.map((r) => (
                <Link
                  key={r.id}
                  href={`/en/${r.slug}`}
                  className="group block rounded-lg overflow-hidden bg-[var(--negro)]/5"
                >
                  <div className="relative aspect-video w-full overflow-hidden">
                    {r.imagen_url ? (
                      <Image
                        src={r.imagen_url}
                        alt=""
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-200"
                        sizes="(max-width: 768px) 100vw, 37vw"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-[var(--negro)]/10" />
                    )}
                  </div>
                  <p className="mt-2 px-0 py-0 font-serif text-base font-bold text-[var(--negro)] line-clamp-2 group-hover:text-[var(--rojo)]">
                    {r.titulo}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </div>
  );
}
