"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { es, enUS } from "date-fns/locale";
import AdXSlot from "@/components/AdXSlot";
import styles from "@/app/[slug]/page.module.css";

export type NotaInicial = {
  id: number;
  slug: string;
  titulo: string;
  entradilla: string;
  cuerpo: string;
  imagen_url: string | null;
  imagen2_url: string | null;
  imagen_alt: string | null;
  fuente_nombre: string;
  fuente_url: string | null;
  pais: string;
  fecha: string | Date;
};

type Props = {
  notaInicial: NotaInicial;
  idioma: "es" | "en";
};

const PATH_TOP = "/186299052/Vahica.com/Vahica_Single_Top";
const PATH_MIDDLE = "/186299052/Vahica.com/Vahica_Single_Middle";
const PATH_BOTTOM = "/186299052/Vahica.com/Vahica_Single_Bottom";
const SIZES: [number, number][] = [
  [336, 280],
  [300, 250],
  [728, 90],
  [970, 250],
];

type Googletag = {
  cmd: { push: (fn: () => void) => void };
  defineSlot: (
    path: string,
    sizes: unknown,
    divId: string
  ) => {
    defineSizeMapping: (m: unknown) => { addService: (s: unknown) => unknown };
    addService: (s: unknown) => unknown;
  };
  sizeMapping: () => {
    addSize: (viewport: [number, number], sizes: [number, number][]) => ReturnType<Googletag["sizeMapping"]>;
    build: () => unknown;
  };
  pubads: () => { getSlots: () => { getSlotElementId: () => string }[] };
  display: (id: string) => void;
};

function buildResponsiveMapping(g: Googletag) {
  return g
    .sizeMapping()
    .addSize([1024, 0], [
      [970, 250],
      [728, 90],
    ])
    .addSize([768, 0], [[728, 90]])
    .addSize([0, 0], [
      [336, 280],
      [300, 250],
    ])
    .build();
}

function getNotaSlotId(noteIndex: number, kind: "top" | "middle" | "bottom"): string {
  if (noteIndex === 1) {
    if (kind === "top") return "div-gpt-ad-1774066671869-0";
    if (kind === "middle") return "div-gpt-ad-1774066837194-0";
    return "div-gpt-ad-1774066088689-0";
  }
  return `gpt-vahica-nota-${kind}-${noteIndex}`;
}

function pathForKind(kind: "top" | "middle" | "bottom"): string {
  if (kind === "top") return PATH_TOP;
  if (kind === "middle") return PATH_MIDDLE;
  return PATH_BOTTOM;
}

/** Slots dinámicos (nota 2+) como EspecialAdSlot: define si falta y luego display. */
function defineNotaSlotIfNeededAndDisplay(noteIndex: number, kind: "top" | "middle" | "bottom"): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { googletag?: Googletag };
  const id = getNotaSlotId(noteIndex, kind);
  w.googletag?.cmd.push(function () {
    const g = w.googletag;
    if (!g) return;
    if (noteIndex > 1) {
      const slots = g.pubads().getSlots();
      const exists = (divId: string) =>
        slots.some((s) => {
          try {
            return s.getSlotElementId() === divId;
          } catch {
            return false;
          }
        });
      const mapping = buildResponsiveMapping(g);
      const path = pathForKind(kind);
      if (!exists(id)) {
        g.defineSlot(path, SIZES, id).defineSizeMapping(mapping).addService(g.pubads());
      }
    }
    g.display(id);
  });
}

function NotaGptSlot({
  noteIndex,
  kind,
  locale,
}: {
  noteIndex: number;
  kind: "top" | "middle" | "bottom";
  locale: "es" | "en";
}) {
  const id = getNotaSlotId(noteIndex, kind);

  useEffect(() => {
    if (noteIndex === 1) return;
    const timer = window.setTimeout(() => {
      defineNotaSlotIfNeededAndDisplay(noteIndex, kind);
    }, 100);
    return () => window.clearTimeout(timer);
  }, [noteIndex, kind]);

  if (noteIndex === 1) {
    return (
      <div className="my-4 max-w-full overflow-hidden rounded border border-[var(--negro)]/10 p-3 flex flex-col items-center">
        <AdXSlot slotId={id} showLabel locale={locale} />
      </div>
    );
  }

  return (
    <div className="my-4 max-w-full overflow-hidden rounded border border-[var(--negro)]/10 p-3 flex flex-col items-center">
      <p className="mb-2 text-center text-xs font-normal text-[#aaaaaa]">
        {locale === "en" ? "-- ADVERTISEMENT --" : "-- ANUNCIO --"}
      </p>
      <div id={id} style={{ minWidth: 300 }} />
    </div>
  );
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

function countParagraphs(html: string): number {
  const re = /<p\b[^>]*>[\s\S]*?<\/p>/gi;
  return [...html.matchAll(re)].length;
}

export default function NotaInfiniteScroll({ notaInicial, idioma }: Props) {
  const [notas, setNotas] = useState<NotaInicial[]>([notaInicial]);
  const [excluidos, setExcluidos] = useState<string[]>([notaInicial.slug]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const locale = idioma === "en" ? enUS : es;
  const adLocale = idioma === "en" ? "en" : "es";

  const loadNext = useCallback(async () => {
    if (loading || !hasMore) return;
    const last = notas[notas.length - 1];
    if (!last) return;
    setLoading(true);
    try {
      const excluirParam = excluidos.join(",");
      const url = `/api/notas/siguientes?slug=${encodeURIComponent(last.slug)}&excluir=${encodeURIComponent(excluirParam)}&idioma=${encodeURIComponent(idioma)}&limit=1`;
      const res = await fetch(url);
      if (!res.ok) {
        setHasMore(false);
        return;
      }
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        setHasMore(false);
        return;
      }
      const nueva: NotaInicial = data[0];
      setNotas((prev) => [...prev, nueva]);
      setExcluidos((prev) => [...prev, nueva.slug]);
      const path = idioma === "en" ? `/en/${nueva.slug}` : `/${nueva.slug}`;
      window.history.pushState(null, "", path);
    } finally {
      setLoading(false);
    }
  }, [notas, loading, hasMore, excluidos, idioma]);

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
  }, [hasMore, loadNext, notas.length]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="min-w-0 w-full space-y-12">
        {notas.map((nota, idx) => {
          const noteIndex = idx + 1;
          const cuerpoHtml = cuerpoConImagen2(nota.cuerpo, nota.imagen2_url, nota.imagen_alt ?? nota.titulo);
          const paraCount = countParagraphs(cuerpoHtml);
          const showMiddle = paraCount > 3;
          const { head: cuerpoHead, tail: cuerpoTail } = showMiddle
            ? splitCuerpoAfterParagraphs(cuerpoHtml, 3)
            : { head: cuerpoHtml, tail: "" };

          return (
            <article
              key={`${nota.id}-${nota.slug}-${idx}`}
              className="border-b border-[var(--negro)]/15 pb-12 last:border-b-0 last:pb-0"
              data-nota-slug={nota.slug}
            >
              <h1 className="font-serif text-2xl font-bold leading-tight md:text-3xl">{nota.titulo}</h1>
              <p className="mt-2 text-sm text-[var(--negro)]/60">
                {formatDistanceToNow(new Date(nota.fecha), { addSuffix: true, locale })}
              </p>

              <div className="relative mt-4 w-full flex justify-center">
                {nota.imagen_url ? (
                  <img
                    src={nota.imagen_url}
                    alt={nota.imagen_alt ?? nota.titulo}
                    style={{ maxHeight: "550px", maxWidth: "728px", width: "100%", height: "auto" }}
                  />
                ) : null}
              </div>

              <NotaGptSlot noteIndex={noteIndex} kind="top" locale={adLocale} />

              <p className="mt-4 text-lg font-medium text-[var(--negro)]/90">{nota.entradilla}</p>

              {cuerpoHead ? (
                <div
                  className={`prose prose-lg mt-6 max-w-none prose-a:text-[var(--rojo)] prose-a:no-underline hover:prose-a:underline ${styles.cuerpo}`}
                  dangerouslySetInnerHTML={{ __html: cuerpoHead }}
                />
              ) : null}

              {showMiddle && cuerpoTail ? (
                <>
                  <NotaGptSlot noteIndex={noteIndex} kind="middle" locale={adLocale} />
                  <div
                    className={`prose prose-lg max-w-none prose-a:text-[var(--rojo)] prose-a:no-underline hover:prose-a:underline ${styles.cuerpo}`}
                    dangerouslySetInnerHTML={{ __html: cuerpoTail }}
                  />
                </>
              ) : null}

              <div className="mt-8">
                <NotaGptSlot noteIndex={noteIndex} kind="bottom" locale={adLocale} />
              </div>

              {nota.fuente_url ? (
                <p style={{ fontSize: 14, color: "#666", marginTop: 24 }}>
                  {idioma === "en" ? "Source:" : "Fuente:"}{" "}
                  <a href={nota.fuente_url} target="_blank" rel="nofollow noopener noreferrer">
                    {nota.fuente_nombre || (idioma === "en" ? "External link" : "Enlace externo")}
                  </a>
                </p>
              ) : null}
            </article>
          );
        })}

        {hasMore && (
          <div
            ref={sentinelRef}
            className="flex min-h-[120px] items-center justify-center py-6 text-sm text-[var(--negro)]/50"
            aria-hidden
          >
            {loading ? (idioma === "en" ? "Loading…" : "Cargando…") : ""}
          </div>
        )}
      </div>
    </div>
  );
}
