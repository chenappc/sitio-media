"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAdminSecret } from "@/app/admin/CerrarSesionBtn";

type IdiomaOption = "es" | "en" | "original";

const IDIOMA_LABELS: Record<IdiomaOption, string> = {
  es: "Español neutro",
  en: "Inglés",
  original: "Idioma original",
};

const PER_PAGE = 20;

type EspecialRow = {
  id: number;
  slug: string;
  titulo: string;
  status: string;
  total_paginas: number;
  created_at?: string;
};

type LogLine = { text: string; isError?: boolean };

export default function AdminEspecialesPage() {
  const [urlFuente, setUrlFuente] = useState("");
  const [idioma, setIdioma] = useState<IdiomaOption>("es");
  const [usarImagenesIa, setUsarImagenesIa] = useState(false);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [logLines, setLogLines] = useState<LogLine[]>([]);
  const [especiales, setEspeciales] = useState<EspecialRow[]>([]);
  const [loadingEspeciales, setLoadingEspeciales] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const router = useRouter();

  const fetchEspeciales = useCallback(() => {
    fetch("/api/especiales")
      .then((r) => r.json())
      .then((data) => {
        setEspeciales(Array.isArray(data) ? data : []);
      })
      .catch(() => setEspeciales([]))
      .finally(() => setLoadingEspeciales(false));
  }, []);

  useEffect(() => {
    fetchEspeciales();
  }, [fetchEspeciales]);

  const handleScrapear = async () => {
    const url = urlFuente.trim();
    if (!url) {
      setLogLines((prev) => [...prev, { text: "Completá la URL del artículo fuente.", isError: true }]);
      return;
    }
    const secret = getAdminSecret();
    if (!secret) {
      setLogLines((prev) => [...prev, { text: "Ingresá la contraseña admin (en /admin) primero.", isError: true }]);
      return;
    }

    setScraping(true);
    setProgressCurrent(0);
    setProgressTotal(0);
    setLogLines([]);

    try {
      const res = await fetch("/api/especiales/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({ urlBase: url, idioma, usarImagenesIa }),
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
              especialSlug?: string;
            };
            if (data.total != null) setProgressTotal(data.total);
            if (data.pagina != null) setProgressCurrent(data.pagina);
            if (data.mensaje != null) {
              setLogLines((prev) => [...prev, { text: String(data.mensaje), isError: data.status === "error" }]);
            }
            if (data.done === true) {
              setLogLines((prev) => [...prev, { text: "¡Especial creado!" }]);
              fetchEspeciales();
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

  const handlePublicar = async (e: EspecialRow) => {
    const secret = getAdminSecret();
    if (!secret) {
      setLogLines((prev) => [...prev, { text: "Ingresá la contraseña admin primero.", isError: true }]);
      return;
    }
    const nextStatus = e.status === "published" ? "draft" : "published";
    setPublishingId(e.id);
    try {
      const res = await fetch("/api/especiales", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ id: e.id, status: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLogLines((prev) => [...prev, { text: data.error || "Error al actualizar", isError: true }]);
        return;
      }
      fetchEspeciales();
    } finally {
      setPublishingId(null);
    }
  };

  const handleBorrar = async (e: EspecialRow) => {
    if (!confirm("¿Borrar este especial?")) return;
    const secret = getAdminSecret();
    if (!secret) {
      setLogLines((prev) => [...prev, { text: "Ingresá la contraseña admin primero.", isError: true }]);
      return;
    }
    setDeletingId(e.id);
    try {
      const res = await fetch("/api/especiales", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ id: e.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLogLines((prev) => [...prev, { text: data.error || "Error al borrar", isError: true }]);
        return;
      }
      fetchEspeciales();
    } finally {
      setDeletingId(null);
    }
  };

  const totalProgress = progressTotal > 0 ? progressTotal : 1;
  const progressPct = Math.round((progressCurrent / totalProgress) * 100);

  const totalPages = Math.max(1, Math.ceil(especiales.length / PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const start = (page - 1) * PER_PAGE;
  const paginated = especiales.slice(start, start + PER_PAGE);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold">Admin Especiales</h1>
        <Link
          href="/admin"
          className="rounded border border-[var(--negro)]/20 px-4 py-2 text-sm font-medium text-[var(--negro)] hover:bg-[var(--negro)]/5 no-underline"
        >
          ← Admin Notas
        </Link>
      </div>

      <section className="mb-8 rounded-lg border border-[var(--negro)]/10 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Nuevo Especial</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-[var(--negro)]/70">URL del artículo fuente</label>
            <input
              type="url"
              value={urlFuente}
              onChange={(e) => setUrlFuente(e.target.value)}
              placeholder="https://ejemplo.com/articulo"
              className="w-full rounded border border-[var(--negro)]/20 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--negro)]/70">Idioma</label>
            <select
              value={idioma}
              onChange={(e) => setIdioma(e.target.value as IdiomaOption)}
              className="w-full max-w-xs rounded border border-[var(--negro)]/20 px-3 py-2 text-sm"
            >
              {(Object.entries(IDIOMA_LABELS) as [IdiomaOption, string][]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="usar-imagenes-ia"
              checked={usarImagenesIa}
              onChange={(e) => setUsarImagenesIa(e.target.checked)}
              className="rounded border-[var(--negro)]/20"
            />
            <label htmlFor="usar-imagenes-ia" className="text-sm text-[var(--negro)]/80">
              Generar imágenes con IA
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
                Ítem {progressCurrent} de {progressTotal}
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
        <h2 className="mb-4 text-lg font-semibold">Especiales existentes</h2>
        {loadingEspeciales ? (
          <p className="text-sm text-[var(--negro)]/60">Cargando…</p>
        ) : especiales.length === 0 ? (
          <p className="text-sm text-[var(--negro)]/60">No hay especiales.</p>
        ) : (
          <>
            <ul className="space-y-3">
              {paginated.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--negro)]/10 pb-3 last:border-0"
                >
                  <div>
                    <span className="font-medium">{e.titulo}</span>
                    <span className="ml-2 text-sm text-[var(--negro)]/60">{e.slug}</span>
                    <span className="ml-2 text-sm text-[var(--negro)]/60">
                      · {e.total_paginas} ítems · {e.status}
                    </span>
                    {e.created_at && (
                      <span className="ml-2 text-xs text-[var(--negro)]/50">
                        {new Date(e.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/especiales/${e.slug}/1`)}
                      className="rounded border border-[var(--negro)]/20 px-2 py-1 text-xs font-medium hover:bg-[var(--negro)]/5 text-[var(--negro)]"
                    >
                      Ver
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(`/admin-especiales/editar/${e.slug}`)}
                      className="rounded border border-[var(--negro)]/20 px-2 py-1 text-xs font-medium hover:bg-[var(--negro)]/5 text-[var(--negro)]"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePublicar(e)}
                      disabled={publishingId !== null}
                      className="rounded border border-green-600/50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
                    >
                      {publishingId === e.id ? "…" : e.status === "published" ? "Despublicar" : "Publicar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBorrar(e)}
                      disabled={deletingId !== null}
                      className="rounded border border-[var(--rojo)]/50 px-2 py-1 text-xs font-medium text-[var(--rojo)] hover:bg-[var(--rojo)]/10 disabled:opacity-50"
                    >
                      {deletingId === e.id ? "…" : "Borrar"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between border-t border-[var(--negro)]/10 pt-4">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded border border-[var(--negro)]/20 px-3 py-1 text-sm font-medium disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="text-sm text-[var(--negro)]/60">
                  Página {page} de {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded border border-[var(--negro)]/20 px-3 py-1 text-sm font-medium disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
