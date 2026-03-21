import Link from "next/link";
import { getTodasLasNotas, getTotalNotas } from "@/lib/notas";
import NotasList from "./NotasList";
import CandidatosLink from "./CandidatosLink";
import CerrarSesionBtn from "./CerrarSesionBtn";

const NOTAS_PER_PAGE = 20;

export const revalidate = 0;
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ page?: string }> };

export default async function AdminPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const offset = (page - 1) * NOTAS_PER_PAGE;

  const [notas, total] = await Promise.all([
    getTodasLasNotas({ limit: NOTAS_PER_PAGE, offset }),
    getTotalNotas(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / NOTAS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold">Admin – Notas</h1>
        <div className="flex items-center gap-4">
          <CerrarSesionBtn />
          <div className="flex gap-2">
            <CandidatosLink />
            <Link
              href="/admin-stories"
              className="rounded border border-[var(--negro)]/30 px-4 py-2 text-sm font-semibold text-[var(--negro)] hover:bg-[var(--negro)]/5"
            >
              Admin Stories
            </Link>
            <Link
              href="/admin-especiales"
              className="rounded border border-[var(--negro)]/30 px-4 py-2 text-sm font-semibold text-[var(--negro)] hover:bg-[var(--negro)]/5"
            >
              Admin Especiales
            </Link>
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

      <NotasList
        notas={notas}
        currentPage={currentPage}
        totalPages={totalPages}
        totalNotas={total}
      />
    </div>
  );
}
