"use client";

import Link from "next/link";
import styles from "./Header.module.css";

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link
          href="/"
          className={styles.logo}
          aria-label="sitio.media - Inicio"
        >
          sitio<span className={styles.logoDot}>.</span>media
        </Link>
        <span className={styles.slogan}>Lo que todo el mundo está hablando</span>
      </div>
    </header>
  );
}
