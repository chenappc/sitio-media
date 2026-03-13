"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Header.module.css";

export default function Header() {
  const pathname = usePathname();
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo} aria-label="sitio.media - Inicio">
          sitio<span className={styles.logoDot}>.</span>media
        </Link>
        <span className={styles.slogan}>Lo que todo el mundo está hablando</span>
      </div>
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <Link href="/" className={`${styles.navLink} ${pathname === "/" ? styles.navLinkActive : ""}`}>
            Notas virales
          </Link>
          <Link href="/stories" className={`${styles.navLink} ${pathname?.startsWith("/stories") ? styles.navLinkActive : ""}`}>
            Historias
          </Link>
          <Link href="/especiales" className={`${styles.navLink} ${pathname?.startsWith("/especiales") ? styles.navLinkActive : ""}`}>
            Especiales
          </Link>
        </div>
      </nav>
    </header>
  );
}
