"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import styles from "./Header.module.css";

export default function Header() {
  const pathname = usePathname();

  const navNotasHref = "/en";
  const navNotasLabel = "Viral News";
  const navNotasActive = pathname === "/en" || pathname === "/en/";

  const navStoriesHref = "/en/stories";
  const navStoriesLabel = "Stories";
  const navStoriesActive = Boolean(pathname?.startsWith("/en/stories"));

  const navEspecialesHref = "/en/especiales";
  const navEspecialesLabel = "Specials";
  const navEspecialesActive = Boolean(pathname?.startsWith("/en/especiales"));

  const sloganText = "What everyone is talking about";

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/en" className={styles.logo} aria-label="Vahica.com - Home">
          <Image
            src="/logo-vahica.png"
            alt="Vahica.com"
            width={120}
            height={36}
            style={{ maxWidth: "120px", height: "auto" }}
            priority
          />
        </Link>
        <span className={styles.slogan}>{sloganText}</span>
      </div>
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <Link
            href={navNotasHref}
            className={`${styles.navLink} ${navNotasActive ? styles.navLinkActive : ""}`}
          >
            {navNotasLabel}
          </Link>
          <Link
            href={navStoriesHref}
            className={`${styles.navLink} ${navStoriesActive ? styles.navLinkActive : ""}`}
          >
            {navStoriesLabel}
          </Link>
          <Link
            href={navEspecialesHref}
            className={`${styles.navLink} ${navEspecialesActive ? styles.navLinkActive : ""}`}
          >
            {navEspecialesLabel}
          </Link>
        </div>
      </nav>
    </header>
  );
}
