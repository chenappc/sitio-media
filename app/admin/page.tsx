import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { getTodasNotas } from "@/lib/notas";

function formatHora(fecha: Date) {
  return formatDistanceToNow(new Date(fecha), { addSuffix: true, locale: es });
}

function formatShares(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default async function AdminPage() {
  const notas = await getTodasNotas();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold">Admin – Notas</h1>
        <Link
          href="/admin/nueva"
          className="rounded bg-[var(--rojo)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Nueva nota
        </Link>
      </div>

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
          </li>
        ))}
      </ul>

      {notas.length === 0 && (
        <p className="py-8 text-center text-[var(--negro)]/60">
          No hay notas. <Link href="/admin/nueva" className="text-[var(--rojo)] underline">Crear una</Link>.
        </p>
      )}
    </div>
  );
}
