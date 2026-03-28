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
        <nav className={styles.nav} aria-label="Legal links">
          <Link href="/en/privacidad" className={styles.navLink}>
            Privacy Policy
          </Link>
          <Link href="/en/terminos" className={styles.navLink}>
            Terms of Use
          </Link>
          <Link href="/en/contacto" className={styles.navLink}>
            Contact
          </Link>
          {/* Temporal: oculto
          <Link href="/quiz-prestamos-py" className={styles.navLink}>
            Préstamos Paraguay
          </Link>
          */}
        </nav>
      </div>
    </footer>
  );
}
