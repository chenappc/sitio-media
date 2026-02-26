import Link from "next/link";
import styles from "./ComingSoon.module.css";

export default function ComingSoonPage() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.content}>
        <h1 className={styles.logo}>
          sitio<span className={styles.logoDot}>.</span>media
        </h1>
        <p className={styles.tagline}>
          Muy pronto. Lo que todo el mundo está hablando.
        </p>
        <p className={styles.footerLinkWrap}>
          <Link href="/quiz-prestamos-py" className={styles.footerLink}>
            Préstamos Paraguay
          </Link>
        </p>
        <div className={styles.iconWrap} aria-hidden>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
      </div>
    </div>
  );
}
