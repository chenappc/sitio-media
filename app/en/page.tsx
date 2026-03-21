import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  getNotasPublicadasPorIdioma,
  getTotalNotasPublicadasPorIdioma,
} from "@/lib/notas";
import type { Nota } from "@/lib/types";
import styles from "../Home.module.css";

const NOTAS_PER_PAGE = 20;
const IDIOMA_EN = "en";

export const revalidate = 0;
export const dynamic = "force-dynamic";

function formatHora(fecha: Date) {
  return formatDistanceToNow(new Date(fecha), { addSuffix: true, locale: enUS });
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

function GridCard({ nota }: { nota: Nota }) {
  return (
    <article>
      <Link href={`/en/${nota.slug}`} className={styles.cardLink}>
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

type Props = { searchParams: Promise<{ page?: string }> };

export default async function HomeEnPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const offset = (page - 1) * NOTAS_PER_PAGE;

  const [notas, total] = await Promise.all([
    getNotasPublicadasPorIdioma({ limit: NOTAS_PER_PAGE, offset, idioma: IDIOMA_EN }),
    getTotalNotasPublicadasPorIdioma(IDIOMA_EN),
  ]);

  if (notas.length === 0 && total === 0) {
    return <EmptyState />;
  }

  const totalPages = Math.max(1, Math.ceil(total / NOTAS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const showPagination = totalPages > 1;

  return (
    <main className={`${styles.main} ${styles.mainWithFeed}`}>
      <div className={styles.content}>
        <div className={styles.feed}>
          <div className={styles.grid}>
            {notas.map((nota) => (
              <GridCard key={nota.id} nota={nota} />
            ))}
          </div>
          {showPagination && (
            <nav className={styles.pagination} aria-label="Pagination">
              <div className={styles.paginationInner}>
                {currentPage > 1 ? (
                  <Link
                    href={currentPage === 2 ? "/en" : `/en?page=${currentPage - 1}`}
                    className={styles.paginationLink}
                  >
                    ← Previous
                  </Link>
                ) : (
                  <span className={styles.paginationDisabled}>← Previous</span>
                )}
                <span className={styles.paginationLabel}>
                  Page {currentPage} of {totalPages}
                </span>
                {currentPage < totalPages ? (
                  <Link
                    href={`/en?page=${currentPage + 1}`}
                    className={styles.paginationLink}
                  >
                    Next →
                  </Link>
                ) : (
                  <span className={styles.paginationDisabled}>Next →</span>
                )}
              </div>
            </nav>
          )}
        </div>
      </div>
    </main>
  );
}
