"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import AdSense from "@/components/AdSense";

type PageData = {
  numero: number;
  titulo_item: string;
  imagen_url: string | null;
  parrafos: string[];
};

function optimizarImagenCloudinary(url: string) {
  if (!url || !url.includes("res.cloudinary.com")) return url;
  return url.replace("/upload/", "/upload/w_600,c_fit,q_auto/");
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
  const sentinelRef = useRef<HTMLDivElement>(null);

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
      };
      setPages((prev) => [...prev, newPage]);
      const url = `/especiales/${slug}/${nextNumero}`;
      window.history.pushState(null, "", url);
      try {
        (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle?.push({});
      } catch {
        // ignore
      }
    } finally {
      setLoading(false);
    }
  }, [slug, totalPaginas, initialNumero, pages.length, loading]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const [e] = entries;
        if (!e?.isIntersecting) return;
        if (pages.length >= totalPaginas) return;
        loadNext();
      },
      { threshold: 0.75, rootMargin: "0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [pages.length, totalPaginas, loadNext]);

  return (
    <div className="mt-4 space-y-10">
      {pages.map((page) => (
        <article
          key={page.numero}
          className="border-b border-[var(--negro)]/10 pb-10 last:border-0"
          data-numero={page.numero}
        >
          {page.imagen_url && (
            <div className="relative w-full">
              <Image
                src={optimizarImagenCloudinary(page.imagen_url)}
                alt={page.titulo_item || `Página ${page.numero}`}
                width={600}
                height={600}
                className="w-full h-auto"
                priority={page.numero === initialNumero}
              />
            </div>
          )}
          <div className="my-4 min-h-[90px] rounded-sm bg-[var(--negro)]/5">
            <AdSense slot="7922354756" />
          </div>
          {page.titulo_item && (
            <h2 className="mt-4 font-serif text-xl font-semibold text-[var(--negro)]">
              {page.titulo_item}
            </h2>
          )}
          <div className="mt-4 space-y-4 text-[var(--negro)]">
            {page.parrafos.map((texto, i) => (
              <p key={i} className="text-lg leading-relaxed">
                {texto}
              </p>
            ))}
          </div>
        </article>
      ))}
      {pages.length < totalPaginas && (
        <div
          ref={sentinelRef}
          className="flex min-h-[120px] items-center justify-center py-6 text-[var(--negro)]/50 text-sm"
          aria-hidden
        >
          {loading ? "Cargando…" : ""}
        </div>
      )}
    </div>
  );
}
