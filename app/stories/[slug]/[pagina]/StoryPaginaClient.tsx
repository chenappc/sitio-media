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
  /** Base de ruta para enlaces; default "/stories". Usar "/en/stories" en la versión en inglés. */
  routePrefix?: string;
  locale?: "es" | "en";
};

export default function StoryPaginaClient({
  slug,
  numero,
  totalPaginas,
  storyTitulo,
  imagenUrl,
  parrafos,
  routePrefix = "/stories",
  locale = "es",
}: Props) {
  const hasAnterior = numero > 1;
  const hasSiguiente = numero < totalPaginas;

  const optimizarImagenCloudinary = (url: string) => {
    if (!url || !url.includes("res.cloudinary.com")) return url;
    return url.replace("/upload/", "/upload/h_550,c_fit,q_auto/");
  };

  const first = parrafos[0];
  const rest = parrafos.slice(1);

  const hintRojo =
    locale === "en"
      ? "Use the red buttons below to navigate through the pages of this story."
      : "Usa los botones rojos de abajo para avanzar o retroceder por las páginas de esta historia.";
  const btnAnterior = locale === "en" ? "← Previous" : "← Anterior";
  const btnProximo = locale === "en" ? "Next →" : "Próximo →";
  const btnMasHistorias = locale === "en" ? "More stories" : "Más historias";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <main className="min-w-0 w-full">
        <h1 className="font-serif text-2xl font-bold text-[var(--negro)] md:text-4xl">{storyTitulo}</h1>

        <div className="hidden md:block w-full flex justify-center my-4">
          <AdXSlot slotId="div-gpt-ad-1774064935710-0" minWidth={728} showLabel locale={locale} />
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
          <div className="flex flex-col items-center w-full">
            <AdXSlot slotId="div-gpt-ad-1774066671869-0" showLabel locale={locale} />
          </div>
          {rest.map((texto, i) => (
            <p key={i} className="text-xl leading-relaxed">
              {texto}
            </p>
          ))}
        </div>

        <div className="mt-8">
          <div className="flex flex-col items-center w-full">
            <AdXSlot slotId="div-gpt-ad-1774066088689-0" showLabel locale={locale} />
          </div>
        </div>

        <p className="mb-4 mt-8 text-lg italic text-[var(--rojo)]">{hintRojo}</p>
        <nav className="border-t border-[var(--negro)]/10 pt-6" aria-label="Navegación entre páginas">
          {hasAnterior && hasSiguiente ? (
            <div className="flex gap-2">
              <Link
                href={`${routePrefix}/${slug}/${numero - 1}`}
                className="flex-1 rounded-sm py-4 text-center text-lg font-semibold text-white no-underline hover:opacity-95"
                style={{ backgroundColor: "#e00000" }}
              >
                {btnAnterior}
              </Link>
              <Link
                href={`${routePrefix}/${slug}/${numero + 1}`}
                className="flex-1 rounded-sm py-4 text-center text-lg font-semibold text-white no-underline hover:opacity-95"
                style={{ backgroundColor: "#e00000" }}
              >
                {btnProximo}
              </Link>
            </div>
          ) : hasSiguiente ? (
            <Link
              href={`${routePrefix}/${slug}/${numero + 1}`}
              className="block w-full rounded-sm py-4 text-center text-lg font-semibold text-white no-underline hover:opacity-95"
              style={{ backgroundColor: "#e00000" }}
            >
              {btnProximo}
            </Link>
          ) : hasAnterior ? (
            <div className="space-y-2">
              <Link
                href={`${routePrefix}/${slug}/${numero - 1}`}
                className="block w-full rounded-sm py-4 text-center text-lg font-semibold text-white no-underline hover:opacity-95"
                style={{ backgroundColor: "#e00000" }}
              >
                {btnAnterior}
              </Link>
              <Link
                href={routePrefix}
                className="block w-full rounded-sm py-4 text-center text-lg font-semibold text-white no-underline hover:opacity-95"
                style={{ backgroundColor: "#e00000" }}
              >
                {btnMasHistorias}
              </Link>
            </div>
          ) : null}
        </nav>
      </main>

      {/* <aside className="hidden shrink-0 self-start md:block md:w-1/4">
        <div className="max-w-full overflow-hidden">
          <AdXSlot slotId="gpt-vahica-single-left" />
          <div className="sticky top-4 mt-6">
            <AdXSlot slotId="gpt-vahica-single-right" />
          </div>
        </div>
      </aside> */}
    </div>
  );
}
