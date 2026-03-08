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
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-serif text-2xl font-bold mb-6">Historias</h1>
      {publicadas.length === 0 ? (
        <p className="text-[var(--negro)]/60">No hay historias publicadas aún.</p>
      ) : (
        <ul className="space-y-6">
          {publicadas.map((story) => (
            <li key={story.id}>
              <Link
                href={`/stories/${story.slug}/1`}
                className="flex gap-4 group items-start"
              >
                <div className="flex-1 min-w-0">
                  <h2 className="font-serif text-lg font-bold leading-snug group-hover:text-[var(--rojo)] transition-colors line-clamp-3">
                    {story.titulo}
                  </h2>
                  <p className="text-sm text-[var(--negro)]/50 mt-1">
                    {story.total_paginas} páginas
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
