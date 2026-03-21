"use client";

import Image from "next/image";
import Link from "next/link";
import AdXSlot from "@/components/AdXSlot";

type Props = {
  slug: string;
  numero: number;
  totalPaginas: number;
  storyTitulo: string;
  imagenUrl: string | null;
  parrafos: string[];
};

export default function StoryPaginaClient({
  slug,
  numero,
  totalPaginas,
  storyTitulo,
  imagenUrl,
  parrafos,
}: Props) {
  const hasAnterior = numero > 1;
  const hasSiguiente = numero < totalPaginas;

  const optimizarImagenCloudinary = (url: string) => {
    if (!url || !url.includes("res.cloudinary.com")) return url;
    return url.replace("/upload/", "/upload/w_600,c_fit,q_auto/");
  };

  const first = parrafos[0];
  const rest = parrafos.slice(1);

  return (
    <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
      <main className="min-w-0 md:w-3/4">
        <h1 className="font-serif text-2xl font-bold text-[var(--negro)]">{storyTitulo}</h1>

        {imagenUrl && (
          <div className="relative mt-4 w-full">
            <Image
              src={optimizarImagenCloudinary(imagenUrl)}
              alt={storyTitulo}
              width={600}
              height={600}
              className="h-auto w-full"
              priority
            />
          </div>
        )}

        <div className="mt-6 space-y-6 text-[var(--negro)]">
          {first != null && <p className="text-xl leading-relaxed">{first}</p>}
          <div className="my-4">
            <AdXSlot slotId="gpt-vahica-single-top" />
          </div>
          {rest.map((texto, i) => (
            <p key={i} className="text-xl leading-relaxed">
              {texto}
            </p>
          ))}
        </div>

        <div className="mt-8">
          <AdXSlot slotId="gpt-vahica-single-bottom" />
        </div>

        <nav className="mt-8 border-t border-[var(--negro)]/10 pt-6" aria-label="Navegación entre páginas">
          <p className="mb-4 text-sm italic text-[var(--rojo)]">
            Usa los botones rojos de abajo para avanzar o retroceder por las páginas de esta historia.
          </p>
          {hasAnterior && hasSiguiente ? (
            <div className="flex gap-2">
              <Link
                href={`/stories/${slug}/${numero - 1}`}
                className="flex-1 rounded-sm py-4 text-center text-lg font-semibold text-white no-underline hover:opacity-95"
                style={{ backgroundColor: "#e00000" }}
              >
                ← Anterior
              </Link>
              <Link
                href={`/stories/${slug}/${numero + 1}`}
                className="flex-1 rounded-sm py-4 text-center text-lg font-semibold text-white no-underline hover:opacity-95"
                style={{ backgroundColor: "#e00000" }}
              >
                Próximo →
              </Link>
            </div>
          ) : hasSiguiente ? (
            <Link
              href={`/stories/${slug}/${numero + 1}`}
              className="block w-full rounded-sm py-4 text-center text-lg font-semibold text-white no-underline hover:opacity-95"
              style={{ backgroundColor: "#e00000" }}
            >
              Próximo →
            </Link>
          ) : hasAnterior ? (
            <div className="space-y-2">
              <Link
                href={`/stories/${slug}/${numero - 1}`}
                className="block w-full rounded-sm py-4 text-center text-lg font-semibold text-white no-underline hover:opacity-95"
                style={{ backgroundColor: "#e00000" }}
              >
                ← Anterior
              </Link>
              <Link
                href="/stories"
                className="block w-full rounded-sm py-4 text-center text-lg font-semibold text-white no-underline hover:opacity-95"
                style={{ backgroundColor: "#e00000" }}
              >
                Más historias
              </Link>
            </div>
          ) : null}
        </nav>
      </main>

      <aside className="hidden shrink-0 self-start md:block md:w-1/4">
        <AdXSlot slotId="gpt-vahica-single-left" minHeight={600} />
        <div className="sticky top-4 mt-6">
          <AdXSlot slotId="gpt-vahica-single-right" minHeight={600} />
        </div>
      </aside>
    </div>
  );
}
