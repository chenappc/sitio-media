"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { getAdminSecret } from "@/app/admin/CerrarSesionBtn";

type PaginaEditar = {
  numero: number;
  imagen_url: string | null;
  parrafos: unknown[];
};

type StoryEditar = {
  slug: string;
  titulo: string;
  status: string;
  total_paginas: number;
  paginas: PaginaEditar[];
};

type LogLine = { text: string; isError?: boolean };

export default function AdminStoriesEditarPage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const [story, setStory] = useState<StoryEditar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageLogs, setPageLogs] = useState<Record<number, string[]>>({});
  const [pageProgress, setPageProgress] = useState<Record<number, "idle" | "loading" | "done" | "error">>({});
  const [regeneratingPagina, setRegeneratingPagina] = useState<number | null>(null);
  const [urlBaseAgregar, setUrlBaseAgregar] = useState("");
  const [paginaAgregar, setPaginaAgregar] = useState(1);
  const [agregando, setAgregando] = useState(false);
  const [logLines, setLogLines] = useState<LogLine[]>([]);

  const fetchStory = useCallback(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    fetch(`/api/stories/${encodeURIComponent(slug)}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Story no encontrada" : "Error al cargar");
        return r.json();
      })
      .then((data: StoryEditar) => setStory(data))
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    fetchStory();
  }, [fetchStory]);

  const appendPageLog = (numero: number, text: string) => {
    setPageLogs((prev) => ({
      ...prev,
      [numero]: [...(prev[numero] ?? []), text],
    }));
  };

  const handleRegenerarImagen = async (numero: number) => {
    const secret = getAdminSecret();
    if (!secret) {
      alert("Ingresá la contraseña admin (en /admin) primero.");
      return;
    }
    setPageProgress((prev) => ({ ...prev, [numero]: "loading" }));
    setPageLogs((prev) => ({ ...prev, [numero]: [] }));
    setRegeneratingPagina(numero);
    try {
      const res = await fetch("/api/stories/regenerar-imagen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({ storySlug: slug, pagina: numero }),
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const errMsg = data.error || "Error al regenerar imagen";
        appendPageLog(numero, errMsg);
        setPageProgress((prev) => ({ ...prev, [numero]: "error" }));
        setRegeneratingPagina(null);
        return;
      }
      if (contentType.includes("text/event-stream")) {
        const reader = res.body?.getReader();
        if (!reader) {
          appendPageLog(numero, "No se pudo leer el stream");
          setPageProgress((prev) => ({ ...prev, [numero]: "error" }));
          setRegeneratingPagina(null);
          return;
        }
        const dec = new TextDecoder();
        let buf = "";
        let imagenUrl: string | undefined;
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
                mensaje?: string;
                status?: string;
                done?: boolean;
                imagenUrl?: string;
              };
              if (data.mensaje != null) appendPageLog(numero, data.mensaje);
              if (data.status === "error") setPageProgress((prev) => ({ ...prev, [numero]: "error" }));
              if (data.done === true && data.imagenUrl) {
                imagenUrl = data.imagenUrl;
                setPageProgress((prev) => ({ ...prev, [numero]: "done" }));
                if (story) {
                  setStory({
                    ...story,
                    paginas: story.paginas.map((p) =>
                      p.numero === numero ? { ...p, imagen_url: imagenUrl ?? p.imagen_url } : p
                    ),
                  });
                }
              }
            } catch {
              // ignore parse
            }
          }
        }
        if (!imagenUrl) {
          setPageProgress((prev) => ({ ...prev, [numero]: prev[numero] === "done" ? "done" : "error" }));
        }
      } else {
        const data = await res.json().catch(() => ({}));
        const nuevaUrl = data.imagenUrl as string | undefined;
        appendPageLog(numero, "Analizando imagen...");
        appendPageLog(numero, "Generando con DALL-E...");
        appendPageLog(numero, "Subiendo a Cloudinary...");
        if (nuevaUrl && story) {
          setStory({
            ...story,
            paginas: story.paginas.map((p) =>
              p.numero === numero ? { ...p, imagen_url: nuevaUrl } : p
            ),
          });
          setPageProgress((prev) => ({ ...prev, [numero]: "done" }));
        } else {
          setPageProgress((prev) => ({ ...prev, [numero]: "error" }));
        }
      }
    } catch (e) {
      appendPageLog(numero, e instanceof Error ? e.message : String(e));
      setPageProgress((prev) => ({ ...prev, [numero]: "error" }));
    } finally {
      setRegeneratingPagina(null);
    }
  };

  const handleAgregarPaginas = async () => {
    const base = urlBaseAgregar.trim();
    const num = Math.max(1, paginaAgregar);
    if (!base) {
      setLogLines((prev) => [...prev, { text: "Completá la URL base.", isError: true }]);
      return;
    }
    const secret = getAdminSecret();
    if (!secret) {
      setLogLines((prev) => [...prev, { text: "Ingresá la contraseña admin (en /admin) primero.", isError: true }]);
      return;
    }
    setAgregando(true);
    setLogLines([]);
    try {
      const res = await fetch("/api/stories/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({ urlBase: base, paginaInicio: num, paginaFin: num }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        setLogLines((prev) => [...prev, { text: err.error || "Error al iniciar scrape", isError: true }]);
        setAgregando(false);
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        setLogLines((prev) => [...prev, { text: "No se pudo leer el stream", isError: true }]);
        setAgregando(false);
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
            const data = JSON.parse(line.slice(6)) as { mensaje?: string; status?: string; done?: boolean };
            if (data.mensaje != null) {
              setLogLines((prev) => [...prev, { text: String(data.mensaje), isError: data.status === "error" }]);
            }
            if (data.done === true) {
              setLogLines((prev) => [...prev, { text: "Página agregada." }]);
              fetchStory();
            }
          } catch {
            // ignore parse
          }
        }
      }
    } catch (e) {
      setLogLines((prev) => [...prev, { text: e instanceof Error ? e.message : String(e), isError: true }]);
    } finally {
      setAgregando(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <p className="text-[var(--negro)]/60">Cargando…</p>
      </div>
    );
  }
  if (error || !story) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <p className="text-red-600">{error ?? "Story no encontrada"}</p>
        <Link href="/admin-stories" className="mt-2 inline-block text-sm text-[var(--negro)]/70 underline">
          ← Volver
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold text-[var(--negro)]">{story.titulo}</h1>
        <Link
          href="/admin-stories"
          className="rounded border border-[var(--negro)]/20 px-4 py-2 text-sm font-medium text-[var(--negro)] hover:bg-[var(--negro)]/5 no-underline"
        >
          ← Volver
        </Link>
      </div>

      <section className="mb-8 rounded-lg border border-[var(--negro)]/10 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Páginas</h2>
        <ul className="space-y-4">
          {story.paginas.map((p) => {
            const progress = pageProgress[p.numero] ?? "idle";
            const logs = pageLogs[p.numero] ?? [];
            return (
              <li
                key={p.numero}
                className="flex flex-wrap items-start gap-4 border-b border-[var(--negro)]/10 pb-4 last:border-0"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-[var(--negro)]/70">Página {p.numero}</span>
                  <div className="relative mt-1 h-[150px] w-[200px] overflow-hidden rounded border border-[var(--negro)]/10 bg-[var(--negro)]/5">
                    {p.imagen_url ? (
                      <Image
                        src={p.imagen_url}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="200px"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-xs text-[var(--negro)]/40">
                        Sin imagen
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRegenerarImagen(p.numero)}
                    disabled={regeneratingPagina !== null}
                    className="mt-2 rounded border border-[var(--negro)]/20 px-2 py-1 text-xs font-medium hover:bg-[var(--negro)]/5 disabled:opacity-50"
                  >
                    {regeneratingPagina === p.numero ? "Generando..." : "Regenerar imagen"}
                  </button>
                  {progress === "loading" && (
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--negro)]/10">
                      <div className="h-full w-1/3 animate-pulse rounded-full bg-[var(--rojo)]" />
                    </div>
                  )}
                  {logs.length > 0 && (
                    <div className="mt-2 max-h-24 w-[200px] overflow-y-auto rounded border border-[var(--negro)]/10 bg-[var(--negro)]/5 p-1.5 font-mono text-xs">
                      {logs.map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </div>
                  )}
                  {progress === "done" && (
                    <p className="mt-1 text-xs font-medium text-green-600">✓ Listo</p>
                  )}
                  {progress === "error" && (
                    <p className="mt-1 text-xs font-medium text-red-600">✗ Error</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-lg border border-[var(--negro)]/10 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Agregar páginas faltantes</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-[var(--negro)]/70">URL base</label>
            <input
              type="text"
              value={urlBaseAgregar}
              onChange={(e) => setUrlBaseAgregar(e.target.value)}
              placeholder="https://www.consejosytrucos.co/online/es-farmerrevenge/"
              className="w-full rounded border border-[var(--negro)]/20 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--negro)]/70">Número de página a agregar</label>
            <input
              type="number"
              min={1}
              value={paginaAgregar}
              onChange={(e) => setPaginaAgregar(parseInt(e.target.value, 10) || 1)}
              className="w-24 rounded border border-[var(--negro)]/20 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={handleAgregarPaginas}
            disabled={agregando}
            className="rounded bg-[var(--rojo)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {agregando ? "Procesando…" : "Agregar páginas faltantes"}
          </button>
        </div>
        {logLines.length > 0 && (
          <div className="mt-4 max-h-40 overflow-y-auto rounded border border-[var(--negro)]/10 bg-[var(--negro)]/5 p-2 font-mono text-xs">
            {logLines.map((line, i) => (
              <div key={i} className={line.isError ? "text-red-600" : ""}>
                {line.text}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
