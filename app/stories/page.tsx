import Link from "next/link";
import Image from "next/image";
import { getStories } from "@/lib/stories";
import type { Story } from "@/lib/types";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Historias",
  description: "Historias paginadas en sitio.media",
};

export default async function StoriesPage() {
  const stories: Story[] = await getStories();
  const publicadas = stories.filter((s) => s.status === "published");

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-serif text-2xl font-bold mb-8">Historias</h1>
      {publicadas.length === 0 ? (
        <p className="text-[var(--negro)]/60">No hay historias publicadas aún.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {publicadas.map((story) => (
            <Link
              key={story.id}
              href={`/stories/${story.slug}/1`}
              className="group block rounded-lg overflow-hidden border border-[var(--negro)]/10 bg-white hover:shadow-md transition-shadow"
            >
              <div className="relative aspect-[4/3] w-full bg-[var(--negro)]/5">
                {(story as any).imagen_portada ? (
                  <Image
                    src={(story as any).imagen_portada}
                    alt={story.titulo}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[var(--negro)]/20 text-sm">Sin imagen</div>
                )}
              </div>
              <div className="p-4">
                <h2 className="font-serif text-base font-bold leading-snug group-hover:text-[var(--rojo)] transition-colors line-clamp-3">
                  {story.titulo}
                </h2>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
