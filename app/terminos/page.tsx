import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos",
};

export default function TerminosPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-serif text-2xl font-bold">Términos de uso</h1>
      <p className="mt-4 text-[var(--negro)]/80">
        Contenido de los términos de uso. Actualiza este texto según tu sitio.
      </p>
    </div>
  );
}
