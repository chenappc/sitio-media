"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdXSlot from "@/components/AdXSlot";

const INTERSTITIAL_ID = "div-gpt-ad-1773725445265-0";

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
  const router = useRouter();
  const [interstitialOpen, setInterstitialOpen] = useState(false);
  const hasAnterior = numero > 1;
  const hasSiguiente = numero < totalPaginas;

  const optimizarImagenCloudinary = (url: string) => {
    if (!url || !url.includes("res.cloudinary.com")) return url;
    return url.replace("/upload/", "/upload/w_600,c_fit,q_auto/");
  };

  const goSiguiente = useCallback(() => {
    router.push(`/stories/${slug}/${numero + 1}`);
  }, [router, slug, numero]);

  const onSiguienteClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setInterstitialOpen(true);
      window.setTimeout(() => {
        try {
          (window as unknown as { googletag?: { cmd: { push: (fn: () => void) => void } } }).googletag?.cmd.push(
            function () {
              (window as unknown as { googletag?: { display: (id: string) => void } }).googletag?.display(
                INTERSTITIAL_ID
              );
            }
          );
        } catch {
          /* ignore */
        }
      }, 100);
      window.setTimeout(() => {
        setInterstitialOpen(false);
        goSiguiente();
      }, 2800);
    },
    [goSiguiente]
  );

  const first = parrafos[0];
  const rest = parrafos.slice(1);

  return (
    <>
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
            {hasAnterior && hasSiguiente ? (
              <div className="flex gap-2">
                <Link
                  href={`/stories/${slug}/${numero - 1}`}
                  className="flex-1 rounded-sm py-4 text-center text-lg font-semibold text-white no-underline hover:opacity-95"
                  style={{ backgroundColor: "#1a56db" }}
                >
                  ← Anterior
                </Link>
                <button
                  type="button"
                  onClick={onSiguienteClick}
                  className="flex-1 rounded-sm py-4 text-center text-lg font-semibold text-white hover:opacity-95"
                  style={{ backgroundColor: "#1a56db" }}
                >
                  Próximo →
                </button>
              </div>
            ) : hasSiguiente ? (
              <button
                type="button"
                onClick={onSiguienteClick}
                className="block w-full rounded-sm py-4 text-center text-lg font-semibold text-white hover:opacity-95"
                style={{ backgroundColor: "#1a56db" }}
              >
                Próximo →
              </button>
            ) : hasAnterior ? (
              <div className="space-y-2">
                <Link
                  href={`/stories/${slug}/${numero - 1}`}
                  className="block w-full rounded-sm py-4 text-center text-lg font-semibold text-white no-underline hover:opacity-95"
                  style={{ backgroundColor: "#1a56db" }}
                >
                  ← Anterior
                </Link>
                <Link
                  href="/stories"
                  className="block w-full rounded-sm py-4 text-center text-lg font-semibold text-white no-underline hover:opacity-95"
                  style={{ backgroundColor: "#1a56db" }}
                >
                  Más historias
                </Link>
              </div>
            ) : null}
          </nav>
        </main>

        <aside className="hidden shrink-0 md:block md:w-1/4">
          <div className="sticky top-6 space-y-6">
            <AdXSlot slotId="gpt-vahica-single-left" minHeight={600} />
            <AdXSlot slotId="gpt-vahica-single-right" minHeight={600} />
          </div>
        </aside>
      </div>

      <div
        className={
          interstitialOpen
            ? "fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
            : "pointer-events-none fixed left-0 top-0 z-[-1] h-px w-px overflow-hidden opacity-0"
        }
        aria-hidden={!interstitialOpen}
      >
        <div
          id={INTERSTITIAL_ID}
          className="min-h-[250px] min-w-[300px] rounded bg-white p-2 shadow-lg"
        />
      </div>
    </>
  );
}
