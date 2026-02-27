"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

function formatHora(fecha: Date) {
  return formatDistanceToNow(new Date(fecha), { addSuffix: true, locale: es });
}

function formatShares(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

type NotaRow = {
  id: number;
  slug: string;
  titulo: string;
  entradilla: string;
  shares_buzzsumo: number;
  publicado: boolean;
  fecha: Date;
};

export default function NotasList({ notas }: { notas: NotaRow[] }) {
  const router = useRouter();

  const handleBorrar = async (id: number, titulo: string) => {
    if (!confirm(`¿Borrar la nota "${titulo}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    const secret = window.prompt("Contraseña admin");
    if (!secret) return;
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
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error de red");
    }
  };

  if (notas.length === 0) {
    return (
      <p className="py-8 text-center text-[var(--negro)]/60">
        No hay notas. <Link href="/admin/nueva" className="text-[var(--rojo)] underline">Crear una</Link>.
      </p>
    );
  }

  return (
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
              {formatHora(nota.fecha)} · {formatShares(nota.shares_buzzsumo)} shares
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
          <div className="flex gap-2">
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
        </li>
      ))}
    </ul>
  );
}
