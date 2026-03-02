"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { getAdminSecret, setAdminSecret } from "./CerrarSesionBtn";

function formatHora(fecha: Date) {
  return formatDistanceToNow(new Date(fecha), { addSuffix: true, locale: es });
}

type NotaRow = {
  id: number;
  slug: string;
  titulo: string;
  entradilla: string;
  publicado: boolean;
  fecha: Date;
};

type PostearResult = { notaId: number; postUrl?: string; error?: string } | null;

type NotasListProps = {
  notas: NotaRow[];
  currentPage: number;
  totalPages: number;
  totalNotas: number;
};

export default function NotasList({
  notas: notasInitial,
  currentPage,
  totalPages,
  totalNotas,
}: NotasListProps) {
  const [notas, setNotas] = useState<NotaRow[]>(notasInitial);
  const [postingId, setPostingId] = useState<number | null>(null);
  const [postearResult, setPostearResult] = useState<PostearResult>(null);

  const handlePostear = async (notaId: number) => {
    setPostearResult(null);
    let secret = getAdminSecret();
    if (!secret) {
      secret = window.prompt("Contraseña admin") ?? "";
      if (!secret) return;
    }
    setPostingId(notaId);
    try {
      const res = await fetch("/api/fb/postear", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({ notaId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPostearResult({ notaId, error: data.error ?? `Error ${res.status}` });
        return;
      }
      setAdminSecret(secret);
      setPostearResult({
        notaId,
        postUrl: data.postUrl,
      });
    } catch (err) {
      setPostearResult({
        notaId,
        error: err instanceof Error ? err.message : "Error de red",
      });
    } finally {
      setPostingId(null);
    }
  };

  const handleBorrar = async (id: number, titulo: string) => {
    if (!confirm(`¿Borrar la nota "${titulo}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    let secret = getAdminSecret();
    if (!secret) {
      secret = window.prompt("Contraseña admin") ?? "";
      if (!secret) return;
    }
    try {
      const res = await fetch(`/api/notas/${id}`, {
        method: "DELETE",
        headers: { "x-admin-secret": secret },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? `Error ${res.status}`);
        return;
      }
      setAdminSecret(secret);
      setNotas((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error de red");
    }
  };

  if (notas.length === 0 && totalNotas === 0) {
    return (
      <p className="py-8 text-center text-[var(--negro)]/60">
        No hay notas. <Link href="/admin/nueva" className="text-[var(--rojo)] underline">Crear una</Link>.
      </p>
    );
  }

  const showPagination = totalPages > 1;

  return (
    <>
    <ul className="space-y-3">
      {notas.map((nota) => (
        <li
          key={nota.id}
          className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--negro)]/10 py-3"
        >
          <div className="min-w-0 flex-1">
            <Link
              href={`/${nota.slug}`}
              className="font-medium text-[var(--negro)] hover:text-[var(--rojo)]"
            >
              {nota.titulo}
            </Link>
            <p className="text-sm text-[var(--negro)]/60">
              {formatHora(nota.fecha)}
            </p>
          </div>
          <span
            className={`rounded px-2 py-0.5 text-sm font-medium ${
              nota.publicado
                ? "bg-green-100 text-green-800"
                : "bg-[var(--negro)]/10 text-[var(--negro)]/70"
            }`}
          >
            {nota.publicado ? "Publicado" : "Borrador"}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {nota.publicado && (
              <button
                type="button"
                onClick={() => handlePostear(nota.id)}
                disabled={postingId !== null}
                className="rounded border border-[#1877f2] bg-[#1877f2] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#166fe5] disabled:opacity-50"
              >
                {postingId === nota.id ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  "Postear en FB"
                )}
              </button>
            )}
            <Link
              href={`/admin/editar/${nota.id}`}
              className="rounded border border-[var(--negro)]/20 px-3 py-1.5 text-sm font-medium text-[var(--negro)] hover:bg-[var(--negro)]/5"
            >
              Editar
            </Link>
            <button
              type="button"
              onClick={() => handleBorrar(nota.id, nota.titulo)}
              className="rounded border border-[var(--rojo)]/50 px-3 py-1.5 text-sm font-medium text-[var(--rojo)] hover:bg-[var(--rojo)]/10"
            >
              Borrar
            </button>
          </div>
          {postearResult?.notaId === nota.id && (
            <div className="mt-2 w-full">
              {postearResult.postUrl ? (
                <p className="text-sm text-green-700">
                  Publicado:{" "}
                  <a
                    href={postearResult.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Ver en Facebook
                  </a>
                </p>
              ) : (
                <p className="text-sm text-red-600" role="alert">
                  {postearResult.error}
                </p>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>

    {showPagination && (
      <nav className="mt-6 flex flex-wrap items-center justify-center gap-4 border-t border-[var(--negro)]/10 pt-4" aria-label="Paginación">
        <span className="text-sm text-[var(--negro)]/70">
          Página {currentPage} de {totalPages}
        </span>
        <div className="flex gap-2">
          {currentPage > 1 ? (
            <Link
              href={currentPage === 2 ? "/admin" : `/admin?page=${currentPage - 1}`}
              className="rounded border border-[var(--negro)]/20 px-4 py-2 text-sm font-medium text-[var(--negro)] hover:bg-[var(--negro)]/5"
            >
              Anterior
            </Link>
          ) : (
            <span className="rounded border border-[var(--negro)]/10 px-4 py-2 text-sm text-[var(--negro)]/40 cursor-not-allowed">
              Anterior
            </span>
          )}
          {currentPage < totalPages ? (
            <Link
              href={`/admin?page=${currentPage + 1}`}
              className="rounded border border-[var(--negro)]/20 px-4 py-2 text-sm font-medium text-[var(--negro)] hover:bg-[var(--negro)]/5"
            >
              Siguiente
            </Link>
          ) : (
            <span className="rounded border border-[var(--negro)]/10 px-4 py-2 text-sm text-[var(--negro)]/40 cursor-not-allowed">
              Siguiente
            </span>
          )}
        </div>
      </nav>
    )}
    </>
  );
}
