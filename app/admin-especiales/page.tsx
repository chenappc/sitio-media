"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getAdminSecret } from "@/app/admin/CerrarSesionBtn";

type EspecialRow = {
  id: number;
  slug: string;
  titulo: string;
  status: string;
  total_paginas: number;
  created_at?: string;
};

export default function AdminEspecialesPage() {
  const [especiales, setEspeciales] = useState<EspecialRow[]>([]);
  const [loadingEspeciales, setLoadingEspeciales] = useState(true);

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
        {loadingEspeciales ? (
          <p className="text-sm text-[var(--negro)]/60">Cargando…</p>
        ) : especiales.length === 0 ? (
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
