"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function LayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isStandalone =
    pathname?.startsWith("/quiz-prestamos-py") ||
    pathname === "/prestamos-paraguay" ||
    pathname === "/solicitar-prestamo-paraguay";

  if (isStandalone) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  );
}
