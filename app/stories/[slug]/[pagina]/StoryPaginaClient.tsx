"use client";

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
    return url.replace("/upload/", "/upload/h_550,c_fit,q_auto/");
  };

  const first = parrafos[0];
  const rest = parrafos.slice(1);

  return (
    <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
      <main className="min-w-0 md:w-3/4">
        <h1 className="font-serif text-2xl font-bold text-[var(--negro)] md:text-4xl">{storyTitulo}</h1>

        <div className="hidden md:block">
          <div className="my-4 max-w-full overflow-hidden rounded border border-[var(--negro)]/10 p-3 flex flex-col items-center">
            <AdXSlot slotId="div-gpt-ad-1774064935710-0" minWidth={728} showLabel />
          </div>
        </div>

        {imagenUrl && (
          <div className="relative mt-4 w-full flex justify-center">
            <img
              src={optimizarImagenCloudinary(imagenUrl)}
              alt={storyTitulo}
              style={{ maxHeight: "550px", width: "auto", maxWidth: "100%" }}
            />
          </div>
        )}

        <div className="mt-6 space-y-6 text-[var(--negro)]">
          {first != null && <p className="text-xl leading-relaxed">{first}</p>}
          <div className="my-4 max-w-full overflow-hidden rounded border border-[var(--negro)]/10 p-3 flex flex-col items-center">
            <AdXSlot slotId="div-gpt-ad-1774066671869-0" showLabel />
          </div>
          {rest.map((texto, i) => (
            <p key={i} className="text-xl leading-relaxed">
              {texto}
            </p>
          ))}
        </div>

        <div className="mt-8">
          <div className="my-4 max-w-full overflow-hidden rounded border border-[var(--negro)]/10 p-3 flex flex-col items-center">
            <AdXSlot slotId="div-gpt-ad-1774066088689-0" showLabel />
          </div>
        </div>

        <p className="mb-4 mt-8 text-lg italic text-[var(--rojo)]">
          Usa los botones rojos de abajo para avanzar o retroceder por las páginas de esta historia.
        </p>
        <nav className="border-t border-[var(--negro)]/10 pt-6" aria-label="Navegación entre páginas">
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
        <div className="max-w-full overflow-hidden">
          <AdXSlot slotId="gpt-vahica-single-left" minHeight={600} />
          <div className="sticky top-4 mt-6">
            <AdXSlot slotId="gpt-vahica-single-right" minHeight={600} />
          </div>
        </div>
      </aside>
    </div>
  );
}
