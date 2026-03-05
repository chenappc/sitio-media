"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { getAdminSecret } from "./CerrarSesionBtn";

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

export default function CandidatosSection() {
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [descartandoId, setDescartandoId] = useState<number | null>(null);

  const fetchCandidatos = async () => {
    const secret = getAdminSecret();
    if (!secret) {
      setError("Ingresá la contraseña admin en alguna acción primero.");
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

  if (loading) {
    return (
      <section className="mb-8">
        <h2 className="font-serif text-xl font-bold mb-4">Candidatos vía API</h2>
        <p className="text-[var(--negro)]/60">Cargando candidatos...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mb-8">
        <h2 className="font-serif text-xl font-bold mb-4">Candidatos vía API</h2>
        <p className="text-red-600">{error}</p>
      </section>
    );
  }

  if (candidatos.length === 0) {
    return (
      <section className="mb-8">
        <h2 className="font-serif text-xl font-bold mb-4">Candidatos vía API</h2>
        <p className="text-[var(--negro)]/60">No hay candidatos pendientes.</p>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="font-serif text-xl font-bold mb-4">Candidatos vía API</h2>
      <ul className="space-y-4">
        {candidatos.map((c) => (
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
              <p className="font-medium text-[var(--negro)] line-clamp-2">{c.titulo}</p>
              <p className="text-sm text-[var(--negro)]/60 mt-0.5">
                {c.total_facebook_shares.toLocaleString()} FB · {c.keyword ?? "—"} ·{" "}
                {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: es })}
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
    </section>
  );
}
