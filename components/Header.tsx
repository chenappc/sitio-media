"use client";

import Link from "next/link";
import styles from "./Header.module.css";

function FechaHoy() {
  const hoy = new Date();
  const opciones: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  const texto = hoy.toLocaleDateString("es-ES", opciones);
  return <time dateTime={hoy.toISOString().slice(0, 10)}>{texto}</time>;
}

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
        <span className={styles.date}>
          <FechaHoy />
        </span>
      </div>
    </header>
  );
}
