"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Bloque } from "@/lib/types";
import AdXSlot from "@/components/AdXSlot";
import EspecialAdSlot from "./EspecialAdSlot";

const INTERSTITIAL_ID = "div-gpt-ad-1773725445265-0";

type PageData = {
  numero: number;
  titulo_item: string;
  imagen_url: string | null;
  parrafos: string[];
  bloques?: Bloque[];
};

function optimizarImagenCloudinary(url: string) {
  if (!url || !url.includes("res.cloudinary.com")) return url;
  return url.replace("/upload/", "/upload/h_550,c_fit,q_auto/");
}

type Props = {
  slug: string;
  totalPaginas: number;
  initialNumero: number;
  initialPage: PageData;
};

export default function EspecialInfiniteScroll({
  slug,
  totalPaginas,
  initialNumero,
  initialPage,
}: Props) {
  const [pages, setPages] = useState<PageData[]>([initialPage]);
  const [loading, setLoading] = useState(false);
  const [interstitialOpen, setInterstitialOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const interstitialShownForCount = useRef<Set<number>>(new Set());

  const loadNext = useCallback(async () => {
    const nextNumero = initialNumero + pages.length;
    if (nextNumero > totalPaginas || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/especiales/${encodeURIComponent(slug)}/${nextNumero}`);
      if (!res.ok) return;
      const data = await res.json();
      const newPage: PageData = {
        numero: data.numero,
        titulo_item: data.titulo_item ?? "",
        imagen_url: data.imagen_url ?? null,
        parrafos: Array.isArray(data.parrafos) ? data.parrafos : [],
        bloques: Array.isArray(data.bloques) ? data.bloques : undefined,
      };
      setPages((prev) => {
        const next = [...prev, newPage];
        const n = next.length;
        if (n >= 5 && n % 5 === 0 && !interstitialShownForCount.current.has(n)) {
          interstitialShownForCount.current.add(n);
          queueMicrotask(() => {
            setInterstitialOpen(true);
            window.setTimeout(() => {
              try {
                (
                  window as unknown as { googletag?: { cmd: { push: (fn: () => void) => void } } }
                ).googletag?.cmd.push(function () {
                  (
                    window as unknown as { googletag?: { display: (id: string) => void } }
                  ).googletag?.display(INTERSTITIAL_ID);
                });
              } catch {
                /* ignore */
              }
            }, 120);
            window.setTimeout(() => setInterstitialOpen(false), 4500);
          });
        }
        return next;
      });
      const url = `/especiales/${slug}/${nextNumero}`;
      window.history.pushState(null, "", url);
    } finally {
      setLoading(false);
    }
  }, [slug, totalPaginas, initialNumero, pages.length, loading]);

  const lastNumero = pages[pages.length - 1]?.numero ?? initialNumero;
  const hasMore = lastNumero < totalPaginas;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const [e] = entries;
        if (!e?.isIntersecting) return;
        loadNext();
      },
      { threshold: 0.75, rootMargin: "0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadNext, pages.length]);

  const getParrafosAndImagen = (page: PageData): { parrafos: string[]; imagenUrl: string | null } => {
    if (Array.isArray(page.bloques) && page.bloques.length > 0) {
      const parrafos = page.bloques
        .filter((b): b is { tipo: "parrafo"; texto: string } => b.tipo === "parrafo")
        .map((b) => b.texto);
      const firstImg = page.bloques.find((b): b is { tipo: "imagen"; url: string } => b.tipo === "imagen");
      return { parrafos, imagenUrl: firstImg?.url ?? null };
    }
    return {
      parrafos: page.parrafos ?? [],
      imagenUrl: page.imagen_url ?? null,
    };
  };

  const pClass = "text-xl leading-relaxed text-[var(--negro)]";

  return (
    <>
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="min-w-0 w-full px-4">
        <div className="mt-4 space-y-10">
          {pages.map((page) => {
            const { parrafos, imagenUrl } = getParrafosAndImagen(page);

            return (
              <article key={page.numero} className="pb-10" data-numero={page.numero}>
                <div className="space-y-4">
                  {page.titulo_item && (
                    <h2 className="font-serif text-xl font-semibold text-[var(--negro)]">
                      {page.titulo_item}
                    </h2>
                  )}

                  {imagenUrl && (
                    <div className="relative mt-4 w-full flex justify-center">
                      <img
                        src={optimizarImagenCloudinary(imagenUrl)}
                        alt={page.titulo_item || `Página ${page.numero}`}
                        style={{ maxHeight: "485px", width: "auto", maxWidth: "100%" }}
                      />
                    </div>
                  )}

                  <div className="my-2 max-w-full overflow-hidden rounded border border-[var(--negro)]/10 p-3 flex flex-col items-center">
                    <p className="mb-2 text-center text-xs font-normal text-[#aaaaaa]">-- ANUNCIO --</p>
                    <EspecialAdSlot numero={page.numero} kind="top" />
                  </div>

                  {parrafos.map((texto, i) => (
                    <p key={i} className={pClass}>
                      {texto}
                    </p>
                  ))}

                  <div className="mt-6 max-w-full overflow-hidden rounded border border-[var(--negro)]/10 p-3 flex flex-col items-center">
                    <p className="mb-2 text-center text-xs font-normal text-[#aaaaaa]">-- ANUNCIO --</p>
                    <EspecialAdSlot numero={page.numero} kind="bottom" />
                  </div>
                </div>
              </article>
            );
          })}
          {hasMore && (
            <div
              ref={sentinelRef}
              className="flex min-h-[120px] items-center justify-center py-6 text-sm text-[var(--negro)]/50"
              aria-hidden
            >
              {loading ? "Cargando…" : ""}
            </div>
          )}
        </div>
      </div>

      {/* <aside className="hidden shrink-0 self-start md:block md:w-1/4">
        <AdXSlot slotId="gpt-vahica-single-left" />
        <div className="sticky top-4 mt-6">
          <AdXSlot slotId="gpt-vahica-single-right" />
        </div>
      </aside> */}
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
