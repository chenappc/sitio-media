"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
type EspecialRow = {
  id: number;
  slug: string;
  titulo: string;
  status: string;
  total_paginas: number;
  created_at?: string;
};

function getAdminSecret(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("admin_secret") ?? "";
}

export default function AdminEspecialesPage() {
  const [especiales, setEspeciales] = useState<EspecialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  const fetchEspeciales = useCallback(() => {
    fetch("/api/especiales")
      .then((r) => r.json())
      .then((data) => {
        setEspeciales(Array.isArray(data) ? data : []);
      })
      .catch(() => setEspeciales([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const secret = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "";
    const stored = getAdminSecret();
    if (!secret || stored !== secret) {
      setUnauthorized(true);
      setLoading(false);
      return;
    }
    fetchEspeciales();
  }, [fetchEspeciales]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <p className="text-sm text-[var(--negro)]/60">Cargando…</p>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <p className="text-sm text-red-600">No autorizado. Ingresá la contraseña admin en /admin primero.</p>
        <Link
          href="/admin"
          className="mt-2 inline-block rounded border border-[var(--negro)]/20 px-4 py-2 text-sm font-medium text-[var(--negro)] hover:bg-[var(--negro)]/5 no-underline"
        >
          Ir a Admin
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold">Admin Especiales</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="rounded border border-[var(--negro)]/20 px-4 py-2 text-sm font-medium text-[var(--negro)] hover:bg-[var(--negro)]/5 no-underline"
          >
            ← Admin Notas
          </Link>
          <Link
            href="/admin-especiales/nuevo"
            className="rounded border border-[var(--negro)]/30 px-4 py-2 text-sm font-semibold text-[var(--negro)] hover:bg-[var(--negro)]/5 no-underline"
          >
            Nuevo Especial
          </Link>
        </div>
      </div>

      <section className="rounded-lg border border-[var(--negro)]/10 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Especiales existentes</h2>
        {especiales.length === 0 ? (
          <p className="text-sm text-[var(--negro)]/60">No hay especiales.</p>
        ) : (
          <ul className="space-y-3">
            {especiales.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--negro)]/10 pb-3 last:border-0"
              >
                <div>
                  <span className="font-medium">{e.titulo}</span>
                  <span className="ml-2 text-sm text-[var(--negro)]/60">{e.slug}</span>
                  <span className="ml-2 text-sm text-[var(--negro)]/60">
                    · {e.total_paginas} págs · {e.status}
                  </span>
                </div>
                <Link
                  href={`/admin-especiales/editar/${e.slug}`}
                  className="rounded border border-[var(--negro)]/20 px-2 py-1 text-xs font-medium hover:bg-[var(--negro)]/5 text-[var(--negro)] no-underline"
                >
                  Editar
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
