"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import styles from "./Header.module.css";

function getLangToggleHref(pathname: string | null): { href: string; label: "ES" | "EN"; title: string } {
  const p = pathname || "/";

  if (p === "/en" || p.startsWith("/en/")) {
    if (p === "/en" || p === "/en/") {
      return { href: "/", label: "ES", title: "Ver en español" };
    }
    if (p.startsWith("/en/stories")) {
      return { href: "/stories", label: "ES", title: "Ver en español" };
    }
    if (p.startsWith("/en/especiales")) {
      return { href: "/especiales", label: "ES", title: "Ver en español" };
    }
    const oneEn = /^\/en\/([^/]+)$/.exec(p);
    if (oneEn && oneEn[1] !== "stories") {
      return { href: "/", label: "ES", title: "Ver en español" };
    }
    const rest = p.slice(3);
    return { href: rest.startsWith("/") ? rest : `/${rest}`, label: "ES", title: "Ver en español" };
  }

  if (p === "/" || p === "") {
    return { href: "/en", label: "EN", title: "English" };
  }
  if (p.startsWith("/stories")) {
    return { href: "/en/stories", label: "EN", title: "English" };
  }
  if (p.startsWith("/especiales")) {
    return { href: "/en/especiales", label: "EN", title: "English" };
  }
  const oneSp = /^\/([^/]+)$/.exec(p);
  if (oneSp) {
    const reserved = new Set(["stories", "especiales", "en", "admin", "api", "_next"]);
    if (!reserved.has(oneSp[1])) {
      return { href: "/en", label: "EN", title: "English" };
    }
  }
  return { href: `/en${p.startsWith("/") ? p : `/${p}`}`, label: "EN", title: "English" };
}

export default function Header() {
  const pathname = usePathname();
  const lang = getLangToggleHref(pathname);
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
          <Link href={lang.href} className={styles.langLink} title={lang.title}>
            {lang.label}
          </Link>
        </div>
      </nav>
    </header>
  );
}
