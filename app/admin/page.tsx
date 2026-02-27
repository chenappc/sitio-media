import Link from "next/link";
import { getTodasLasNotas } from "@/lib/notas";
import NotasList from "./NotasList";
import CerrarSesionBtn from "./CerrarSesionBtn";

export default async function AdminPage() {
  const notas = await getTodasLasNotas();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold">Admin – Notas</h1>
        <div className="flex items-center gap-4">
          <CerrarSesionBtn />
          <div className="flex gap-2">
            <Link
              href="/admin/curar"
            className="rounded border border-[var(--rojo)]/60 px-4 py-2 text-sm font-semibold text-[var(--rojo)] hover:bg-[var(--rojo)]/10"
          >
            Curar con IA
          </Link>
          <Link
            href="/admin/nueva"
            className="rounded bg-[var(--rojo)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Nueva nota
          </Link>
          </div>
        </div>
      </div>

      <NotasList notas={notas} />
    </div>
  );
}
