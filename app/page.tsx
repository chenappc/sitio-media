import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { getNotasPublicadas } from "@/lib/notas";
import type { Nota } from "@/lib/types";
import styles from "./Home.module.css";

export const revalidate = 3600;

function formatHora(fecha: Date) {
  return formatDistanceToNow(new Date(fecha), { addSuffix: true, locale: es });
}

function formatShares(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function EmptyState() {
  return (
    <main className={styles.main}>
      <div className={styles.empty}>
        <h1 className={styles.emptyLogo}>
          sitio<span className={styles.emptyLogoDot}>.</span>media
        </h1>
        <p className={styles.emptyTagline}>
          Muy pronto. Lo que todo el mundo está hablando.
        </p>
        <div className={styles.emptyCta}>
          <p className={styles.emptyCtaIntro}>
            Mientras construimos nuestro sitio, te invitamos a visitar:
          </p>
          <Link href="/quiz-prestamos-py" className={styles.emptyCtaBtn}>
            Préstamos Paraguay →
          </Link>
        </div>
      </div>
    </main>
  );
}

function FeaturedCard({ nota }: { nota: Nota }) {
  return (
    <article className={styles.featured}>
      <Link href={`/${nota.slug}`} className={styles.featuredLink}>
        {nota.imagen_url && (
          <div className={styles.featuredImageWrap}>
            <Image
              src={nota.imagen_url}
              alt={nota.imagen_alt ?? nota.titulo}
              fill
              sizes="(max-width: 768px) 100vw, 896px"
              priority
            />
          </div>
        )}
        <span className={styles.featuredBadge}>VIRAL</span>
        <h2 className={styles.featuredTitle}>{nota.titulo}</h2>
        <p className={styles.featuredEntradilla}>{nota.entradilla}</p>
        <p className={styles.featuredMeta}>
          {formatHora(nota.fecha)} · {formatShares(nota.shares_buzzsumo)} shares
        </p>
      </Link>
    </article>
  );
}

function GridCard({ nota }: { nota: Nota }) {
  return (
    <article>
      <Link href={`/${nota.slug}`} className={styles.cardLink}>
        {nota.imagen_url && (
          <div className={styles.cardImageWrap}>
            <Image
              src={nota.imagen_url}
              alt={nota.imagen_alt ?? nota.titulo}
              fill
              sizes="(max-width: 639px) 100vw, 50vw"
            />
          </div>
        )}
        <span className={styles.cardBadge}>VIRAL</span>
        <h3 className={styles.cardTitle}>{nota.titulo}</h3>
        <p className={styles.cardEntradilla}>{nota.entradilla}</p>
        <p className={styles.cardMeta}>{formatHora(nota.fecha)}</p>
      </Link>
    </article>
  );
}

export default async function HomePage() {
  const notas = await getNotasPublicadas(15);

  if (notas.length === 0) {
    return <EmptyState />;
  }

  const [featured, ...rest] = notas;

  return (
    <main className={`${styles.main} ${styles.mainWithFeed}`}>
      <div className={styles.content}>
        <div className={styles.feed}>
          <FeaturedCard nota={featured} />
          {rest.length > 0 && (
            <div className={styles.grid}>
              {rest.map((nota) => (
                <GridCard key={nota.id} nota={nota} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
