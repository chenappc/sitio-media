"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import styles from "./Header.module.css";

export default function Header() {
  const pathname = usePathname();
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo} aria-label="Vahica.com - Inicio">
          {/* Antes del cambio a Vahica: logo era texto "sitio.media", sin width/height. Ahora: width=120, height=36 (proporcional al texto anterior) */}
          <Image
            src="/logo-vahica.png"
            alt="Vahica.com"
            width={120}
            height={36}
            style={{ maxWidth: "120px", height: "auto" }}
            priority
          />
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
