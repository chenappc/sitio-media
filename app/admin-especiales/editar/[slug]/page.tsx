"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getAdminSecret } from "@/app/admin/CerrarSesionBtn";

type PaginaEditar = {
  numero: number;
  titulo_item: string;
  imagen_url: string | null;
  parrafos: string[];
};

type EspecialEditar = {
  id: number;
  slug: string;
  titulo: string;
  total_paginas: number;
  paginas: PaginaEditar[];
};

type EspecialListRow = { id: number; slug: string; titulo: string };

export default function AdminEspecialesEditarPage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const [especial, setEspecial] = useState<EspecialEditar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tituloEditando, setTituloEditando] = useState(false);
  const [tituloNuevo, setTituloNuevo] = useState("");
  const [guardandoTitulo, setGuardandoTitulo] = useState(false);
  const [tituloItemEditando, setTituloItemEditando] = useState<number | null>(null);
  const [tituloItemNuevo, setTituloItemNuevo] = useState("");
  const [guardandoTituloItem, setGuardandoTituloItem] = useState(false);
  const [regeneratingNumero, setRegeneratingNumero] = useState<number | null>(null);

  const fetchEspecial = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const [listRes, firstRes] = await Promise.all([
        fetch("/api/especiales").then((r) => r.json()),
        fetch(`/api/especiales/${encodeURIComponent(slug)}/1`),
      ]);
      const list: EspecialListRow[] = Array.isArray(listRes) ? listRes : [];
      const meta = list.find((e: EspecialListRow) => e.slug === slug);
      if (!firstRes.ok) {
        throw new Error(firstRes.status === 404 ? "Especial no encontrado" : "Error al cargar");
      }
      if (!meta) {
        throw new Error("Especial no encontrado en la lista");
      }
      const firstData = await firstRes.json();
      const totalPaginas = firstData.total_paginas ?? 1;
      const pagesToFetch = Array.from({ length: totalPaginas }, (_, i) => i + 1);
      const pageResults = await Promise.all(
        pagesToFetch.map((num) =>
          fetch(`/api/especiales/${encodeURIComponent(slug)}/${num}`).then((r) => r.json())
        )
      );
      const paginas: PaginaEditar[] = pageResults.map((p: { numero: number; titulo_item?: string; imagen_url?: string | null; parrafos?: string[] }) => ({
        numero: p.numero,
        titulo_item: p.titulo_item ?? "",
        imagen_url: p.imagen_url ?? null,
        parrafos: Array.isArray(p.parrafos) ? p.parrafos : [],
      }));
      setEspecial({
        id: meta?.id ?? 0,
        slug,
        titulo: meta?.titulo ?? firstData.titulo ?? slug,
        total_paginas: totalPaginas,
        paginas,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchEspecial();
  }, [fetchEspecial]);

  const handleGuardarTitulo = async () => {
    const secret = getAdminSecret();
    if (!secret || !especial) return;
    setGuardandoTitulo(true);
    try {
      const res = await fetch("/api/especiales", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ id: especial.id, titulo: tituloNuevo.trim() }),
      });
      if (res.ok) {
        setEspecial({ ...especial, titulo: tituloNuevo.trim() });
        setTituloEditando(false);
      } else {
        alert("Error al guardar título");
      }
    } catch {
      alert("Error al guardar título");
    } finally {
      setGuardandoTitulo(false);
    }
  };

  const handleGuardarTituloItem = async (numero: number) => {
    const secret = getAdminSecret();
    if (!secret || !especial) return;
    setGuardandoTituloItem(true);
    try {
      const res = await fetch("/api/especiales", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({
          id: especial.id,
          pagina: { numero, titulo_item: tituloItemNuevo.trim() },
        }),
      });
      if (res.ok) {
        setEspecial({
          ...especial,
          paginas: especial.paginas.map((p) =>
            p.numero === numero ? { ...p, titulo_item: tituloItemNuevo.trim() } : p
          ),
        });
        setTituloItemEditando(null);
      } else {
        alert("Error al guardar título del ítem");
      }
    } catch {
      alert("Error al guardar título del ítem");
    } finally {
      setGuardandoTituloItem(false);
    }
  };

  const handleRegenerarImagen = async (numero: number) => {
    const secret = getAdminSecret();
    if (!secret) {
      alert("Ingresá la contraseña admin (en /admin) primero.");
      return;
    }
    setRegeneratingNumero(numero);
    try {
      const res = await fetch("/api/especiales/regenerar-imagen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({ slug, numero }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.imagen_url && especial) {
        setEspecial({
          ...especial,
          paginas: especial.paginas.map((p) =>
            p.numero === numero ? { ...p, imagen_url: data.imagen_url } : p
          ),
        });
      } else if (!res.ok || data.error) {
        alert(data.error ?? "Error al regenerar imagen");
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al regenerar imagen");
    } finally {
      setRegeneratingNumero(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <p className="text-[var(--negro)]/60">Cargando…</p>
      </div>
    );
  }
  if (error || !especial) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <p className="text-red-600">{error ?? "Especial no encontrado"}</p>
        <Link href="/admin-especiales" className="mt-2 inline-block text-sm text-[var(--negro)]/70 underline">
          ← Admin Especiales
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {tituloEditando ? (
            <div className="flex flex-1 items-center gap-2">
              <input
                type="text"
                value={tituloNuevo}
                onChange={(e) => setTituloNuevo(e.target.value)}
                className="flex-1 rounded border border-[var(--negro)]/20 px-3 py-2 font-serif text-xl font-bold"
                autoFocus
              />
              <button
                onClick={handleGuardarTitulo}
                disabled={guardandoTitulo || !tituloNuevo.trim()}
                className="rounded bg-[var(--rojo)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {guardandoTitulo ? "..." : "Guardar"}
              </button>
              <button
                onClick={() => setTituloEditando(false)}
                className="rounded border border-[var(--negro)]/20 px-3 py-2 text-sm hover:bg-[var(--negro)]/5"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex flex-1 items-center gap-2">
              <h1 className="font-serif text-2xl font-bold text-[var(--negro)]">{especial.titulo}</h1>
              <button
                onClick={() => {
                  setTituloNuevo(especial.titulo);
                  setTituloEditando(true);
                }}
                className="rounded border border-[var(--negro)]/20 px-2 py-1 text-xs hover:bg-[var(--negro)]/5"
              >
                ✏️ Editar título
              </button>
            </div>
          )}
          <Link
            href="/admin-especiales"
            className="rounded border border-[var(--negro)]/20 px-4 py-2 text-sm font-medium text-[var(--negro)] hover:bg-[var(--negro)]/5 no-underline"
          >
            ← Admin Especiales
          </Link>
        </div>
      </div>

      <section className="mb-8 rounded-lg border border-[var(--negro)]/10 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Ítems</h2>
        <ul className="space-y-4">
          {especial.paginas.map((p) => (
            <li
              key={p.numero}
              className="flex flex-wrap items-start gap-4 border-b border-[var(--negro)]/10 pb-4 last:border-0"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-[var(--negro)]/70">
                  Ítem {p.numero} de {especial.total_paginas}
                </span>
                {tituloItemEditando === p.numero ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={tituloItemNuevo}
                      onChange={(e) => setTituloItemNuevo(e.target.value)}
                      className="min-w-[200px] rounded border border-[var(--negro)]/20 px-2 py-1.5 text-sm"
                      autoFocus
                    />
                    <button
                      onClick={() => handleGuardarTituloItem(p.numero)}
                      disabled={guardandoTituloItem || !tituloItemNuevo.trim()}
                      className="rounded bg-[var(--rojo)] px-2 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {guardandoTituloItem ? "..." : "Guardar"}
                    </button>
                    <button
                      onClick={() => setTituloItemEditando(null)}
                      className="rounded border border-[var(--negro)]/20 px-2 py-1.5 text-xs hover:bg-[var(--negro)]/5"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm text-[var(--negro)]">{p.titulo_item || "(sin título)"}</span>
                    <button
                      onClick={() => {
                        setTituloItemNuevo(p.titulo_item);
                        setTituloItemEditando(p.numero);
                      }}
                      className="rounded border border-[var(--negro)]/20 px-1.5 py-0.5 text-xs hover:bg-[var(--negro)]/5"
                    >
                      Editar
                    </button>
                  </div>
                )}
                <div className="relative mt-2 h-[150px] w-[200px] overflow-hidden rounded border border-[var(--negro)]/10 bg-[var(--negro)]/5">
                  {p.imagen_url ? (
                    <img
                      src={p.imagen_url}
                      alt=""
                      className="h-full w-full object-cover"
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
                  disabled={regeneratingNumero !== null}
                  className="mt-2 rounded border border-[var(--negro)]/20 px-2 py-1 text-xs font-medium hover:bg-[var(--negro)]/5 disabled:opacity-50"
                >
                  {regeneratingNumero === p.numero ? "Generando…" : "Regenerar imagen"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
