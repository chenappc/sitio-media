// v2
import { notFound } from "next/navigation";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { getNotaBySlug, getNotasRelacionadas, incrementarVisitas } from "@/lib/notas";
import AdXSlot from "@/components/AdXSlot";
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

/** Parte el HTML del cuerpo después del n-ésimo párrafo <p>...</p> (para insertar anuncio entre bloques). */
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
  const nota = await getNotaBySlug(slug);
  if (!nota) notFound();
  await incrementarVisitas(nota.id);
  const relacionadas = await getNotasRelacionadas(nota.slug, nota.titulo, 4);

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

        {nota.imagen_url && (
          <div className="relative mt-4 w-full flex justify-center">
            <img
              src={nota.imagen_url}
              alt={nota.imagen_alt ?? nota.titulo}
              style={{ maxHeight: "550px", width: "auto", maxWidth: "100%" }}
            />
          </div>
        )}

        <div className="my-4 max-w-full overflow-hidden rounded border border-[var(--negro)]/10 p-3 flex flex-col items-center">
          <AdXSlot slotId="div-gpt-ad-1774066671869-0" showLabel />
        </div>

        <p className="mt-4 text-lg font-medium text-[var(--negro)]/90">{nota.entradilla}</p>

        <WhatsAppButton titulo={nota.titulo} slug={nota.slug} />

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
            Fuente:{" "}
            <a href={nota.fuente_url} target="_blank" rel="nofollow noopener noreferrer">
              {nota.fuente_nombre || "Enlace externo"}
            </a>
          </p>
        )}

        {relacionadas.length > 0 && (
          <section className="mt-10">
            <h2 className="font-serif text-2xl font-bold text-[var(--negro)] mb-4 md:text-3xl">
              También te puede interesar:
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {relacionadas.map((r) => (
                <Link
                  key={r.id}
                  href={`/${r.slug}`}
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

      {/* <aside className="hidden shrink-0 self-start md:block md:w-1/4">
        <AdXSlot slotId="gpt-vahica-single-left" />
        <div className="sticky top-4 mt-6">
          <AdXSlot slotId="gpt-vahica-single-right" />
        </div>
      </aside> */}
    </div>
  );
}
