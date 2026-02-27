import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description: "Política de privacidad de sitio.media",
};

export default function PrivacidadPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-serif text-2xl font-bold md:text-3xl">
        Política de Privacidad
      </h1>
      <p className="mt-2 text-sm text-[var(--negro)]/60">
        Última actualización: Febrero 2026
      </p>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">1. Responsable del tratamiento</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          El sitio web sitio.media («el Sitio») es operado por los titulares del proyecto. La presente política describe cómo recopilamos, usamos y protegemos la información de quienes visitan o utilizan el Sitio.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">2. Datos que recopilamos</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          Podemos recopilar: datos de uso (IP, navegador, páginas visitadas); cookies y tecnologías similares; y los datos que usted nos proporcione al contactarnos (nombre, email, mensaje).
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">3. Uso de cookies</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          Utilizamos cookies para el correcto funcionamiento del Sitio, analizar el tráfico y mostrar publicidad (por ejemplo mediante Google AdSense). Puede configurar su navegador para rechazar cookies; en ese caso algunas funciones podrían no estar disponibles.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">4. Google AdSense</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          El Sitio puede mostrar anuncios de Google AdSense. Google y sus partners pueden usar cookies para mostrar anuncios basados en sus visitas y medir la eficacia. La recopilación de datos por Google se rige por la{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[var(--rojo)] underline hover:no-underline">
            Política de privacidad de Google
          </a>
          . Puede gestionar la publicidad en{" "}
          <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" className="text-[var(--rojo)] underline hover:no-underline">
            Configuración de anuncios de Google
          </a>.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">5. Derechos del usuario</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          Según la normativa aplicable, puede tener derecho a acceder a sus datos, rectificarlos, suprimirlos, oponerse o limitar el tratamiento, retirar el consentimiento y presentar una reclamación ante la autoridad de protección de datos. Para ejercer estos derechos, contacte con nosotros mediante la página de contacto.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">6. Conservación y seguridad</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          Conservamos sus datos el tiempo necesario para las finalidades descritas o el que exija la ley. Aplicamos medidas razonables para proteger la información frente a accesos no autorizados, pérdida o alteración.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">7. Cambios a esta política</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          Podemos actualizar esta política ocasionalmente. La fecha de «Última actualización» reflejará los cambios. Le recomendamos revisar esta página de vez en cuando.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">8. Contacto</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          Para consultas sobre esta política o sus datos personales, puede escribirnos a través de nuestra página de{" "}
          <Link href="/contacto" className="text-[var(--rojo)] underline hover:no-underline">
            contacto
          </Link>.
        </p>
      </section>

      <p className="mt-10 pt-6 border-t border-[var(--negro)]/10">
        <Link href="/" className="text-[var(--rojo)] underline hover:no-underline">
          ← Volver al inicio
        </Link>
      </p>
    </div>
  );
}
