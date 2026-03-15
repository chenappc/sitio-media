import Link from "next/link";
import styles from "./Footer.module.css";

export default function Footer() {
  const anio = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p className={styles.brand}>
          sitio<span className={styles.brandDot}>.</span>media
        </p>
        <p className={styles.copyright}>© {anio} Vahica.com</p>
        <nav className={styles.nav} aria-label="Enlaces legales">
          <Link href="/privacidad" className={styles.navLink}>
            Privacidad
          </Link>
          <Link href="/terminos" className={styles.navLink}>
            Términos
          </Link>
          <Link href="/contacto" className={styles.navLink}>
            Contacto
          </Link>
          <Link href="/quiz-prestamos-py" className={styles.navLink}>
            Préstamos Paraguay
          </Link>
        </nav>
      </div>
    </footer>
  );
}
