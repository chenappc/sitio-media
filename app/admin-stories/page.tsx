"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type StoryRow = {
  id: number;
  slug: string;
  titulo: string;
  status: string;
  total_paginas: number;
  created_at?: string;
};

export default function AdminStoriesPage() {
  const [urlBase, setUrlBase] = useState("");
  const [paginaInicio, setPaginaInicio] = useState(1);
  const [paginaFin, setPaginaFin] = useState(1);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [loadingStories, setLoadingStories] = useState(true);

  useEffect(() => {
    fetch("/api/stories")
      .then((r) => r.json())
      .then((data) => {
        setStories(Array.isArray(data) ? data : []);
      })
      .catch(() => setStories([]))
      .finally(() => setLoadingStories(false));
  }, []);

  const handleScrapear = () => {
    setProgressTotal(paginaFin - paginaInicio + 1);
    setProgressCurrent(0);
    setLogLines([]);
    // Placeholder: sin funcionalidad aún
    setLogLines((prev) => [...prev, "Scrapear y generar: sin implementar aún."]);
  };

  const totalProgress = progressTotal > 0 ? progressTotal : 1;
  const progressPct = Math.round((progressCurrent / totalProgress) * 100);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold">Admin Stories</h1>
        <Link
          href="/admin"
          className="rounded border border-[var(--negro)]/20 px-4 py-2 text-sm font-medium text-[var(--negro)] hover:bg-[var(--negro)]/5 no-underline"
        >
          ← Admin Notas
        </Link>
      </div>

      <section className="mb-8 rounded-lg border border-[var(--negro)]/10 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Nueva Story</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-[var(--negro)]/70">URL base</label>
            <input
              type="text"
              value={urlBase}
              onChange={(e) => setUrlBase(e.target.value)}
              placeholder="https://www.consejosytrucos.co/online/es-farmerrevenge/"
              className="w-full rounded border border-[var(--negro)]/20 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-4">
            <div>
              <label className="mb-1 block text-sm text-[var(--negro)]/70">Página inicio</label>
              <input
                type="number"
                min={1}
                value={paginaInicio}
                onChange={(e) => setPaginaInicio(parseInt(e.target.value, 10) || 1)}
                className="w-24 rounded border border-[var(--negro)]/20 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--negro)]/70">Página fin</label>
              <input
                type="number"
                min={1}
                value={paginaFin}
                onChange={(e) => setPaginaFin(parseInt(e.target.value, 10) || 1)}
                className="w-24 rounded border border-[var(--negro)]/20 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleScrapear}
            className="rounded bg-[var(--rojo)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Scrapear y generar
          </button>
        </div>
        {(progressTotal > 0 || logLines.length > 0) && (
          <div className="mt-4">
            <div
              className="mb-2 h-2 w-full overflow-hidden rounded-full bg-[var(--negro)]/10"
              role="progressbar"
              aria-valuenow={progressCurrent}
              aria-valuemin={0}
              aria-valuemax={totalProgress}
            >
              <div
                className="h-full rounded-full bg-[var(--rojo)] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {progressTotal > 0 && (
              <p className="text-xs text-[var(--negro)]/60">
                Página {progressCurrent} de {progressTotal}
              </p>
            )}
            {logLines.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded border border-[var(--negro)]/10 bg-[var(--negro)]/5 p-2 font-mono text-xs">
                {logLines.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-[var(--negro)]/10 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Stories existentes</h2>
        {loadingStories ? (
          <p className="text-sm text-[var(--negro)]/60">Cargando…</p>
        ) : stories.length === 0 ? (
          <p className="text-sm text-[var(--negro)]/60">No hay stories.</p>
        ) : (
          <ul className="space-y-3">
            {stories.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--negro)]/10 pb-3 last:border-0"
              >
                <div>
                  <span className="font-medium">{s.titulo}</span>
                  <span className="ml-2 text-sm text-[var(--negro)]/60">{s.slug}</span>
                  <span className="ml-2 text-sm text-[var(--negro)]/60">
                    · {s.total_paginas} págs · {s.status}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded border border-[var(--negro)]/20 px-2 py-1 text-xs font-medium hover:bg-[var(--negro)]/5"
                  >
                    Ver
                  </button>
                  <button
                    type="button"
                    className="rounded border border-[var(--negro)]/20 px-2 py-1 text-xs font-medium hover:bg-[var(--negro)]/5"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="rounded border border-green-600/50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
                  >
                    Publicar
                  </button>
                  <button
                    type="button"
                    className="rounded border border-[var(--rojo)]/50 px-2 py-1 text-xs font-medium text-[var(--rojo)] hover:bg-[var(--rojo)]/10"
                  >
                    Borrar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
