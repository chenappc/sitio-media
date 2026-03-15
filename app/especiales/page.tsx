import Link from "next/link";
import Image from "next/image";
import { getEspeciales } from "@/lib/especiales";

export const revalidate = 60;

export const metadata = {
  title: "Especiales",
  description: "Especiales en Vahica.com",
};

export default async function EspecialesPage() {
  const todos = await getEspeciales();
  const publicados = todos.filter((e) => e.status === "published");

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-serif text-2xl font-bold mb-8">Especiales</h1>
      {publicados.length === 0 ? (
        <p className="text-[var(--negro)]/60">No hay especiales publicados aún.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {publicados.map((especial) => (
            <Link
              key={especial.id}
              href={`/especiales/${especial.slug}/1`}
              className="group block rounded-lg overflow-hidden border border-[var(--negro)]/10 bg-white hover:shadow-md transition-shadow"
            >
              <div className="relative aspect-[4/3] w-full bg-[var(--negro)]/5">
                {especial.imagen_portada ? (
                  <Image
                    src={especial.imagen_portada}
                    alt={especial.titulo}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[var(--negro)]/20 text-sm">Sin imagen</div>
                )}
              </div>
              <div className="p-4">
                <h2 className="font-serif text-base font-bold leading-snug group-hover:text-[var(--rojo)] transition-colors line-clamp-3">
                  {especial.titulo}
                </h2>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
