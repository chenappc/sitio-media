"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Footer.module.css";

export default function Footer() {
  const pathname = usePathname();
  const isEn = pathname?.startsWith("/en") ?? false;
  const anio = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p className={styles.brand}>
          sitio<span className={styles.brandDot}>.</span>media
        </p>
        <p className={styles.copyright}>© {anio} Vahica.com</p>
        <nav className={styles.nav} aria-label={isEn ? "Legal links" : "Enlaces legales"}>
          <Link href={isEn ? "/en/privacidad" : "/privacidad"} className={styles.navLink}>
            {isEn ? "Privacy Policy" : "Privacidad"}
          </Link>
          <Link href={isEn ? "/en/terminos" : "/terminos"} className={styles.navLink}>
            {isEn ? "Terms of Use" : "Términos"}
          </Link>
          <Link href={isEn ? "/en/contacto" : "/contacto"} className={styles.navLink}>
            {isEn ? "Contact" : "Contacto"}
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
