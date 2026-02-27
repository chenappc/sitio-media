import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Términos de Servicio",
  description: "Términos de servicio de sitio.media",
};

export default function TerminosPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-serif text-2xl font-bold md:text-3xl">
        Términos de Servicio
      </h1>
      <p className="mt-2 text-sm text-[var(--negro)]/60">
        Última actualización: febrero 2025
      </p>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">1. Aceptación de los términos</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          Al acceder o utilizar el sitio web sitio.media («el Sitio»), usted acepta quedar vinculado por los presentes Términos de Servicio. Si no está de acuerdo con alguna parte de estos términos, no debe utilizar el Sitio.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">2. Uso del sitio</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          Usted se compromete a utilizar el Sitio de forma lícita y de acuerdo con estos términos. En particular, no debe:
        </p>
        <ul className="mt-2 list-disc pl-6 space-y-1 text-[var(--negro)]/80">
          <li>Utilizar el Sitio para fines ilegales, fraudulentos o que infrinjan derechos de terceros.</li>
          <li>Intentar acceder sin autorización a sistemas, redes o datos del Sitio o de terceros.</li>
          <li>Introducir virus, malware o cualquier código o contenido que pueda dañar o interferir con el funcionamiento del Sitio.</li>
          <li>Suplantar identidades o falsear información al contactarnos o al interactuar con el Sitio.</li>
          <li>Extraer, rastrear o reutilizar de forma masiva contenidos o datos del Sitio mediante medios automatizados sin autorización previa.</li>
        </ul>
        <p className="mt-3 text-[var(--negro)]/80 leading-relaxed">
          Nos reservamos el derecho de denegar el acceso o de suspender el uso del Sitio a quien incumpla estos términos o realice un uso indebido del mismo.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">3. Propiedad intelectual</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          El Sitio y su contenido (textos, diseño, logotipos, imágenes propias, código y demás materiales) están protegidos por leyes de propiedad intelectual y son propiedad de sitio.media o de sus licenciantes. Queda prohibida la reproducción, distribución, modificación o uso comercial no autorizado de dicho contenido, salvo que se indique expresamente lo contrario o se conceda una licencia por escrito.
        </p>
        <p className="mt-3 text-[var(--negro)]/80 leading-relaxed">
          Las noticias y artículos que publicamos pueden incluir material de fuentes externas; en esos casos, los derechos corresponden a sus respectivos titulares y el Sitio actúa como canal de divulgación, respetando los créditos y enlaces a las fuentes originales cuando corresponda.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">4. Contenido de terceros</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          El Sitio puede incluir enlaces a sitios web, anuncios o contenidos de terceros (por ejemplo, redes sociales, plataformas de publicidad o medios de comunicación). No controlamos ni asumimos responsabilidad por el contenido, las políticas de privacidad o las prácticas de esos terceros. El acceso a enlaces externos es bajo su propia cuenta y riesgo, y le recomendamos leer los términos y políticas de los sitios que visite.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">5. Limitación de responsabilidad</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          El Sitio se ofrece «tal cual» y «según disponibilidad». En la máxima medida permitida por la ley aplicable, sitio.media y sus responsables no serán responsables por daños directos, indirectos, incidentales, especiales o consecuentes derivados del uso o la imposibilidad de uso del Sitio, incluyendo pero no limitándose a: errores u omisiones en el contenido, interrupciones del servicio, pérdida de datos o daños derivados de virus o de la conducta de terceros.
        </p>
        <p className="mt-3 text-[var(--negro)]/80 leading-relaxed">
          La información publicada en el Sitio tiene carácter informativo y no constituye asesoramiento legal, fiscal ni profesional. Para decisiones importantes, consulte siempre a un profesional cualificado.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">6. Modificaciones</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          Nos reservamos el derecho de modificar estos Términos de Servicio en cualquier momento. Los cambios entrarán en vigor desde su publicación en esta página; la fecha de «Última actualización» reflejará la versión vigente. El uso continuado del Sitio tras la publicación de cambios implica la aceptación de los nuevos términos. Le recomendamos revisar esta página periódicamente.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">7. Ley aplicable y resolución de conflictos</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          Estos términos se rigen por las leyes aplicables en el lugar desde el que se opera el Sitio. Cualquier controversia derivada de estos términos o del uso del Sitio se resolverá ante los tribunales competentes en dicho lugar, salvo que la ley aplicable imponga otra cosa.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">8. Contacto</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          Para consultas sobre estos Términos de Servicio puede contactarnos a través de nuestra página de{" "}
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
