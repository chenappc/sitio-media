import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contacto",
};

export default function ContactoPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-serif text-2xl font-bold">Contacto</h1>
      <p className="mt-4 text-[var(--negro)]/80">
        Contenido de la página de contacto. Actualiza este texto según tu sitio.
      </p>
    </div>
  );
}
