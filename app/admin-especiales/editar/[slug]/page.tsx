import Link from "next/link";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

export default async function AdminEspecialesEditarPage({ params }: Props) {
  const { slug } = await params;
  if (!slug?.trim()) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold">Editar Especial</h1>
        <Link
          href="/admin-especiales"
          className="rounded border border-[var(--negro)]/20 px-4 py-2 text-sm font-medium text-[var(--negro)] hover:bg-[var(--negro)]/5 no-underline"
        >
          ← Admin Especiales
        </Link>
      </div>
      <p className="text-sm text-[var(--negro)]/60">Slug: {slug}</p>
      <p className="mt-2 text-sm text-[var(--negro)]/60">Vista de edición por implementar.</p>
    </div>
  );
}
