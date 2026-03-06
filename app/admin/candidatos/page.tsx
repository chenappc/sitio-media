"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { getAdminSecret } from "../CerrarSesionBtn";

const PER_PAGE = 20;

type Candidato = {
  id: number;
  titulo: string;
  url: string;
  thumbnail: string | null;
  total_facebook_shares: number;
  keyword: string | null;
  status: string;
  nota_id: number | null;
  created_at: string;
};

export default function CandidatosPage() {
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [descartandoId, setDescartandoId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const fetchCandidatos = async () => {
    const secret = getAdminSecret();
    if (!secret) {
      setError("Ingresá la contraseña admin en /admin primero.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/candidatos", {
        headers: { "x-admin-secret": secret },
      });
      if (!res.ok) {
        if (res.status === 401) setError("No autorizado");
        else setError("Error al cargar candidatos");
        setCandidatos([]);
        return;
      }
      const data = await res.json();
      setCandidatos(Array.isArray(data) ? data : []);
      setPage(1);
    } catch {
      setError("Error al cargar candidatos");
      setCandidatos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidatos();
  }, []);

  const descartar = async (id: number) => {
    const secret = getAdminSecret();
    if (!secret) {
      alert("Ingresá la contraseña admin primero.");
      return;
    }
    setDescartandoId(id);
    try {
      const res = await fetch(`/api/candidatos/${id}`, {
        method: "DELETE",
        headers: { "x-admin-secret": secret },
      });
      if (res.ok) {
        setCandidatos((prev) => prev.filter((c) => c.id !== id));
      } else {
        alert("Error al descartar");
      }
    } catch {
      alert("Error al descartar");
    } finally {
      setDescartandoId(null);
    }
  };

  const total = candidatos.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PER_PAGE;
  const pageCandidatos = candidatos.slice(start, start + PER_PAGE);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="text-[var(--negro)]/70 hover:text-[var(--negro)] text-sm font-medium"
          >
            ← Admin Notas
          </Link>
          <h1 className="font-serif text-2xl font-bold">Candidatos via API</h1>
        </div>
      </div>

      {loading && (
        <p className="text-[var(--negro)]/60 mb-4">Cargando candidatos...</p>
      )}

      {error && (
        <p className="text-red-600 mb-4">{error}</p>
      )}

      {!loading && !error && (
        <>
          <p className="text-[var(--negro)]/70 mb-4">
            {total} candidatos pendientes
          </p>

          {total === 0 ? (
            <p className="text-[var(--negro)]/60">No hay candidatos pendientes.</p>
          ) : (
            <>
              <ul className="space-y-4">
                {pageCandidatos.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-start gap-3 rounded border border-[var(--negro)]/15 p-3 bg-white"
                  >
                    {c.thumbnail ? (
                      <img
                        src={c.thumbnail}
                        alt=""
                        className="w-16 h-16 object-cover rounded flex-shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded bg-[var(--negro)]/10 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--negro)] line-clamp-2">
                        {c.titulo}
                      </p>
                      <p className="text-sm text-[var(--negro)]/60 mt-0.5">
                        {c.total_facebook_shares.toLocaleString()} FB · {c.keyword ?? "—"} ·{" "}
                        {formatDistanceToNow(new Date(c.created_at), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Link
                        href={`/admin/curar?url=${encodeURIComponent(c.url)}`}
                        className="rounded border border-[var(--rojo)]/60 px-3 py-1.5 text-sm font-medium text-[var(--rojo)] hover:bg-[var(--rojo)]/10"
                      >
                        Curar
                      </Link>
                      <button
                        type="button"
                        onClick={() => descartar(c.id)}
                        disabled={descartandoId === c.id}
                        className="rounded border border-[var(--negro)]/30 px-3 py-1.5 text-sm font-medium text-[var(--negro)]/70 hover:bg-[var(--negro)]/5 disabled:opacity-50"
                      >
                        {descartandoId === c.id ? "..." : "Descartar"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="rounded border border-[var(--negro)]/30 px-3 py-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <span className="text-sm text-[var(--negro)]/70">
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="rounded border border-[var(--negro)]/30 px-3 py-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
