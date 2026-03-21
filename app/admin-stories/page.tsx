"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAdminSecret } from "@/app/admin/CerrarSesionBtn";

/** Misma idea que el selector en app/admin/page.tsx (persistencia por story). */
const IDIOMA_STORIES_STORAGE_KEY = "vahica-admin-stories-idioma";

type IdiomaStories = "es" | "en" | "original";

type StoryRow = {
  id: number;
  slug: string;
  titulo: string;
  status: string;
  total_paginas: number;
  created_at?: string;
};

type LogLine = { text: string; isError?: boolean };

export default function AdminStoriesPage() {
  const [urlBase, setUrlBase] = useState("");
  const [paginaInicio, setPaginaInicio] = useState(1);
  const [paginaFin, setPaginaFin] = useState(1);
  const [sinImagenesIa, setSinImagenesIa] = useState(false);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [logLines, setLogLines] = useState<LogLine[]>([]);
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [loadingStories, setLoadingStories] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [idioma, setIdioma] = useState<IdiomaStories>("es");
  const router = useRouter();

  const fetchStories = useCallback(() => {
    fetch("/api/stories")
      .then((r) => r.json())
      .then((data) => {
        setStories(Array.isArray(data) ? data : []);
      })
      .catch(() => setStories([]))
      .finally(() => setLoadingStories(false));
  }, []);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  useEffect(() => {
    try {
      const v = sessionStorage.getItem(IDIOMA_STORIES_STORAGE_KEY);
      if (v === "en" || v === "original" || v === "es") setIdioma(v);
    } catch {
      /* ignore */
    }
  }, []);

  const handleScrapear = async () => {
    const base = urlBase.trim();
    const inicio = Math.max(1, paginaInicio);
    const fin = Math.max(inicio, paginaFin);
    if (!base) {
      setLogLines((prev) => [...prev, { text: "Completá la URL base.", isError: true }]);
      return;
    }
    const secret = getAdminSecret();
    if (!secret) {
      setLogLines((prev) => [...prev, { text: "Ingresá la contraseña admin (en /admin) primero.", isError: true }]);
      return;
    }

    setScraping(true);
    setProgressTotal(fin - inicio + 1);
    setProgressCurrent(0);
    setLogLines([]);

    try {
      const res = await fetch("/api/stories/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({
          urlBase: base,
          paginaInicio: inicio,
          paginaFin: fin,
          sinImagenesIa,
          idioma,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        setLogLines((prev) => [...prev, { text: err.error || "Error al iniciar scrape", isError: true }]);
        setScraping(false);
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        setLogLines((prev) => [...prev, { text: "No se pudo leer el stream", isError: true }]);
        setScraping(false);
        return;
      }
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          try {
            const data = JSON.parse(line.slice(6)) as {
              pagina?: number;
              total?: number;
              status?: string;
              mensaje?: string;
              done?: boolean;
              storySlug?: string;
            };
            if (data.total != null) setProgressTotal(data.total);
            if (data.pagina != null) setProgressCurrent(data.pagina);
            if (data.mensaje != null) {
              setLogLines((prev) => [...prev, { text: String(data.mensaje), isError: data.status === "error" }]);
            }
            if (data.done === true) {
              setLogLines((prev) => [...prev, { text: "¡Story creada!" }]);
              fetchStories();
            }
          } catch {
            // ignore parse
          }
        }
      }
    } catch (e) {
      setLogLines((prev) => [
        ...prev,
        { text: e instanceof Error ? e.message : String(e), isError: true },
      ]);
    } finally {
      setScraping(false);
    }
  };

  const handlePublicar = async (s: StoryRow) => {
    const secret = getAdminSecret();
    if (!secret) {
      setLogLines((prev) => [...prev, { text: "Ingresá la contraseña admin primero.", isError: true }]);
      return;
    }
    const nextStatus = s.status === "published" ? "draft" : "published";
    setPublishingId(s.id);
    try {
      const res = await fetch("/api/stories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ id: s.id, status: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLogLines((prev) => [...prev, { text: data.error || "Error al actualizar", isError: true }]);
        return;
      }
      fetchStories();
    } finally {
      setPublishingId(null);
    }
  };

  const handleBorrar = async (s: StoryRow) => {
    if (!confirm("¿Borrar esta story?")) return;
    const secret = getAdminSecret();
    if (!secret) {
      setLogLines((prev) => [...prev, { text: "Ingresá la contraseña admin primero.", isError: true }]);
      return;
    }
    setDeletingId(s.id);
    try {
      const res = await fetch("/api/stories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ id: s.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLogLines((prev) => [...prev, { text: data.error || "Error al borrar", isError: true }]);
        return;
      }
      fetchStories();
    } finally {
      setDeletingId(null);
    }
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
          <div className="mb-6 rounded-lg border border-[var(--negro)]/10 bg-white p-4 shadow-sm">
            <label
              htmlFor="admin-stories-idioma"
              className="mb-1 block text-sm text-[var(--negro)]/70"
            >
              Idioma
            </label>
            <select
              id="admin-stories-idioma"
              name="idioma"
              value={idioma}
              onChange={(e) => {
                const v = e.target.value as IdiomaStories;
                setIdioma(v);
                try {
                  sessionStorage.setItem(IDIOMA_STORIES_STORAGE_KEY, v);
                } catch {
                  /* ignore */
                }
              }}
              className="w-full max-w-xs rounded border border-[var(--negro)]/20 px-3 py-2 text-sm"
            >
              <option value="es">Español (es)</option>
              <option value="en">English (en)</option>
              <option value="original">Idioma original</option>
            </select>
          </div>
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
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="sin-imagenes-ia"
              checked={sinImagenesIa}
              onChange={(e) => setSinImagenesIa(e.target.checked)}
              className="rounded border-[var(--negro)]/20"
            />
            <label htmlFor="sin-imagenes-ia" className="text-sm text-[var(--negro)]/80">
              Sin imágenes IA (usar imágenes originales)
            </label>
          </div>
          <button
            type="button"
            onClick={handleScrapear}
            disabled={scraping}
            className="rounded bg-[var(--rojo)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {scraping ? "Procesando…" : "Scrapear y generar"}
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
                  <div key={i} className={line.isError ? "text-red-600" : ""}>
                    {line.text}
                  </div>
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
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(`/stories/${s.slug}/1`)}
                    className="rounded border border-[var(--negro)]/20 px-2 py-1 text-xs font-medium hover:bg-[var(--negro)]/5 text-[var(--negro)]"
                  >
                    Ver
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/admin-stories/editar/${s.slug}`)}
                    className="rounded border border-[var(--negro)]/20 px-2 py-1 text-xs font-medium hover:bg-[var(--negro)]/5 text-[var(--negro)]"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePublicar(s)}
                    disabled={publishingId !== null}
                    className="rounded border border-green-600/50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
                  >
                    {publishingId === s.id ? "…" : s.status === "published" ? "Despublicar" : "Publicar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBorrar(s)}
                    disabled={deletingId !== null}
                    className="rounded border border-[var(--rojo)]/50 px-2 py-1 text-xs font-medium text-[var(--rojo)] hover:bg-[var(--rojo)]/10 disabled:opacity-50"
                  >
                    {deletingId === s.id ? "…" : "Borrar"}
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
